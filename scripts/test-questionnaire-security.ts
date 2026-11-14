import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Client } from "pg";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { liveEnvironment } from "../tests/live/environment.ts";
import { questionnaireValues } from "../tests/live/questionnaire-fixtures.ts";
import { questions } from "../src/features/questionnaire/catalog.ts";
import { parseQuestionnaire } from "../supabase/functions/_shared/questionnaire-contract.ts";
import {
  parseCreatedSession,
  parseRedeemedSession,
} from "../supabase/functions/_shared/session-contract.ts";
import type { QuestionCode, Questionnaire } from "../src/types/domain.ts";

async function main() {
  const env = liveEnvironment();
  const database = new Client({
    connectionString: env.databaseURL,
    ssl: {
      rejectUnauthorized: true,
      ...(env.caFile ? { ca: readFileSync(env.caFile, "utf8") } : {}),
    },
    connectionTimeoutMillis: 10000,
    statement_timeout: 10000,
    query_timeout: 15000,
  });
  const userIds: string[] = [],
    clients: SupabaseClient[] = [];
  let phase = "connect to acknowledged test project",
    checks = 0,
    cleanupFailed = false;
  function check(condition: unknown): asserts condition {
    if (!condition) throw new Error("Questionnaire security assertion failed.");
  }
  async function run(label: string, callback: () => Promise<void>) {
    phase = label;
    await callback();
    checks++;
    console.log(`PASS ${label}`);
  }
  async function identity() {
    const client = createClient(env.url, env.key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    clients.push(client);
    const response = await client.auth.signInAnonymously();
    if (response.data.user) userIds.push(response.data.user.id);
    check(
      !response.error &&
        response.data.session &&
        response.data.user?.is_anonymous,
    );
    return { client, jwt: response.data.session.access_token };
  }
  async function rpc(
    client: SupabaseClient,
    name: string,
    args: Record<string, unknown>,
  ) {
    const result = await client.rpc(name, args);
    check(!result.error);
    return result.data as unknown;
  }
  async function denied(
    client: SupabaseClient,
    name: string,
    args: Record<string, unknown>,
    message?: string,
  ) {
    const result = await client.rpc(name, args);
    check(result.error && (!message || result.error.message === message));
  }
  async function api(
    path: string,
    jwt: string,
    method = "GET",
    body?: unknown,
  ) {
    const response = await fetch(`${env.url}/functions/v1/fsm-api/v1${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${jwt}`,
        apikey: env.key,
        origin: env.appOrigin,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    return {
      status: response.status,
      body: (await response.json()) as {
        data?: unknown;
        error?: { code?: string };
      },
    };
  }
  try {
    await database.connect();
    check(
      (
        await database.query(
          "select count(*)::int as n from public.questions where catalog_version=1",
        )
      ).rows[0].n === 15,
    );
    phase = "independent real anonymous identities";
    const identities = await Promise.allSettled([
      identity(),
      identity(),
      identity(),
    ]);
    const [a, b, c] = identities.map((result) => {
      if (result.status !== "fulfilled") throw new Error("Auth failed.");
      return result.value;
    });
    check(new Set(userIds).size === 3);
    const created = parseCreatedSession(
      await rpc(a.client, "fsm_create_session", { p_request_id: randomUUID() }),
    );
    check(created.invitation);
    const joined = parseRedeemedSession(
      await rpc(b.client, "fsm_redeem_invitation", {
        p_token: created.invitation.token,
      }),
    );
    const id = created.session.id;
    const load = async (client: SupabaseClient) =>
      parseQuestionnaire(
        await rpc(client, "fsm_get_questionnaire", { p_couple_id: id }),
      );
    let qa = await load(a.client),
      qb = await load(b.client);
    const save = async (
      client: SupabaseClient,
      q: Questionnaire,
      code: QuestionCode,
      value: unknown = questionnaireValues[code],
    ) =>
      parseQuestionnaire(
        await rpc(client, "fsm_save_answer", {
          p_couple_id: id,
          p_question_code: code,
          p_value: value,
          p_expected_revision: q.revision,
        }),
      );
    await run(
      "independent empty owner questionnaires and immutable catalog",
      async () => {
        check(
          qa.partnerId !== qb.partnerId &&
            qa.answers.length === 0 &&
            qb.answers.length === 0 &&
            qa.revision === 0 &&
            qb.revision === 0,
        );
        check(JSON.stringify(qa.questions) === JSON.stringify(questions));
        check(
          !!(
            await a.client
              .from("questions")
              .update({ title: "Unauthorized" })
              .eq("code", "monthly_income")
          ).error,
        );
        check(
          !!(await a.client.from("questions").insert({ code: "fake" })).error,
        );
      },
    );
    await run(
      "answer save and fresh load preserve exact cents and independent revisions",
      async () => {
        qa = await save(a.client, qa, "monthly_income", {
          kind: "money",
          cents: 501055,
        });
        const fresh = await load(a.client);
        check(
          fresh.revision === qa.revision &&
            fresh.answers[0].value.kind === "money" &&
            fresh.answers[0].value.cents === 501055,
        );
        qb = await load(b.client);
        check(qb.revision === 0 && qb.answers.length === 0);
        qb = await save(b.client, qb, "monthly_income", {
          kind: "money",
          cents: 300000,
        });
        qb = await save(b.client, qb, "discussion_note", {
          kind: "text",
          text: "B-only sample note",
        });
        qa = await save(a.client, qa, "discussion_note", {
          kind: "text",
          text: "A-only sample note",
        });
        check(
          !JSON.stringify((await load(a.client)).answers).includes(
            "B-only sample note",
          ),
        );
      },
    );
    await run(
      "A B and outsider C cannot read one another's raw answers through Data API",
      async () => {
        for (const [client, partnerId] of [
          [a.client, qb.partnerId],
          [b.client, qa.partnerId],
          [c.client, qa.partnerId],
        ] as const) {
          const result = await client
            .from("answers")
            .select("*")
            .eq("partner_id", partnerId);
          check(!result.error && result.data.length === 0);
        }
        const own = await a.client
          .from("answers")
          .select("id")
          .eq("partner_id", qa.partnerId);
        check(!own.error && own.data.length === 2);
        await denied(
          c.client,
          "fsm_get_questionnaire",
          { p_couple_id: id },
          "NOT_FOUND",
        );
        await denied(a.client, "fsm_get_questionnaire", {
          p_couple_id: id,
          p_partner_id: qb.partnerId,
        });
      },
    );
    await run(
      "direct writes and forged partner IDs cannot bypass owner RPCs",
      async () => {
        check(
          !!(
            await a.client
              .from("answers")
              .update({ value: { kind: "money", cents: 1 } })
              .eq("partner_id", qb.partnerId)
          ).error,
        );
        check(
          !!(
            await a.client
              .from("answers")
              .delete()
              .eq("partner_id", qa.partnerId)
          ).error,
        );
        check(
          !!(
            await c.client
              .from("answers")
              .insert({
                couple_id: id,
                partner_id: qa.partnerId,
                catalog_version: 1,
                question_code: "monthly_income",
                value: { kind: "money", cents: 1 },
              })
          ).error,
        );
        await denied(a.client, "fsm_save_answer", {
          p_couple_id: id,
          p_partner_id: qb.partnerId,
          p_question_code: "monthly_income",
          p_value: { kind: "money", cents: 1 },
          p_expected_revision: qa.revision,
        });
      },
    );
    await run(
      "SQL validation rejects malformed values without changing answers or revisions",
      async () => {
        const invalid: [string, unknown][] = [
          ...[-1, 1.5, 1000000000001, "100", null].map(
            (value) =>
              ["monthly_income", { kind: "money", cents: value }] as [
                string,
                unknown,
              ],
          ),
          [
            "monthly_income",
            { kind: "money", cents: 1, partnerId: qb.partnerId },
          ],
          ["unknown", { kind: "money", cents: 1 }],
          ["monthly_income", { kind: "text", text: "1" }],
          [
            "shared_categories",
            { kind: "multiple_choice", values: ["rent", "rent"] },
          ],
          ["shared_categories", { kind: "multiple_choice", values: [] }],
          ["split_preference", { kind: "single_choice", value: "unknown" }],
          ["comfortable_income_share", { kind: "slider", basisPoints: 2501 }],
          ["discussion_note", { kind: "text", text: "x".repeat(501) }],
        ];
        for (const [code, value] of invalid)
          await denied(
            a.client,
            "fsm_save_answer",
            {
              p_couple_id: id,
              p_question_code: code,
              p_value: value,
              p_expected_revision: qa.revision,
            },
            "INVALID_INPUT",
          );
        check((await load(a.client)).revision === qa.revision);
      },
    );
    await run(
      "answer trigger also validates privileged writes to test-owned rows",
      async () => {
        let rejected = false;
        await database.query("begin");
        try {
          await database.query(
            "update public.answers set value=$1::jsonb where id=$2",
            [
              JSON.stringify({ kind: "money", cents: -1 }),
              qa.answers.find(
                (answer) => answer.questionCode === "monthly_income",
              )!.id,
            ],
          );
        } catch {
          rejected = true;
        } finally {
          await database.query("rollback");
        }
        check(rejected);
      },
    );
    await run(
      "incomplete submission and consent grants on drafts are rejected",
      async () => {
        await denied(
          a.client,
          "fsm_submit_questionnaire",
          {
            p_couple_id: id,
            p_expected_revision: qa.revision,
            p_comparison: false,
            p_budget: false,
          },
          "QUESTIONNAIRES_INCOMPLETE",
        );
        await denied(
          a.client,
          "fsm_update_privacy",
          {
            p_couple_id: id,
            p_expected_revision: qa.revision,
            p_comparison: true,
            p_budget: true,
          },
          "INVALID_STATE",
        );
      },
    );
    await run(
      "concurrent saves using one owner revision have exactly one winner",
      async () => {
        const results = await Promise.all(
          ["personal_obligations", "shared_budget_estimate"].map((code) =>
            a.client.rpc("fsm_save_answer", {
              p_couple_id: id,
              p_question_code: code,
              p_value: { kind: "money", cents: 0 },
              p_expected_revision: qa.revision,
            }),
          ),
        );
        check(
          results.filter((result) => !result.error).length === 1 &&
            results.some(
              (result) => result.error?.message === "STALE_REVISION",
            ),
        );
        qa = await load(a.client);
      },
    );
    await run(
      "A and B can save concurrently with independent revisions",
      async () => {
        const [aa, bb] = await Promise.all([
          save(a.client, qa, "personal_obligations"),
          save(b.client, qb, "personal_obligations"),
        ]);
        qa = aa;
        qb = bb;
      },
    );
    for (const q of questions.filter((q) => q.required)) {
      if (!qa.answers.some((answer) => answer.questionCode === q.code))
        qa = await save(a.client, qa, q.code);
      if (!qb.answers.some((answer) => answer.questionCode === q.code))
        qb = await save(b.client, qb, q.code);
    }
    await run(
      "submission stores independent comparison and budget permissions",
      async () => {
        qa = parseQuestionnaire(
          await rpc(a.client, "fsm_submit_questionnaire", {
            p_couple_id: id,
            p_expected_revision: qa.revision,
            p_comparison: true,
            p_budget: false,
          }),
        );
        qb = parseQuestionnaire(
          await rpc(b.client, "fsm_submit_questionnaire", {
            p_couple_id: id,
            p_expected_revision: qb.revision,
            p_comparison: false,
            p_budget: true,
          }),
        );
        check(
          qa.status === "submitted" &&
            qa.consent.comparison &&
            !qa.consent.budget &&
            !qb.consent.comparison &&
            qb.consent.budget,
        );
        const session = (await rpc(a.client, "fsm_get_session", {
          p_couple_id: id,
        })) as { stage: string };
        check(session.stage !== "ready_for_shared_planning");
      },
    );
    await run(
      "submitted answers cannot change until the owner reopens",
      async () => {
        await denied(
          a.client,
          "fsm_save_answer",
          {
            p_couple_id: id,
            p_question_code: "monthly_income",
            p_value: { kind: "money", cents: 0 },
            p_expected_revision: qa.revision,
          },
          "INVALID_STATE",
        );
      },
    );
    await run(
      "consent withdrawal is revisioned and stale privacy writes cannot restore permission",
      async () => {
        const oldRevision = qa.revision;
        qa = parseQuestionnaire(
          await rpc(a.client, "fsm_update_privacy", {
            p_couple_id: id,
            p_expected_revision: qa.revision,
            p_comparison: false,
            p_budget: false,
          }),
        );
        check(
          !qa.consent.comparison &&
            !qa.consent.budget &&
            qa.revision === oldRevision + 1,
        );
        await denied(
          a.client,
          "fsm_update_privacy",
          {
            p_couple_id: id,
            p_expected_revision: oldRevision,
            p_comparison: true,
            p_budget: true,
          },
          "STALE_REVISION",
        );
        check(
          !!(
            await a.client
              .from("partners")
              .update({ budget_consent_at: new Date().toISOString() })
              .eq("id", qa.partnerId)
          ).error,
        );
      },
    );
    await run(
      "even both consents never expose raw answers or private notes",
      async () => {
        qa = parseQuestionnaire(
          await rpc(a.client, "fsm_update_privacy", {
            p_couple_id: id,
            p_expected_revision: qa.revision,
            p_comparison: true,
            p_budget: true,
          }),
        );
        qb = parseQuestionnaire(
          await rpc(b.client, "fsm_update_privacy", {
            p_couple_id: id,
            p_expected_revision: qb.revision,
            p_comparison: true,
            p_budget: true,
          }),
        );
        const result = await a.client
          .from("answers")
          .select("*")
          .eq("partner_id", qb.partnerId);
        check(!result.error && result.data.length === 0);
        check(
          !(await load(a.client)).answers.some(
            (answer) => answer.partnerId === joined.partner.id,
          ),
        );
      },
    );
    await run(
      "reopening preserves answers and clears submission and both consents",
      async () => {
        const count = qa.answers.length;
        qa = parseQuestionnaire(
          await rpc(a.client, "fsm_reopen_questionnaire", {
            p_couple_id: id,
            p_expected_revision: qa.revision,
          }),
        );
        check(
          qa.status === "draft" &&
            qa.submittedAt === null &&
            !qa.consent.comparison &&
            !qa.consent.budget &&
            qa.answers.length === count,
        );
        qa = await save(a.client, qa, "monthly_income", {
          kind: "money",
          cents: 600001,
        });
        check(
          (await load(a.client)).answers.find(
            (answer) => answer.questionCode === "monthly_income",
          )?.value.kind === "money",
        );
      },
    );
    await run(
      "all five Edge operations validate real identities and forged bodies",
      async () => {
        const path = `/couples/${id}`;
        const loaded = await api(`${path}/questionnaire`, a.jwt);
        check(
          loaded.status === 200 &&
            parseQuestionnaire(loaded.body.data).partnerId === qa.partnerId,
        );
        const outsider = await api(`${path}/questionnaire`, c.jwt);
        check(outsider.status === 404);
        const forged = await api(
          `${path}/answers/monthly_income`,
          a.jwt,
          "PUT",
          {
            questionCode: "monthly_income",
            value: { kind: "money", cents: 1 },
            expectedRevision: qa.revision,
            partnerId: qb.partnerId,
          },
        );
        check(forged.status === 400);
        const saved = await api(
          `${path}/answers/monthly_income`,
          a.jwt,
          "PUT",
          {
            questionCode: "monthly_income",
            value: { kind: "money", cents: 501055 },
            expectedRevision: qa.revision,
          },
        );
        check(saved.status === 200);
        qa = parseQuestionnaire(saved.body.data);
        const submitted = await api(
          `${path}/questionnaire/submit`,
          a.jwt,
          "POST",
          {
            expectedRevision: qa.revision,
            consent: { comparison: false, budget: false },
          },
        );
        check(submitted.status === 200);
        qa = parseQuestionnaire(submitted.body.data);
        const privacy = await api(`${path}/privacy`, a.jwt, "PATCH", {
          expectedRevision: qa.revision,
          consent: { comparison: true, budget: false },
        });
        check(privacy.status === 200);
        qa = parseQuestionnaire(privacy.body.data);
        const reopened = await api(
          `${path}/questionnaire/reopen`,
          a.jwt,
          "POST",
          { expectedRevision: qa.revision },
        );
        check(reopened.status === 200);
        qa = parseQuestionnaire(reopened.body.data);
      },
    );
    await run(
      "expired membership loses both questionnaire RPC and direct answer access",
      async () => {
        await database.query(
          "update public.partners set access_expires_at=clock_timestamp()+interval '50 milliseconds' where id=$1",
          [qb.partnerId],
        );
        await new Promise((resolve) => setTimeout(resolve, 100));
        await denied(
          b.client,
          "fsm_get_questionnaire",
          { p_couple_id: id },
          "NOT_FOUND",
        );
        const result = await b.client
          .from("answers")
          .select("id")
          .eq("partner_id", qb.partnerId);
        check(!result.error && result.data.length === 0);
      },
    );
    console.log(`Completed ${checks} real questionnaire security checks.`);
  } catch {
    throw new Error(
      `Questionnaire security failed at: ${phase}. Private payloads and credentials suppressed.`,
    );
  } finally {
    try {
      if (userIds.length) {
        await database.query(
          "delete from public.couples where created_by_auth_user_id=any($1::uuid[])",
          [userIds],
        );
        await database.query(
          "delete from auth.users u where u.id=any($1::uuid[]) and not exists(select 1 from public.partners p where p.auth_user_id=u.id) and not exists(select 1 from public.couples c where c.created_by_auth_user_id=u.id)",
          [userIds],
        );
      }
    } catch {
      cleanupFailed = true;
      console.error(
        "Cleanup failed; inspect only this suite's test-created records.",
      );
    }
    await Promise.all(
      clients.map((client) =>
        client.auth.signOut({ scope: "local" }).catch(() => undefined),
      ),
    );
    await database.end().catch(() => undefined);
  }
  if (cleanupFailed)
    throw new Error("Targeted questionnaire test cleanup failed.");
}
main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : "Questionnaire tests failed; credentials suppressed.",
  );
  process.exitCode = 1;
});
