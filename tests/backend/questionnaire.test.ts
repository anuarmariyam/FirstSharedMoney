import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { questions } from "../../src/features/questionnaire/catalog.ts";
import {
  answerValue,
  parseQuestionnaire,
  privacyConsent,
  revision,
} from "../../supabase/functions/_shared/questionnaire-contract.ts";
import { createSessionHandler } from "../../supabase/functions/fsm-api/handler.ts";
import {
  fromAnswerValue,
  toAnswerValue,
} from "../../src/features/questionnaire/answer-adapter.ts";

const coupleId = "cc7754d6-fd47-48b9-a9a2-dbd547f3031a";
const partnerId = "cc7754d6-fd47-48b9-a9a2-dbd547f3031b";
const draft = {
  partnerId,
  catalogVersion: 1,
  revision: 0,
  questions,
  answers: [],
  status: "draft",
  submittedAt: null,
  consent: { comparison: false, budget: false },
};

test("SQL catalog is an exact export of all 15 approved questions", () => {
  const sql = readFileSync(
    "supabase/migrations/20261114000600_questionnaire_catalog.sql",
    "utf8",
  );
  const rows = JSON.parse(sql.split("$catalog$")[1]) as Record<
    string,
    unknown
  >[];
  const restored = rows.map((q) => ({
    ...(q.control as object),
    code: q.code,
    catalogVersion: q.catalog_version,
    category: q.category,
    title: q.title,
    helpText: q.help_text,
    required: q.is_required,
    position: q.position,
    comparisonRule: q.comparison_rule,
  }));
  assert.deepEqual(restored, questions);
  assert.equal(rows.filter((q) => q.is_required).length, 14);
});
test("answer parsing rejects malformed, fractional, duplicate, unknown, and private-identity input", () => {
  for (const value of [-1, 1.5, 1000000000001, "100", null, Infinity])
    assert.throws(() =>
      answerValue("monthly_income", { kind: "money", cents: value }),
    );
  assert.throws(() =>
    answerValue("monthly_income", { kind: "money", cents: 10, partnerId }),
  );
  assert.throws(() =>
    answerValue("monthly_income", { kind: "text", text: "10" }),
  );
  assert.throws(() =>
    answerValue("shared_categories", {
      kind: "multiple_choice",
      values: ["rent", "rent"],
    }),
  );
  assert.throws(() =>
    answerValue("shared_categories", { kind: "multiple_choice", values: [] }),
  );
  assert.throws(() =>
    answerValue("split_preference", { kind: "single_choice", value: "wrong" }),
  );
  assert.throws(() =>
    answerValue("comfortable_income_share", {
      kind: "slider",
      basisPoints: 2501,
    }),
  );
  assert.throws(() =>
    answerValue("discussion_note", { kind: "text", text: "x".repeat(501) }),
  );
});
test("monetary draft conversion round-trips exact integer cents", () => {
  const q = questions[0];
  for (const cents of [0, 1, 99, 123456, 1000000000000]) {
    const value = answerValue("monthly_income", { kind: "money", cents });
    assert.deepEqual(toAnswerValue(q, fromAnswerValue(value)), value);
  }
});
test("consents are explicit independent booleans and revisions are bounded", () => {
  assert.deepEqual(privacyConsent({ comparison: true, budget: false }), {
    comparison: true,
    budget: false,
  });
  for (const input of [
    { comparison: true },
    { comparison: "true", budget: false },
    { comparison: false, budget: false, partnerId },
  ])
    assert.throws(() => privacyConsent(input));
  for (const input of [-1, 0.5, "1", 2147483648])
    assert.throws(() => revision(input));
});
test("questionnaire response parsing excludes metadata and rejects foreign answers/catalog drift", () => {
  assert.equal(
    "authUserId" in
      parseQuestionnaire({ ...draft, authUserId: "must be omitted" }),
    false,
  );
  assert.throws(() =>
    parseQuestionnaire({
      ...draft,
      status: "submitted",
      submittedAt: "2026-11-14T12:00:00Z",
    }),
  );
  assert.throws(() =>
    parseQuestionnaire({
      ...draft,
      consent: { comparison: true, budget: false },
    }),
  );
  assert.throws(() =>
    parseQuestionnaire({ ...draft, questions: questions.slice(1) }),
  );
  assert.throws(() =>
    parseQuestionnaire({
      ...draft,
      answers: [
        {
          id: coupleId,
          partnerId: coupleId,
          coupleId,
          catalogVersion: 1,
          questionCode: "monthly_income",
          value: { kind: "money", cents: 1 },
          updatedAt: "2026-11-14T12:00:00Z",
        },
      ],
    }),
  );
});
test("five questionnaire routes forward only the owner-scoped approved RPC parameters", async () => {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const handler = createSessionHandler(
    {
      verifyUser: async () => true,
      rpc: async (name, args) => {
        calls.push({ name, args });
        return { data: draft, error: null };
      },
    },
    ["http://127.0.0.1:5173"],
  );
  const cases = [
    ["GET", "questionnaire", undefined, "fsm_get_questionnaire"],
    [
      "PUT",
      "answers/monthly_income",
      {
        questionCode: "monthly_income",
        value: { kind: "money", cents: 100 },
        expectedRevision: 0,
      },
      "fsm_save_answer",
    ],
    [
      "POST",
      "questionnaire/submit",
      { expectedRevision: 0, consent: { comparison: false, budget: true } },
      "fsm_submit_questionnaire",
    ],
    [
      "POST",
      "questionnaire/reopen",
      { expectedRevision: 0 },
      "fsm_reopen_questionnaire",
    ],
    [
      "PATCH",
      "privacy",
      { expectedRevision: 0, consent: { comparison: true, budget: false } },
      "fsm_update_privacy",
    ],
  ] as const;
  for (const [method, path, body, name] of cases) {
    const response = await handler(
      new Request(
        `https://example.invalid/functions/v1/fsm-api/v1/couples/${coupleId}/${path}`,
        {
          method,
          headers: {
            authorization: "Bearer unit-transport-only",
            "content-type": "application/json",
          },
          body: body ? JSON.stringify(body) : undefined,
        },
      ),
    );
    assert.equal(response.status, 200);
    assert.equal(calls.at(-1)!.name, name);
    assert.equal(calls.at(-1)!.args.p_couple_id, coupleId);
    assert.equal("p_partner_id" in calls.at(-1)!.args, false);
  }
  const count = calls.length;
  for (const body of [
    {
      questionCode: "personal_obligations",
      value: { kind: "money", cents: 1 },
      expectedRevision: 0,
    },
    {
      questionCode: "monthly_income",
      value: { kind: "money", cents: 1 },
      expectedRevision: 0,
      partnerId,
    },
  ]) {
    const response = await handler(
      new Request(
        `https://example.invalid/v1/couples/${coupleId}/answers/monthly_income`,
        {
          method: "PUT",
          headers: {
            authorization: "Bearer unit-transport-only",
            "content-type": "application/json",
          },
          body: JSON.stringify(body),
        },
      ),
    );
    assert.equal(response.status, 400);
  }
  assert.equal(calls.length, count);
});
test("stale revisions return a sanitized conflict response", async () => {
  const handler = createSessionHandler(
    {
      verifyUser: async () => true,
      rpc: async () => ({ data: null, error: { message: "STALE_REVISION" } }),
    },
    [],
  );
  const response = await handler(
    new Request(
      `https://example.invalid/v1/couples/${coupleId}/questionnaire`,
      { headers: { authorization: "Bearer unit-transport-only" } },
    ),
  );
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, "STALE_REVISION");
});
