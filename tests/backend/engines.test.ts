import { test } from "node:test";
import assert from "node:assert/strict";
import {
  financialEngine,
  financialInput,
  splitModel,
  stressTest,
} from "../../src/engines/financial.ts";
import { conflictEngine } from "../../src/engines/conflict.ts";
import { questions } from "../../src/features/questionnaire/catalog.ts";
import type { ComparisonQuestionnaire } from "../../src/types/engines.ts";
import type { ByPartner, SplitCalculation } from "../../src/types/domain.ts";
import { questionnaireValues } from "../live/questionnaire-fixtures.ts";
import {
  createScenarioRequest,
  parseComparison,
  parseScenario,
} from "../../supabase/functions/_shared/finance-contract.ts";
import { createSessionHandler } from "../../supabase/functions/fsm-api/handler.ts";

function input(a = 500000, b = 300000, rent = 320000, oneOff = 0, reserve = 0) {
  return financialInput({
    currency: "USD",
    sourceRevisions: { A: 1, B: 2 },
    partners: {
      A: { monthlyNetIncomeCents: a, monthlyPersonalObligationsCents: 60000 },
      B: { monthlyNetIncomeCents: b, monthlyPersonalObligationsCents: 30000 },
    },
    sharedExpenses: {
      rent,
      utilities: 0,
      groceries: 0,
      other: 0,
      shared_savings: 0,
    },
    sharedEmergencyFundCents: reserve,
    oneOffSharedExpenseCents: oneOff,
  });
}
function available(value: SplitCalculation) {
  assert.equal(value.status, "available");
  if (value.status !== "available") throw new Error("Unavailable");
  return value;
}
test("equal and proportional split actual totals with exact remaining balances", () => {
  const equal = available(
    financialEngine.calculate(input(), { kind: "equal" }),
  );
  assert.equal(equal.allocations.A.monthlyContributionCents, 160000);
  assert.equal(equal.allocations.B.monthlyContributionCents, 160000);
  assert.equal(equal.allocations.A.incomeBurdenPercent, "32.00");
  assert.equal(equal.allocations.B.incomeBurdenPercent, "53.33");
  const prop = available(
    financialEngine.calculate(input(), { kind: "proportional" }),
  );
  assert.equal(prop.allocations.A.monthlyContributionCents, 200000);
  assert.equal(prop.allocations.B.monthlyContributionCents, 120000);
  assert.equal(prop.allocations.A.availableAfterObligationsCents, 240000);
  assert.equal(prop.allocations.B.availableAfterObligationsCents, 150000);
});
test("largest remainders preserve odd cents and ties favor A on each horizon", () => {
  const equal = available(
    financialEngine.calculate(input(100, 100, 1, 1), { kind: "equal" }),
  );
  assert.deepEqual(
    [
      equal.allocations.A.monthlyContributionCents,
      equal.allocations.B.monthlyContributionCents,
    ],
    [1, 0],
  );
  assert.deepEqual(
    [
      equal.allocations.A.oneOffContributionCents,
      equal.allocations.B.oneOffContributionCents,
    ],
    [1, 0],
  );
  const prop = available(
    financialEngine.calculate(input(1, 2, 1), { kind: "proportional" }),
  );
  assert.equal(prop.allocations.B.monthlyContributionCents, 1);
});
test("custom endpoints allocate all cents to the selected partner", () => {
  for (const share of [0, 10000]) {
    const result = available(
      financialEngine.calculate(
        input(1, 1, 99),
        splitModel({ kind: "custom", partnerAShareBasisPoints: share }),
      ),
    );
    assert.equal(
      result.allocations.A.monthlyContributionCents,
      share === 0 ? 0 : 99,
    );
    assert.equal(
      result.allocations.B.monthlyContributionCents,
      share === 0 ? 99 : 0,
    );
  }
});
test("zero income returns N/A and proportional both-zero is explicitly unavailable", () => {
  const equal = available(
    financialEngine.calculate(input(0, 0, 1), { kind: "equal" }),
  );
  assert.equal(equal.allocations.A.incomeBurdenPercent, null);
  assert.ok(equal.warnings.some((w) => w.code === "zero_income"));
  assert.ok(equal.warnings.some((w) => w.code === "income_shortfall"));
  assert.deepEqual(
    financialEngine.calculate(input(0, 0, 0), { kind: "proportional" }),
    {
      status: "unavailable",
      model: { kind: "proportional" },
      reason: "zero_total_income",
    },
  );
  assert.equal(
    available(
      financialEngine.calculate(input(0, 300000, 320000), {
        kind: "proportional",
      }),
    ).allocations.A.totalContributionCents,
    0,
  );
});
test("BigInt intermediates support large values and unbounded display percentages", () => {
  const result = available(
    financialEngine.calculate(
      input(1000000000000, 999999999999, 1000000000000),
      { kind: "proportional" },
    ),
  );
  assert.equal(
    result.allocations.A.monthlyContributionCents +
      result.allocations.B.monthlyContributionCents,
    1000000000000,
  );
  const huge = available(
    financialEngine.calculate(
      input(1, 0, 1000000000000),
      splitModel({ kind: "custom", partnerAShareBasisPoints: 10000 }),
    ),
  );
  assert.equal(huge.allocations.A.incomeBurdenPercent, "100000000000000.00");
  assert.equal(
    huge.allocations.A.availableAfterObligationsCents,
    -1000000059999,
  );
});
test("allocation invariants hold across varied totals, incomes and all custom boundaries", () => {
  for (let n = 0; n < 300; n++)
    for (const model of [
      { kind: "equal" },
      { kind: "proportional" },
      { kind: "custom", partnerAShareBasisPoints: n % 2 ? 1 : 9999 },
    ] as const) {
      const result = available(
        financialEngine.calculate(
          input(n + 1, 601 - n, n * 17 + 1, n % 11),
          splitModel(model),
        ),
      );
      assert.equal(
        result.allocations.A.monthlyContributionCents +
          result.allocations.B.monthlyContributionCents,
        result.monthlySharedTotalCents,
      );
      assert.equal(
        result.allocations.A.oneOffContributionCents +
          result.allocations.B.oneOffContributionCents,
        result.oneOffSharedTotalCents,
      );
      for (const slot of ["A", "B"] as const)
        assert.equal(
          result.allocations[slot].totalContributionCents,
          result.allocations[slot].monthlyContributionCents +
            result.allocations[slot].oneOffContributionCents,
        );
    }
});
test("stress scenarios transform inputs without mutation or double reserve deductions", () => {
  const original = input(500000, 300000, 320000, 0, 60000),
    before = JSON.stringify(original);
  const rent = financialEngine.simulate(
    original,
    { kind: "equal" },
    { kind: "rent_increase", increaseCents: 30000 as never },
  );
  assert.equal(rent.effectiveInput.sharedExpenses.rent, 350000);
  const reduction = financialEngine.simulate(
    original,
    { kind: "proportional" },
    {
      kind: "income_reduction",
      partnerSlot: "A",
      reductionBasisPoints: 2000 as never,
    },
  );
  assert.equal(
    reduction.effectiveInput.partners.A.monthlyNetIncomeCents,
    400000,
  );
  const lost = financialEngine.simulate(
    original,
    { kind: "proportional" },
    { kind: "income_loss", partnerSlot: "B" },
  );
  assert.equal(
    available(lost.split).allocations.A.monthlyContributionCents,
    320000,
  );
  const unexpected = financialEngine.simulate(
    original,
    { kind: "equal" },
    { kind: "unexpected_expense", amountCents: 100000 as never },
  );
  assert.equal(unexpected.reserveUsedCents, 60000);
  assert.equal(unexpected.effectiveInput.sharedEmergencyFundCents, 0);
  assert.equal(unexpected.effectiveInput.oneOffSharedExpenseCents, 40000);
  assert.equal(
    available(unexpected.split).allocations.A.incomeAfterSharedCostsCents,
    320000,
  );
  const savings = financialEngine.simulate(
    original,
    { kind: "equal" },
    { kind: "savings_change", monthlyTargetCents: 50000 as never },
  );
  assert.equal(available(savings.split).monthlySharedTotalCents, 370000);
  assert.equal(JSON.stringify(original), before);
  assert.deepEqual(
    unexpected,
    financialEngine.simulate(
      original,
      { kind: "equal" },
      { kind: "unexpected_expense", amountCents: 100000 as never },
    ),
  );
});
test("income reductions round half cents upward and savings are deducted only once", () => {
  const half = financialEngine.simulate(
    input(1, 3, 0),
    { kind: "equal" },
    {
      kind: "income_reduction",
      partnerSlot: "A",
      reductionBasisPoints: 5000 as never,
    },
  );
  assert.equal(half.effectiveInput.partners.A.monthlyNetIncomeCents, 1);
  const savings = financialEngine.simulate(
    input(500000, 300000, 300000),
    { kind: "equal" },
    { kind: "savings_change", monthlyTargetCents: 20000 as never },
  );
  assert.equal(
    available(savings.split).allocations.A.incomeAfterSharedCostsCents,
    340000,
  );
  const covered = financialEngine.simulate(
    input(500000, 300000, 0, 0, 200000),
    { kind: "equal" },
    { kind: "unexpected_expense", amountCents: 100000 as never },
  );
  assert.equal(available(covered.split).oneOffSharedTotalCents, 0);
  assert.equal(covered.effectiveInput.sharedEmergencyFundCents, 100000);
});
test("invalid inputs, unsafe aggregates and out-of-bound stresses are rejected", () => {
  for (const amount of [-1, 1.1, NaN, Infinity, 1000000000001, "1"])
    assert.throws(() =>
      financialInput({ ...input(), sharedEmergencyFundCents: amount }),
    );
  assert.throws(() => input(1, 1, 1000000000000, 1));
  assert.throws(() =>
    splitModel({ kind: "custom", partnerAShareBasisPoints: 10001 }),
  );
  assert.throws(() =>
    stressTest({
      kind: "income_reduction",
      partnerSlot: "C",
      reductionBasisPoints: 2000,
    }),
  );
  assert.throws(() =>
    financialEngine.simulate(
      input(1, 1, 1000000000000),
      { kind: "equal" },
      { kind: "rent_increase", increaseCents: 1 as never },
    ),
  );
});
function comparison(): ByPartner<ComparisonQuestionnaire> {
  const make = (id: string): ComparisonQuestionnaire => ({
    catalogVersion: 1,
    revision: 1 as never,
    questions: questions.filter((q) => q.comparisonRule !== "none") as never,
    answers: questions
      .filter((q) => q.comparisonRule !== "none")
      .map((q) => ({
        id,
        coupleId: id,
        partnerId: id,
        catalogVersion: 1,
        questionCode: q.code,
        value: questionnaireValues[q.code],
        updatedAt: "2026-11-15T00:00:00Z",
      })) as never,
  });
  return { A: make("aa"), B: make("bb") };
}
test("comparison follows exact and set rules, excluding salaries, obligations and notes", () => {
  const data = comparison(),
    before = JSON.stringify(data);
  const results = conflictEngine.compare(data);
  assert.equal(results.length, 11);
  assert.ok(results.every((r) => r.status === "aligned"));
  assert.ok(!JSON.stringify(results).includes("monthly_income"));
  assert.ok(!JSON.stringify(results).includes("personal_obligations"));
  assert.equal(JSON.stringify(data), before);
});
test("different values, custom decisions, set normalization and missing legacy answers classify correctly", () => {
  const original = comparison();
  const data = {
    A: {
      ...original.A,
      answers: original.A.answers.map((a) =>
        a.questionCode === "split_preference"
          ? { ...a, value: { kind: "single_choice", value: "custom" } }
          : a,
      ),
    },
    B: {
      ...original.B,
      answers: original.B.answers
        .map((a) =>
          a.questionCode === "split_preference"
            ? { ...a, value: { kind: "single_choice", value: "custom" } }
            : a.questionCode === "monthly_shared_savings"
              ? { ...a, value: { kind: "money", cents: 9 } }
              : a,
        )
        .filter((a) => a.questionCode !== "review_frequency"),
    },
  } as ByPartner<ComparisonQuestionnaire>;
  const result = conflictEngine.compare(data);
  assert.equal(
    result.find((r) => r.questionCode === "split_preference")?.status,
    "unresolved",
  );
  assert.equal(
    result.find((r) => r.questionCode === "monthly_shared_savings")?.status,
    "different",
  );
  assert.equal(
    result.find((r) => r.questionCode === "review_frequency")?.reason,
    "missing_answer",
  );
  const sets = {
    A: {
      ...original.A,
      answers: original.A.answers.map((a) =>
        a.questionCode === "shared_categories"
          ? {
              ...a,
              value: {
                kind: "multiple_choice",
                values: ["rent", "utilities", "rent"],
              },
            }
          : a,
      ),
    },
    B: {
      ...original.B,
      answers: original.B.answers.map((a) =>
        a.questionCode === "shared_categories"
          ? {
              ...a,
              value: { kind: "multiple_choice", values: ["utilities", "rent"] },
            }
          : a,
      ),
    },
  } as ByPartner<ComparisonQuestionnaire>;
  assert.equal(
    conflictEngine
      .compare(sets)
      .find((r) => r.questionCode === "shared_categories")?.status,
    "aligned",
  );
});
test("scenario request rejects authoritative client outputs and output parser recomputes stored results", () => {
  const id = "cc7754d6-fd47-48b9-a9a2-dbd547f3031a",
    base = input();
  const request = {
    requestId: id,
    expectedRevisions: base.sourceRevisions,
    sharedExpenses: base.sharedExpenses,
    sharedEmergencyFundCents: 0,
    model: { kind: "equal" },
    stressTest: null,
  };
  assert.throws(() => createScenarioRequest({ ...request, output: {} }));
  const scenario = {
    id,
    coupleId: id,
    createdByPartnerId: id,
    input: base,
    model: { kind: "equal" },
    stressTest: null,
    output: financialEngine.simulate(base, { kind: "equal" }, null),
    createdAt: "2026-11-15T00:00:00Z",
  };
  assert.deepEqual(parseScenario(scenario).output, scenario.output);
  assert.throws(() =>
    parseScenario({
      ...scenario,
      output: { ...scenario.output, reserveUsedCents: 999 },
    }),
  );
  assert.throws(() =>
    parseComparison({
      sourceRevisions: { A: 1, B: 1 },
      results: [{ monthly_income: 999 }],
    }),
  );
});
test("Edge internal actor always comes from verified identity, never HTTP body", async () => {
  const actor = "cc7754d6-fd47-48b9-a9a2-dbd547f3031a",
    couple = "cc7754d6-fd47-48b9-a9a2-dbd547f3031b";
  const calls: Record<string, unknown>[] = [];
  const handler = createSessionHandler(
    {
      verifyUser: async () => ({ id: actor }),
      rpc: async () => ({ data: null, error: null }),
      internalRpc: async (_name, args) => {
        calls.push(args);
        return { data: input(), error: null };
      },
    },
    [],
  );
  const response = await handler(
    new Request(
      `https://example.invalid/v1/couples/${couple}/financial-inputs`,
      { headers: { authorization: "Bearer transport-unit" } },
    ),
  );
  assert.equal(response.status, 200);
  assert.equal(calls[0].p_verified_actor_user_id, actor);
  assert.equal(calls[0].p_couple_id, couple);
  const rejected = await handler(
    new Request(`https://example.invalid/v1/couples/${couple}/scenarios`, {
      method: "POST",
      headers: {
        authorization: "Bearer transport-unit",
        "content-type": "application/json",
      },
      body: JSON.stringify({ verifiedActorUserId: actor }),
    }),
  );
  assert.equal(rejected.status, 400);
  assert.equal(calls.length, 1);
});
