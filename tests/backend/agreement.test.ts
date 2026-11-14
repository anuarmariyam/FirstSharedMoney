import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { verifyAgreementPDF } from "../live/pdf-evidence.ts";
import { agreementFixture } from "./agreement-fixture.ts";
import {
  agreementRules,
  createAgreementRequest,
  agreementAction,
  parseAgreement,
  rulesFromAgreement,
} from "../../supabase/functions/_shared/agreement-contract.ts";
import { agreementPDF } from "../../supabase/functions/_shared/agreement-pdf.ts";
import { agreementPolicy } from "../../src/features/agreement/policy.ts";
import { createSessionHandler } from "../../supabase/functions/fsm-api/handler.ts";
import type { AgreementActorContext } from "../../src/types/engines.ts";

test("agreement rules enforce exact fields, literals, cents and a real bounded future date", () => {
  const rules = rulesFromAgreement(agreementFixture());
  assert.deepEqual(agreementRules(rules, true), rules);
  for (const patch of [
    { actor: "B" },
    { largePurchaseThresholdCents: 1.5 },
    { largePurchaseThresholdCents: -1 },
    { emergencyRule: "choose_for_me" },
    { nextReviewDate: "2026-02-30" },
    { nextReviewDate: "2001-01-01" },
    { nextReviewDate: "9999-01-01" },
  ])
    assert.throws(() => agreementRules({ ...rules, ...patch }, true));
  assert.doesNotThrow(() =>
    agreementRules({ ...rules, nextReviewDate: "2001-01-01" }),
  );
});
test("create and approval contracts reject actor, amounts, statuses and body-selected hashes", () => {
  const v = agreementFixture();
  const request = {
    requestId: crypto.randomUUID(),
    expectedHeadVersionId: null,
    sourceScenarioId: v.sourceScenarioId,
    rules: rulesFromAgreement(v),
  };
  assert.equal(createAgreementRequest(request).expectedHeadVersionId, null);
  for (const key of [
    "partnerId",
    "output",
    "approvals",
    "financialSummary",
    "contentHash",
  ])
    assert.throws(() => createAgreementRequest({ ...request, [key]: {} }));
  const action = {
    expectedHeadVersionId: v.id,
    expectedContentHash: v.contentHash,
  };
  assert.deepEqual(agreementAction(action), action);
  assert.throws(() =>
    agreementAction({ ...action, partnerId: v.createdByPartnerId }),
  );
  assert.throws(() =>
    agreementAction({ ...action, expectedContentHash: "wrong" }),
  );
});
test("all four server lifecycle shapes parse and round-trip without private inputs", () => {
  for (const status of [
    "draft",
    "proposed",
    "under_review",
    "approved",
  ] as const) {
    const v = agreementFixture(status);
    assert.deepEqual(parseAgreement(v), v);
    const json = JSON.stringify(v);
    for (const key of [
      "monthlyNetIncome",
      "PersonalObligations",
      "auth_user",
      "discussion_note",
    ])
      assert.ok(!json.includes(key));
  }
});
test("nine-item identity, order, expense sums and contribution conservation are checked", () => {
  const v = agreementFixture();
  assert.throws(() => parseAgreement({ ...v, items: v.items.slice(1) }));
  assert.throws(() => parseAgreement({ ...v, items: [...v.items].reverse() }));
  assert.throws(() =>
    parseAgreement({
      ...v,
      items: v.items.map((i, n) =>
        n === 0 ? { ...i, coupleId: crypto.randomUUID() } : i,
      ),
    }),
  );
  assert.throws(() =>
    parseAgreement({
      ...v,
      financialSummary: {
        ...v.financialSummary,
        monthlyContributionsCents: { A: 1, B: 2 },
      },
    }),
  );
  assert.throws(() =>
    parseAgreement({
      ...v,
      items: v.items.map((i, n) => (n === 0 ? { ...i, monthlyCents: 1 } : i)),
    }),
  );
});
test("forged approval state, wrong version/hash and duplicate identities are rejected", () => {
  const v = agreementFixture("approved");
  assert.equal(v.status, "approved");
  if (v.status !== "approved") return;
  assert.throws(() =>
    parseAgreement({ ...v, approvals: { state: "both", A: null, B: null } }),
  );
  for (const patch of [
    { versionId: crypto.randomUUID() },
    { contentHash: "b".repeat(64) },
    { partnerId: v.approvals.A.partnerId },
    { partnerSlot: "A" },
    { approvedAt: "2000-01-01T00:00:00Z" },
  ])
    assert.throws(() =>
      parseAgreement({
        ...v,
        approvals: { ...v.approvals, B: { ...v.approvals.B, ...patch } },
      }),
    );
});
test("policy requires current actor, both consents, head, hash and submitted revisions", () => {
  const v = agreementFixture("proposed");
  const c: AgreementActorContext = {
    actorPartnerId: v.createdByPartnerId,
    currentHeadVersionId: v.id,
    submittedRevisions: v.sourceRevisions,
    activePartnerIds: [
      v.createdByPartnerId,
      crypto.randomUUID() as typeof v.createdByPartnerId,
    ],
    bothBudgetConsentsGranted: true,
    expectedContentHash: v.contentHash,
  };
  assert.equal(agreementPolicy.canApprove(v, c).allowed, true);
  for (const patch of [
    { activePartnerIds: [] },
    { bothBudgetConsentsGranted: false },
    { currentHeadVersionId: crypto.randomUUID() },
    { expectedContentHash: "b".repeat(64) },
    { submittedRevisions: { A: 0, B: 0 } },
  ])
    assert.equal(
      agreementPolicy.canApprove(v, { ...c, ...patch } as AgreementActorContext)
        .allowed,
      false,
    );
  const draft = agreementFixture();
  assert.equal(
    agreementPolicy.canApprove(draft, {
      ...c,
      actorPartnerId: draft.createdByPartnerId,
      activePartnerIds: [draft.createdByPartnerId, c.activePartnerIds[1]],
      currentHeadVersionId: draft.id,
    }).allowed,
    false,
  );
});
test("PDF is a printable valid document bound to the two-confirmed version", async () => {
  const v = agreementFixture("approved");
  const bytes = await agreementPDF(v);
  assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getTitle(), "First Money Agreement");
  assert.ok(pdf.getSubject()?.includes(v.contentHash));
  assert.ok(pdf.getPageCount() >= 1 && pdf.getPageCount() <= 2);
  assert.equal(pdf.getPage(0).getWidth(), 612);
  const evidence = await verifyAgreementPDF(bytes, v);
  assert.ok(
    !evidence.text.includes("$5,000.00") &&
      !evidence.text.includes("$3,000.00"),
  );
  for (const state of ["draft", "proposed", "under_review"] as const)
    await assert.rejects(() => agreementPDF(agreementFixture(state)));
});
const token = "test-verified-token";
function request(
  v: ReturnType<typeof agreementFixture>,
  action = "approve",
  body: unknown = {
    expectedHeadVersionId: v.id,
    expectedContentHash: v.contentHash,
  },
) {
  return new Request(
    `https://example.test/v1/couples/${v.coupleId}/agreement-versions/${v.id}/${action}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
}
test('PDF preserves a nonzero savings goal and odd-cent contributions from the existing engine',async()=>{
 const v=agreementFixture('approved',20001);
 const evidence=await verifyAgreementPDF(await agreementPDF(v),v);
 assert.ok(evidence.text.includes('Shared savings: $200.01'));
 assert.ok(evidence.text.includes('Monthly budget: $3,400.01'));
});
test("approval route sends only user-scoped version and expected hash RPC arguments", async () => {
  const v = agreementFixture("under_review");
  let calls = 0;
  const handler = createSessionHandler(
    {
      async verifyUser() {
        return true;
      },
      async rpc(name, args, t) {
        calls++;
        assert.equal(name, "fsm_approve_agreement");
        assert.equal(t, token);
        assert.deepEqual(args, {
          p_couple_id: v.coupleId,
          p_version_id: v.id,
          p_expected_hash: v.contentHash,
        });
        return { data: v, error: null };
      },
    },
    [],
  );
  assert.equal((await handler(request(v))).status, 200);
  assert.equal(calls, 1);
  assert.equal(
    (
      await handler(
        request(v, "approve", {
          expectedHeadVersionId: crypto.randomUUID(),
          expectedContentHash: v.contentHash,
        }),
      )
    ).status,
    409,
  );
  assert.equal(calls, 1);
  assert.equal(
    (
      await handler(
        request(v, "approve", {
          expectedHeadVersionId: v.id,
          expectedContentHash: v.contentHash,
          partnerId: "B",
        }),
      )
    ).status,
    400,
  );
  assert.equal(calls, 1);
});
test("PDF route reauthorizes after render and never issues bytes after withdrawal", async () => {
  const v = agreementFixture("approved");
  let calls = 0;
  const handler = createSessionHandler(
    {
      async verifyUser() {
        return true;
      },
      async rpc() {
        calls++;
        return calls === 1
          ? { data: v, error: null }
          : { data: null, error: { message: "CONSENT_REQUIRED" } };
      },
    },
    [],
  );
  const r = await handler(request(v, "pdf"));
  assert.equal(r.status, 403);
  assert.equal(r.headers.get("content-type"), "application/json");
  assert.equal(calls, 2);
});
test("PDF route cannot export another session or a version with only one approval", async () => {
  const v = agreementFixture("under_review");
  const denied = createSessionHandler(
    {
      async verifyUser() {
        return true;
      },
      async rpc() {
        return { data: null, error: { message: "NOT_FOUND" } };
      },
    },
    [],
  );
  assert.equal((await denied(request(v, "pdf"))).status, 404);
  const unapproved = createSessionHandler(
    {
      async verifyUser() {
        return true;
      },
      async rpc() {
        return { data: v, error: null };
      },
    },
    [],
  );
  assert.equal((await unapproved(request(v, "pdf"))).status, 409);
});
test("current agreement may be absent; create HTTP result distinguishes retry from creation", async () => {
  const v = agreementFixture();
  let created = true;
  const handler = createSessionHandler(
    {
      async verifyUser() {
        return true;
      },
      async rpc(name) {
        return {
          data:
            name === "fsm_get_agreement" ? null : { ...v, _created: created },
          error: null,
        };
      },
    },
    [],
  );
  const path = `https://example.test/v1/couples/${v.coupleId}/agreement-versions`;
  assert.equal(
    (
      await (
        await handler(
          new Request(path + "/current", {
            headers: { Authorization: "Bearer " + token },
          }),
        )
      ).json()
    ).data,
    null,
  );
  const body = {
    requestId: crypto.randomUUID(),
    expectedHeadVersionId: null,
    sourceScenarioId: v.sourceScenarioId,
    rules: rulesFromAgreement(v),
  };
  const req = () =>
    new Request(path, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  assert.equal((await handler(req())).status, 201);
  created = false;
  assert.equal((await handler(req())).status, 200);
});
