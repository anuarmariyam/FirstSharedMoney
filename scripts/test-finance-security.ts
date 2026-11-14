import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Client } from "pg";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { liveEnvironment } from "../tests/live/environment.ts";
import { submitFinanceFixture } from "../tests/live/finance-fixture.ts";
import { parseCreatedSession } from "../supabase/functions/_shared/session-contract.ts";
import {
  parseComparison,
  parseScenario,
} from "../supabase/functions/_shared/finance-contract.ts";
import {
  financialEngine,
  financialInput,
  money,
} from "../src/engines/financial.ts";
import { sameJSON } from "../supabase/functions/_shared/questionnaire-contract.ts";
import type {
  FinancialInput,
  FinancialScenario,
  Questionnaire,
  StressTestScenario,
} from "../src/types/domain.ts";

async function main() {
  const env = liveEnvironment();
  if (env.ref !== "lgboxbtxutgggvluhhqt")
    throw new Error("Unexpected test target.");
  const db = new Client({
    connectionString: env.databaseURL,
    ssl: {
      rejectUnauthorized: true,
      ...(env.caFile ? { ca: readFileSync(env.caFile, "utf8") } : {}),
    },
    connectionTimeoutMillis: 10000,
    statement_timeout: 10000,
  });
  const ids: string[] = [],
    clients: SupabaseClient[] = [];
  let phase = "connect",
    checks = 0,
    cleanupFailed = false;
  function check(value: unknown): asserts value {
    if (!value) throw new Error("Finance security assertion failed.");
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
    const result = await client.auth.signInAnonymously();
    if (result.data.user) ids.push(result.data.user.id);
    check(
      !result.error && result.data.session && result.data.user?.is_anonymous,
    );
    return {
      client,
      jwt: result.data.session.access_token,
      id: result.data.user.id,
    };
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
    await db.connect();
    phase = "real A/B/C authentication";
    const settled = await Promise.allSettled([
      identity(),
      identity(),
      identity(),
    ]);
    const [a, b, c] = settled.map((r) => {
      if (r.status !== "fulfilled") throw new Error("Auth failed");
      return r.value;
    });
    check(new Set(ids).size === 3);
    const created = parseCreatedSession(
      await rpc(a.client, "fsm_create_session", { p_request_id: randomUUID() }),
    );
    check(created.invitation);
    const couple = created.session.id,
      path = `/couples/${couple}`;
    await rpc(b.client, "fsm_redeem_invitation", {
      p_token: created.invitation.token,
    });
    let qa = await submitFinanceFixture(
      a.client,
      couple,
      {
        monthly_income: { kind: "money", cents: money(500000) },
        personal_obligations: { kind: "money", cents: money(60000) },
        discussion_note: { kind: "text", text: "PRIVATE_A_DO_NOT_COMPARE" },
      },
      { comparison: false, budget: false },
    );
    await run(
      "incomplete peer questionnaires block both shared projections",
      async () => {
        check(
          (await api(`${path}/comparison`, a.jwt)).body.error?.code ===
            "QUESTIONNAIRES_INCOMPLETE",
        );
        check(
          (await api(`${path}/financial-inputs`, a.jwt)).body.error?.code ===
            "QUESTIONNAIRES_INCOMPLETE",
        );
      },
    );
    let qb = await submitFinanceFixture(
      b.client,
      couple,
      {
        monthly_income: { kind: "money", cents: money(300000) },
        personal_obligations: { kind: "money", cents: money(30000) },
        split_preference: { kind: "single_choice", value: "proportional" },
        discussion_note: { kind: "text", text: "PRIVATE_B_DO_NOT_COMPARE" },
      },
      { comparison: false, budget: false },
    );
    async function privacy(
      client: SupabaseClient,
      q: Questionnaire,
      comparison: boolean,
      budget: boolean,
    ) {
      const result = await api(
        `${path}/privacy`,
        client === a.client ? a.jwt : b.jwt,
        "PATCH",
        { expectedRevision: q.revision, consent: { comparison, budget } },
      );
      check(result.status === 200);
      return (
        await import("../supabase/functions/_shared/questionnaire-contract.ts")
      ).parseQuestionnaire(result.body.data);
    }
    await run(
      "withheld comparison and budget consents each deny new requests",
      async () => {
        check((await api(`${path}/comparison`, a.jwt)).status === 403);
        check((await api(`${path}/financial-inputs`, a.jwt)).status === 403);
      },
    );
    await run(
      "internal raw-input and scenario-write RPCs deny A B C and forged actor IDs",
      async () => {
        for (const user of [a, b, c])
          for (const name of [
            "fsm_internal_financial_inputs",
            "fsm_internal_comparison_inputs",
          ]) {
            const result = await user.client.rpc(name, {
              p_couple_id: couple,
              p_verified_actor_user_id: a.id,
            });
            check(!!result.error);
          }
        const result = await a.client.rpc("fsm_internal_store_scenario", {
          p_couple_id: couple,
          p_verified_actor_user_id: a.id,
          p_request_id: randomUUID(),
          p_input: {},
          p_model: {},
          p_stress_test: null,
          p_output: {},
        });
        check(!!result.error);
      },
    );
    await run(
      "comparison consent alone returns derived differences without income obligations or notes",
      async () => {
        qa = await privacy(a.client, qa, true, false);
        qb = await privacy(b.client, qb, true, false);
        const response = await api(`${path}/comparison`, a.jwt);
        check(response.status === 200);
        const result = parseComparison(response.body.data);
        check(
          result.results.length === 11 &&
            result.results.some(
              (r) =>
                r.questionCode === "split_preference" &&
                r.status === "different",
            ),
        );
        const text = JSON.stringify(response.body.data);
        check(
          !/PRIVATE_|monthly_income|personal_obligations|discussion_note|500000|300000|"answers"|"cents"/.test(
            text,
          ),
        );
        check((await api(`${path}/financial-inputs`, a.jwt)).status === 403);
      },
    );
    let source: FinancialInput;
    await run(
      "budget permission independently supplies only the approved numeric projection",
      async () => {
        qa = await privacy(a.client, qa, false, true);
        qb = await privacy(b.client, qb, false, true);
        const response = await api(`${path}/financial-inputs`, a.jwt);
        check(response.status === 200);
        source = financialInput(response.body.data);
        check(
          source.partners.A.monthlyNetIncomeCents === 500000 &&
            source.partners.B.monthlyPersonalObligationsCents === 30000,
        );
        check((await api(`${path}/comparison`, a.jwt)).status === 403);
      },
    );
    const request = (
      model: unknown = { kind: "proportional" },
      stress: unknown = null,
    ) => ({
      requestId: randomUUID(),
      expectedRevisions: source.sourceRevisions,
      sharedExpenses: {
        rent: 320000,
        utilities: 0,
        groceries: 0,
        other: 0,
        shared_savings: 0,
      },
      sharedEmergencyFundCents: 60000,
      model,
      stressTest: stress,
    });
    let saved: FinancialScenario;
    await run(
      "server computes actual proportional contributions and immutable scenario DTO",
      async () => {
        const response = await api(
          `${path}/scenarios`,
          a.jwt,
          "POST",
          request(),
        );
        check(response.status === 200 || response.status === 201);
        saved = parseScenario(response.body.data);
        check(
          saved.output.split.status === "available" &&
            saved.output.split.allocations.A.monthlyContributionCents ===
              200000 &&
            saved.output.split.allocations.B.monthlyContributionCents ===
              120000,
        );
      },
    );
    await run(
      "five real stress scenarios match the pure engine without modifying questionnaires",
      async () => {
        const tests: StressTestScenario[] = [
          { kind: "rent_increase", increaseCents: money(30000) },
          {
            kind: "income_reduction",
            partnerSlot: "A",
            reductionBasisPoints: 2000 as never,
          },
          { kind: "unexpected_expense", amountCents: money(100000) },
          { kind: "income_loss", partnerSlot: "B" },
          { kind: "savings_change", monthlyTargetCents: money(50000) },
        ];
        for (const stress of tests) {
          const response = await api(
            `${path}/scenarios`,
            a.jwt,
            "POST",
            request({ kind: "equal" }, stress),
          );
          check(response.status === 200 || response.status === 201);
          const scenario = parseScenario(response.body.data);
          check(
            sameJSON(
              scenario.output,
              financialEngine.simulate(scenario.input, scenario.model, stress),
            ),
          );
          if (stress.kind === "unexpected_expense")
            check(
              scenario.output.reserveUsedCents === 60000 &&
                scenario.output.effectiveInput.oneOffSharedExpenseCents ===
                  40000,
            );
        }
        const fresh = financialInput(
          (await api(`${path}/financial-inputs`, a.jwt)).body.data,
        );
        check(sameJSON(fresh, source));
      },
    );
    await run(
      "request IDs are idempotent but cannot be reused for different inputs",
      async () => {
        const body = request();
        const first = await api(`${path}/scenarios`, a.jwt, "POST", body),
          second = await api(`${path}/scenarios`, a.jwt, "POST", body);
        check(
          parseScenario(first.body.data).id ===
            parseScenario(second.body.data).id,
        );
        const changed = await api(`${path}/scenarios`, a.jwt, "POST", {
          ...body,
          sharedEmergencyFundCents: 1,
        });
        check(
          changed.status === 409 &&
            changed.body.error?.code === "REQUEST_ID_REUSED",
        );
      },
    );
    await run(
      "active A B may reload saved scenarios but outsider C cannot",
      async () => {
        check(
          (await api(`${path}/scenarios/${saved.id}`, b.jwt)).status === 200,
        );
        check(
          (await api(`${path}/scenarios/${saved.id}`, c.jwt)).status === 404,
        );
        const visible = await b.client
          .from("financial_scenarios")
          .select("id")
          .eq("id", saved.id);
        check(!visible.error && visible.data.length === 1);
        const outside = await c.client
          .from("financial_scenarios")
          .select("id")
          .eq("id", saved.id);
        check(!outside.error && outside.data.length === 0);
      },
    );
    await run(
      "direct Data API writes and client-computed output injection are denied",
      async () => {
        check(
          !!(
            await a.client
              .from("financial_scenarios")
              .insert({
                couple_id: couple,
                created_by_partner_id: qa.partnerId,
              })
          ).error,
        );
        check(
          !!(
            await a.client
              .from("financial_scenarios")
              .update({ output_snapshot: {} })
              .eq("id", saved.id)
          ).error,
        );
        check(
          !!(
            await a.client
              .from("financial_scenarios")
              .delete()
              .eq("id", saved.id)
          ).error,
        );
        for (const extra of [
          { output: {} },
          { input: source },
          { verifiedActorUserId: c.id },
        ])
          check(
            (
              await api(`${path}/scenarios`, a.jwt, "POST", {
                ...request(),
                ...extra,
              })
            ).status === 400,
          );
      },
    );
    await run(
      "immutable trigger rejects even privileged edits to a test-owned scenario",
      async () => {
        let rejected = false;
        await db.query("begin");
        try {
          await db.query(
            "update public.financial_scenarios set output_snapshot='{}'::jsonb where id=$1",
            [saved.id],
          );
        } catch {
          rejected = true;
        } finally {
          await db.query("rollback");
        }
        check(rejected);
      },
    );
    await run(
      "stale request revisions cannot create a new scenario",
      async () => {
        const response = await api(`${path}/scenarios`, a.jwt, "POST", {
          ...request(),
          expectedRevisions: {
            A: source.sourceRevisions.A - 1,
            B: source.sourceRevisions.B,
          },
        });
        check(
          response.status === 409 &&
            response.body.error?.code === "INPUTS_CHANGED",
        );
      },
    );
    await run(
      "consent withdrawal blocks fresh Edge reads and raw scenario SELECT",
      async () => {
        qa = await privacy(a.client, qa, false, false);
        check((await api(`${path}/financial-inputs`, a.jwt)).status === 403);
        check(
          (await api(`${path}/scenarios/${saved.id}`, a.jwt)).status === 403,
        );
        const rows = await b.client
          .from("financial_scenarios")
          .select("id")
          .eq("id", saved.id);
        check(!rows.error && rows.data.length === 0);
      },
    );
    await run(
      "regranting consent does not revive snapshots from old revisions",
      async () => {
        qa = await privacy(a.client, qa, true, true);
        qb = await privacy(b.client, qb, true, true);
        const response = await api(`${path}/scenarios/${saved.id}`, a.jwt);
        check(
          response.status === 409 &&
            response.body.error?.code === "INPUTS_CHANGED",
        );
        const rows = await a.client
          .from("financial_scenarios")
          .select("id")
          .eq("id", saved.id);
        check(!rows.error && rows.data.length === 0);
      },
    );
    await run(
      "store transaction rechecks revisions after a simulated compute/commit race",
      async () => {
        let rejected = false;
        await db.query("begin");
        try {
          await db.query("set local role service_role");
          await db.query(
            "select public.fsm_internal_store_scenario($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb,$7::jsonb)",
            [
              couple,
              a.id,
              randomUUID(),
              JSON.stringify(saved.input),
              JSON.stringify(saved.model),
              saved.stressTest ? JSON.stringify(saved.stressTest) : null,
              JSON.stringify(saved.output),
            ],
          );
        } catch (error) {
          rejected =
            error instanceof Error && error.message === "INPUTS_CHANGED";
        } finally {
          await db.query("rollback");
        }
        check(rejected);
      },
    );
    await run(
      "SQL comparison projection excludes non-comparison fields before leaving the database",
      async () => {
        await db.query("begin");
        try {
          await db.query("set local role service_role");
          const result = await db.query(
            "select public.fsm_internal_comparison_inputs($1,$2) as data",
            [couple, a.id],
          );
          check(
            !/monthly_income|personal_obligations|discussion_note|PRIVATE_/.test(
              JSON.stringify(result.rows[0].data),
            ),
          );
        } finally {
          await db.query("rollback");
        }
      },
    );
    await run(
      "cross-couple scenario access is denied even to another couple's creator",
      async () => {
        const other = parseCreatedSession(
          await rpc(c.client, "fsm_create_session", {
            p_request_id: randomUUID(),
          }),
        );
        check(other.invitation);
        await rpc(b.client, "fsm_redeem_invitation", {
          p_token: other.invitation.token,
        });
        await submitFinanceFixture(
          c.client,
          other.session.id,
          {},
          { comparison: true, budget: true },
        );
        await submitFinanceFixture(
          b.client,
          other.session.id,
          {},
          { comparison: true, budget: true },
        );
        const otherPath = `/couples/${other.session.id}`;
        const otherInput = financialInput(
          (await api(`${otherPath}/financial-inputs`, c.jwt)).body.data,
        );
        const otherResult = await api(`${otherPath}/scenarios`, c.jwt, "POST", {
          ...request(),
          expectedRevisions: otherInput.sourceRevisions,
        });
        const otherScenario = parseScenario(otherResult.body.data);
        check(
          (await api(`${otherPath}/scenarios/${otherScenario.id}`, a.jwt))
            .status === 404,
        );
        check(
          (await api(`${path}/scenarios/${otherScenario.id}`, a.jwt)).status ===
            404,
        );
        const rows = await a.client
          .from("financial_scenarios")
          .select("id")
          .eq("id", otherScenario.id);
        check(!rows.error && rows.data.length === 0);
      },
    );
    await run("scenario quota is enforced under the couple lock", async () => {
      await db.query(
        "insert into public.financial_scenarios(couple_id,created_by_partner_id,client_request_id,request_fingerprint,source_revision_a,source_revision_b,input_snapshot,split_model,stress_test,output_snapshot) select couple_id,created_by_partner_id,gen_random_uuid(),request_fingerprint,source_revision_a,source_revision_b,input_snapshot,split_model,stress_test,output_snapshot from public.financial_scenarios cross join generate_series(1,30) where id=$1",
        [saved.id],
      );
      source = financialInput(
        (await api(`${path}/financial-inputs`, a.jwt)).body.data,
      );
      const response = await api(`${path}/scenarios`, a.jwt, "POST", request());
      check(
        response.status === 429 && response.body.error?.code === "RATE_LIMITED",
      );
    });
    console.log(`Completed ${checks} real finance security checks.`);
  } catch {
    throw new Error(
      `Finance security failed at: ${phase}. Credentials and private payloads suppressed.`,
    );
  } finally {
    try {
      if (ids.length) {
        await db.query(
          "delete from public.couples where created_by_auth_user_id=any($1::uuid[])",
          [ids],
        );
        await db.query(
          "delete from auth.users u where u.id=any($1::uuid[]) and not exists(select 1 from public.partners p where p.auth_user_id=u.id) and not exists(select 1 from public.couples c where c.created_by_auth_user_id=u.id)",
          [ids],
        );
      }
    } catch {
      cleanupFailed = true;
      console.error(
        "Finance test cleanup failed; inspect only test-created records.",
      );
    }
    await Promise.all(
      clients.map((client) =>
        client.auth.signOut({ scope: "local" }).catch(() => undefined),
      ),
    );
    await db.end().catch(() => undefined);
  }
  if (cleanupFailed) throw new Error("Targeted finance cleanup failed.");
}
main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : "Finance tests failed without credential logging.",
  );
  process.exitCode = 1;
});
