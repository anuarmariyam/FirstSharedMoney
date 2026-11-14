import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Client } from "pg";
import { PDFDocument } from "pdf-lib";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { liveEnvironment } from "../tests/live/environment.ts";
import { submitFinanceFixture } from "../tests/live/finance-fixture.ts";
import { parseCreatedSession } from "../supabase/functions/_shared/session-contract.ts";
import { parseAgreement } from "../supabase/functions/_shared/agreement-contract.ts";
import { parseQuestionnaire } from "../supabase/functions/_shared/questionnaire-contract.ts";
import { financialInput } from "../src/engines/financial.ts";
import { parseScenario } from "../supabase/functions/_shared/finance-contract.ts";
import type {
  AgreementVersion,
  FinancialScenario,
} from "../src/types/domain.ts";

async function main() {
  const env = liveEnvironment();
  if (env.ref !== "lgboxbtxutgggvluhhqt") throw new Error("Unexpected target");
  const db = new Client({
    connectionString: env.databaseURL,
    ssl: {
      rejectUnauthorized: true,
      ...(env.caFile ? { ca: readFileSync(env.caFile, "utf8") } : {}),
    },
    connectionTimeoutMillis: 10000,
    statement_timeout: 15000,
  });
  const ids: string[] = [],
    clients: SupabaseClient[] = [];
  let phase = "connect",
    checks = 0,
    cleanupFailed = false,
    lastStatus = 0,
    lastCode = "";
  function check(value: unknown): asserts value {
    if (!value) throw new Error("Assertion failed");
  }
  async function run(label: string, fn: () => Promise<void>) {
    phase = label;
    await fn();
    checks++;
    console.log("PASS " + label);
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
    const r = await client.auth.signInAnonymously();
    if (r.data.user) ids.push(r.data.user.id);
    check(!r.error && r.data.session && r.data.user?.is_anonymous);
    return { client, jwt: r.data.session.access_token, id: r.data.user.id };
  }
  async function rpc(
    client: SupabaseClient,
    name: string,
    args: Record<string, unknown>,
  ) {
    const r = await client.rpc(name, args);
    check(!r.error);
    return r.data as unknown;
  }
  async function api(
    path: string,
    jwt: string,
    method = "GET",
    body?: unknown,
  ) {
    const r = await fetch(env.url + "/functions/v1/fsm-api/v1" + path, {
      method,
      headers: {
        Authorization: "Bearer " + jwt,
        apikey: env.key,
        Origin: env.appOrigin,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000),
    });
    lastStatus = r.status;
    if (r.headers.get("content-type")?.startsWith("application/pdf")) {
      lastCode = "PDF";
      return {
        status: r.status,
        data: undefined as unknown,
        error: "",
        pdf: new Uint8Array(await r.arrayBuffer()),
      };
    }
    const json = (await r.json()) as {
      data?: unknown;
      error?: { code?: string };
    };
    lastCode = json.error?.code ?? "";
    return { status: r.status, data: json.data, error: lastCode, pdf: null };
  }
  try {
    await db.connect();
    phase = "independent A B C identities";
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
      path = `/couples/${couple}`,
      base = path + "/agreement-versions";
    await rpc(b.client, "fsm_redeem_invitation", {
      p_token: created.invitation.token,
    });
    await submitFinanceFixture(
      a.client,
      couple,
      {},
      { comparison: true, budget: true },
    );
    let qb = await submitFinanceFixture(
      b.client,
      couple,
      {},
      { comparison: true, budget: true },
    );
    async function scenario(
      stress: unknown = null,
    ): Promise<FinancialScenario> {
      const source = financialInput(
        (await api(path + "/financial-inputs", a.jwt)).data,
      );
      const r = await api(path + "/scenarios", a.jwt, "POST", {
        requestId: randomUUID(),
        expectedRevisions: source.sourceRevisions,
        sharedExpenses: {
          rent: 220000,
          utilities: 30000,
          groceries: 50000,
          other: 20000,
          shared_savings: 20000,
        },
        sharedEmergencyFundCents: 60000,
        model: { kind: "proportional" },
        stressTest: stress,
      });
      check(r.status === 201);
      return parseScenario(r.data);
    }
    let s = await scenario();
    const rules = {
      personalSpending: "independent",
      debtExpectation: "individual_responsibility",
      largePurchaseThresholdCents: 50000,
      emergencyRule: "discuss_before_spending",
      reviewFrequency: "monthly",
      nextReviewDate: new Date(Date.now() + 30 * 86400000)
        .toISOString()
        .slice(0, 10),
    };
    const createBody = (head: string | null, source = s.id) => ({
      requestId: randomUUID(),
      expectedHeadVersionId: head,
      sourceScenarioId: source,
      rules,
    });
    const action = (v: AgreementVersion) => ({
      expectedHeadVersionId: v.id,
      expectedContentHash: v.contentHash,
    });
    let v!: AgreementVersion;
    let old!: AgreementVersion;
    await run(
      "new sessions have no agreement and an available baseline creates nine exact terms",
      async () => {
        const empty = await api(base + "/current", a.jwt);
        check(empty.status === 200 && empty.data === null);
        const r = await api(base, a.jwt, "POST", createBody(null));
        check(r.status === 201);
        v = parseAgreement(r.data);
        check(
          v.status === "draft" &&
            v.items.length === 9 &&
            v.versionNumber === 1 &&
            v.approvals.state === "none",
        );
        check(
          s.output.split.status === "available" &&
            v.financialSummary.monthlySharedTotalCents ===
              s.output.split.monthlySharedTotalCents,
        );
      },
    );
    await run(
      "server content hash recomputes from canonical terms without raw financial answers",
      async () => {
        const r = await db.query(
          "select content_hash=encode(extensions.digest(fsm_private.agreement_content(fsm_private.agreement_payload(id))::text,'sha256'),'hex') as valid from public.agreement_versions where id=$1",
          [v.id],
        );
        check(r.rows[0].valid);
        const text = JSON.stringify(v);
        for (const word of [
          "monthlyNetIncome",
          "PersonalObligations",
          "discussion_note",
          "auth_user_id",
          "input_snapshot",
        ])
          check(!text.includes(word));
      },
    );
    await run(
      "draft cannot be approved or exported and explicit proposal changes only lifecycle",
      async () => {
        check(
          (await api(`${base}/${v.id}/approve`, a.jwt, "POST", action(v)))
            .error === "INVALID_STATE",
        );
        check(
          (await api(`${base}/${v.id}/pdf`, a.jwt, "POST", action(v))).error ===
            "INVALID_STATE",
        );
        const r = await api(
          `${base}/${v.id}/propose`,
          a.jwt,
          "POST",
          action(v),
        );
        check(r.status === 200);
        const next = parseAgreement(r.data);
        check(next.status === "proposed" && next.contentHash === v.contentHash);
        v = next;
      },
    );
    await run(
      "first independent approval and concurrent duplicate calls create exactly one confirmation",
      async () => {
        const rs = await Promise.all([
          api(`${base}/${v.id}/approve`, a.jwt, "POST", action(v)),
          api(`${base}/${v.id}/approve`, a.jwt, "POST", action(v)),
        ]);
        check(rs.every((r) => r.status === 200));
        v = parseAgreement(rs[1].data);
        check(
          v.status === "under_review" &&
            v.approvals.state === "one" &&
            !!v.approvals.A &&
            !v.approvals.B,
        );
        const n = await db.query(
          "select count(*)::int n from public.approvals where version_id=$1",
          [v.id],
        );
        check(n.rows[0].n === 1);
        check(
          (await api(`${base}/${v.id}/pdf`, a.jwt, "POST", action(v))).error ===
            "INVALID_STATE",
        );
      },
    );
    await run(
      "deferred integrity prevents approved status with only one real approval",
      async () => {
        let denied = false;
        await db.query("begin");
        try {
          await db.query("select set_config('request.jwt.claims',$1,true)", [
            JSON.stringify({ sub: b.id, role: "authenticated" }),
          ]);
          await db.query(
            "update public.agreement_versions set status='approved',approved_at=clock_timestamp() where id=$1",
            [v.id],
          );
          await db.query("set constraints all immediate");
        } catch (e) {
          denied =
            !!e && typeof e === "object" && "code" in e && e.code === "P0001";
        } finally {
          await db.query("rollback");
        }
        check(denied);
      },
    );
    await run(
      "second identity approves the exact same hash and both retries remain idempotent",
      async () => {
        const r = await api(
          `${base}/${v.id}/approve`,
          b.jwt,
          "POST",
          action(v),
        );
        check(r.status === 200);
        v = parseAgreement(r.data);
        check(v.status === "approved" && v.approvals.state === "both");
        for (const who of [a, b]) {
          const retry = await api(
            `${base}/${v.id}/approve`,
            who.jwt,
            "POST",
            action(v),
          );
          check(
            retry.status === 200 &&
              JSON.stringify(retry.data) === JSON.stringify(v),
          );
        }
        old = v;
      },
    );
    await run(
      "A and B can repeatedly export the verified approved PDF",
      async () => {
        for (const who of [a, b, a]) {
          const r = await api(
            `${base}/${v.id}/pdf`,
            who.jwt,
            "POST",
            action(v),
          );
          check(r.status === 200 && r.pdf);
          const pdf = await PDFDocument.load(r.pdf);
          check(
            pdf.getTitle() === "First Money Agreement" &&
              pdf.getSubject()?.includes(v.contentHash),
          );
        }
      },
    );
    await run(
      "outsider C cannot read approve export or access raw agreement tables",
      async () => {
        for (const suffix of ["/current", "/" + v.id])
          check((await api(base + suffix, c.jwt)).status === 404);
        for (const command of ["propose", "approve", "pdf"])
          check(
            (await api(`${base}/${v.id}/${command}`, c.jwt, "POST", action(v)))
              .status === 404,
          );
        for (const table of [
          "agreement_versions",
          "agreement_items",
          "approvals",
        ]) {
          const r = await c.client
            .from(table)
            .select("*")
            .eq("couple_id", couple);
          check(!r.error && r.data.length === 0);
        }
      },
    );
    await run(
      "forged partner identity hash version and direct Data API writes cannot bypass checks",
      async () => {
        check(
          (
            await api(`${base}/${v.id}/approve`, a.jwt, "POST", {
              ...action(v),
              partnerId: created.session.viewerPartnerId,
            })
          ).status === 400,
        );
        check(
          (
            await api(`${base}/${v.id}/approve`, a.jwt, "POST", {
              ...action(v),
              expectedContentHash: "b".repeat(64),
            })
          ).error === "STALE_VERSION",
        );
        check(
          (
            await api(`${base}/${v.id}/approve`, a.jwt, "POST", {
              ...action(v),
              expectedHeadVersionId: randomUUID(),
            })
          ).error === "STALE_VERSION",
        );
        const insert = await a.client
          .from("approvals")
          .insert({
            couple_id: couple,
            version_id: v.id,
            partner_id: v.createdByPartnerId,
            content_hash: v.contentHash,
          });
        check(!!insert.error);
        const edit = await a.client
          .from("agreement_versions")
          .update({ content_hash: "b".repeat(64) })
          .eq("id", v.id);
        check(!!edit.error);
      },
    );
    await run(
      "approved content and items reject privileged updates or individual deletes",
      async () => {
        for (const command of [
          "update public.agreement_versions set content_hash=repeat('b',64) where id=$1",
          "update public.agreement_items set value='{}'::jsonb where version_id=$1",
          "delete from public.agreement_items where version_id=$1",
        ]) {
          let rejected = false;
          await db.query("begin");
          try {
            await db.query(command, [v.id]);
          } catch {
            rejected = true;
          } finally {
            await db.query("rollback");
          }
          check(rejected);
        }
      },
    );
    await run(
      "editing creates a different immutable version with zero approvals and retry-safe request ID",
      async () => {
        const body = {
          ...createBody(v.id),
          rules: { ...rules, largePurchaseThresholdCents: 75000 },
        };
        const r = await api(base, a.jwt, "POST", body);
        check(r.status === 201);
        v = parseAgreement(r.data);
        check(
          v.id !== old.id &&
            v.contentHash !== old.contentHash &&
            v.parentVersionId === old.id &&
            v.versionNumber === 2 &&
            v.approvals.state === "none" &&
            v.status === "draft",
        );
        const retry = await api(base, a.jwt, "POST", body);
        check(retry.status === 200 && parseAgreement(retry.data).id === v.id);
        check(
          (await api(base, a.jwt, "POST", { ...body, rules })).error ===
            "REQUEST_ID_REUSED",
        );
        check(
          (await api(`${base}/${old.id}/approve`, b.jwt, "POST", action(old)))
            .error === "STALE_VERSION",
        );
        check(
          (await api(`${base}/${old.id}/pdf`, a.jwt, "POST", action(old)))
            .error === "STALE_VERSION",
        );
        const historic = parseAgreement(
          (await api(`${base}/${old.id}`, a.jwt)).data,
        );
        check(
          historic.status === "approved" && historic.approvals.state === "both",
        );
      },
    );
    await run(
      "concurrent different partners approve only the same current version",
      async () => {
        v = parseAgreement(
          (await api(`${base}/${v.id}/propose`, b.jwt, "POST", action(v))).data,
        );
        const rs = await Promise.all([
          api(`${base}/${v.id}/approve`, a.jwt, "POST", action(v)),
          api(`${base}/${v.id}/approve`, b.jwt, "POST", action(v)),
        ]);
        check(rs.every((r) => r.status === 200));
        v = parseAgreement((await api(base + "/current", a.jwt)).data);
        check(v.status === "approved" && v.approvals.state === "both");
      },
    );
    await run(
      "an edit racing an approval never transfers a confirmation to the new head",
      async () => {
        v = parseAgreement(
          (await api(base, a.jwt, "POST", createBody(v.id))).data,
        );
        v = parseAgreement(
          (await api(`${base}/${v.id}/propose`, a.jwt, "POST", action(v))).data,
        );
        const previous = v;
        const [edit, approve] = await Promise.all([
          api(base, a.jwt, "POST", createBody(v.id)),
          api(`${base}/${v.id}/approve`, b.jwt, "POST", action(v)),
        ]);
        check(
          edit.status === 201 &&
            (approve.status === 200 || approve.error === "STALE_VERSION"),
        );
        v = parseAgreement((await api(base + "/current", a.jwt)).data);
        check(
          v.id !== previous.id &&
            v.status === "draft" &&
            v.approvals.state === "none",
        );
      },
    );
    await run(
      "stale-head races and stress scenarios cannot become an accidental agreement",
      async () => {
        check(
          (await api(base, a.jwt, "POST", createBody(old.id))).error ===
            "STALE_VERSION",
        );
        const stress = await scenario({
          kind: "rent_increase",
          increaseCents: 30000,
        });
        check(
          (await api(base, a.jwt, "POST", createBody(v.id, stress.id)))
            .error === "SCENARIO_UNAVAILABLE",
        );
        check(
          (
            await api(
              base,
              a.jwt,
              "POST",
              createBody(v.id, randomUUID() as typeof s.id),
            )
          ).status === 404,
        );
      },
    );
    await run(
      "revoked budget permission blocks proposal approval creation and export immediately",
      async () => {
        qb = parseQuestionnaire(
          await rpc(b.client, "fsm_update_privacy", {
            p_couple_id: couple,
            p_expected_revision: qb.revision,
            p_comparison: true,
            p_budget: false,
          }),
        );
        for (const command of ["propose", "approve", "pdf"])
          check(
            (await api(`${base}/${v.id}/${command}`, a.jwt, "POST", action(v)))
              .error === "CONSENT_REQUIRED",
          );
        check(
          (await api(base, a.jwt, "POST", createBody(v.id))).error ===
            "CONSENT_REQUIRED",
        );
        const historical = parseAgreement(
          (await api(base + "/current", a.jwt)).data,
        );
        check(historical.id === v.id);
      },
    );
    await run(
      "regrant does not revive stale scenarios or approval/export eligibility",
      async () => {
        qb = parseQuestionnaire(
          await rpc(b.client, "fsm_update_privacy", {
            p_couple_id: couple,
            p_expected_revision: qb.revision,
            p_comparison: true,
            p_budget: true,
          }),
        );
        check(
          (await api(`${base}/${v.id}/propose`, a.jwt, "POST", action(v)))
            .error === "INPUTS_CHANGED",
        );
        check(
          (await api(base, a.jwt, "POST", createBody(v.id))).error ===
            "INPUTS_CHANGED",
        );
        s = await scenario();
        v = parseAgreement(
          (await api(base, a.jwt, "POST", createBody(v.id))).data,
        );
        check(
          v.sourceRevisions.B === qb.revision && v.approvals.state === "none",
        );
      },
    );
    await run(
      "direct RPC cannot forge identities and private questionnaire answers stay owner-only",
      async () => {
        const forged = await a.client.rpc("fsm_approve_agreement", {
          p_couple_id: couple,
          p_version_id: v.id,
          p_expected_hash: v.contentHash,
          p_partner_id: v.createdByPartnerId,
        });
        check(!!forged.error);
        const wrong = await c.client.rpc("fsm_get_agreement", {
          p_couple_id: couple,
          p_version_id: v.id,
        });
        check(!!wrong.error);
        const rows = await a.client
          .from("answers")
          .select("partner_id")
          .eq("couple_id", couple);
        check(
          !rows.error &&
            rows.data.every(
              (r) => r.partner_id === created.session.viewerPartnerId,
            ),
        );
      },
    );
    await run(
      "cross-couple identifiers cannot select a foreign agreement or scenario",
      async () => {
        const other = parseCreatedSession(
          await rpc(c.client, "fsm_create_session", {
            p_request_id: randomUUID(),
          }),
        );
        check(
          (
            await api(
              `/couples/${other.session.id}/agreement-versions/${v.id}`,
              c.jwt,
            )
          ).status === 404,
        );
        check(
          (
            await api(
              `/couples/${other.session.id}/agreement-versions/${v.id}/pdf`,
              c.jwt,
              "POST",
              action(v),
            )
          ).status === 409,
        );
        check(
          (
            await api(
              `/couples/${other.session.id}/agreement-versions/current`,
              a.jwt,
            )
          ).status === 404,
        );
      },
    );
    await run(
      "expired members lose historical reads and cannot progress the workflow",
      async () => {
        await db.query(
          "update public.partners set access_expires_at=clock_timestamp()-interval '1 second' where couple_id=$1 and auth_user_id=$2",
          [couple, b.id],
        );
        check((await api(base + "/current", b.jwt)).status === 404);
        const direct = await b.client
          .from("agreement_versions")
          .select("id")
          .eq("couple_id", couple);
        check(!direct.error && direct.data.length === 0);
        check(
          (await api(`${base}/${v.id}/propose`, a.jwt, "POST", action(v)))
            .status !== 200,
        );
      },
    );
    console.log(`Completed ${checks} real agreement security checks.`);
  } catch {
    throw new Error(
      `Agreement security failed at: ${phase}. Last sanitized API status ${lastStatus}, code ${lastCode || "none"}. Credentials and payloads suppressed.`,
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
        "Agreement test cleanup failed; inspect only test-owned records.",
      );
    }
    await Promise.all(
      clients.map((c) =>
        c.auth.signOut({ scope: "local" }).catch(() => undefined),
      ),
    );
    await db.end().catch(() => undefined);
  }
  if (cleanupFailed) throw new Error("Targeted agreement cleanup failed");
}
main().catch((e) => {
  console.error(
    e instanceof Error
      ? e.message
      : "Agreement tests failed; details suppressed.",
  );
  process.exitCode = 1;
});
