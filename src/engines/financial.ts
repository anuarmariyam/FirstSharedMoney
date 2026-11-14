import type {
  BasisPoints,
  Cents,
  FinancialInput,
  FinancialWarning,
  PercentDisplay,
  Revision,
  SignedCents,
  SplitCalculation,
  SplitModel,
  StressTestScenario,
} from "../types/domain.ts";
import type { FinancialSimulationEngine } from "../types/engines.ts";

export const MONEY_LIMIT = 1_000_000_000_000;
export const expenseKeys = [
  "rent",
  "utilities",
  "groceries",
  "other",
  "shared_savings",
] as const;
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("INVALID_INPUT");
  return value as Record<string, unknown>;
}
export function fields(row: Record<string, unknown>, keys: readonly string[]) {
  if (
    Object.keys(row).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(row, key))
  )
    throw new Error("INVALID_INPUT");
}
export function boundedInteger(value: unknown, max = MONEY_LIMIT): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > max
  )
    throw new Error("INVALID_INPUT");
  return value;
}
export function money(value: unknown): Cents {
  return boundedInteger(value) as Cents;
}
export function revisions(value: unknown): FinancialInput["sourceRevisions"] {
  const row = record(value);
  fields(row, ["A", "B"]);
  return {
    A: boundedInteger(row.A, 2147483647) as Revision,
    B: boundedInteger(row.B, 2147483647) as Revision,
  };
}
export function sharedExpenses(
  value: unknown,
): FinancialInput["sharedExpenses"] {
  const row = record(value);
  fields(row, expenseKeys);
  const result = {
    rent: money(row.rent),
    utilities: money(row.utilities),
    groceries: money(row.groceries),
    other: money(row.other),
    shared_savings: money(row.shared_savings),
  };
  money(expenseKeys.reduce((total, key) => total + result[key], 0));
  return result;
}
export function splitModel(value: unknown): SplitModel {
  const row = record(value);
  if (row.kind === "equal" || row.kind === "proportional") {
    fields(row, ["kind"]);
    return { kind: row.kind };
  }
  if (row.kind === "custom") {
    fields(row, ["kind", "partnerAShareBasisPoints"]);
    return {
      kind: "custom",
      partnerAShareBasisPoints: boundedInteger(
        row.partnerAShareBasisPoints,
        10000,
      ) as BasisPoints,
    };
  }
  throw new Error("INVALID_INPUT");
}
export function stressTest(value: unknown): StressTestScenario | null {
  if (value === null) return null;
  const row = record(value);
  switch (row.kind) {
    case "rent_increase":
      fields(row, ["kind", "increaseCents"]);
      return { kind: row.kind, increaseCents: money(row.increaseCents) };
    case "unexpected_expense":
      fields(row, ["kind", "amountCents"]);
      return { kind: row.kind, amountCents: money(row.amountCents) };
    case "savings_change":
      fields(row, ["kind", "monthlyTargetCents"]);
      return {
        kind: row.kind,
        monthlyTargetCents: money(row.monthlyTargetCents),
      };
    case "income_loss":
    case "income_reduction": {
      fields(
        row,
        row.kind === "income_loss"
          ? ["kind", "partnerSlot"]
          : ["kind", "partnerSlot", "reductionBasisPoints"],
      );
      if (row.partnerSlot !== "A" && row.partnerSlot !== "B")
        throw new Error("INVALID_INPUT");
      return row.kind === "income_loss"
        ? { kind: row.kind, partnerSlot: row.partnerSlot }
        : {
            kind: row.kind,
            partnerSlot: row.partnerSlot,
            reductionBasisPoints: boundedInteger(
              row.reductionBasisPoints,
              10000,
            ) as BasisPoints,
          };
    }
    default:
      throw new Error("INVALID_INPUT");
  }
}
export function financialInput(value: unknown): FinancialInput {
  const row = record(value);
  fields(row, [
    "currency",
    "sourceRevisions",
    "partners",
    "sharedExpenses",
    "sharedEmergencyFundCents",
    "oneOffSharedExpenseCents",
  ]);
  if (row.currency !== "USD") throw new Error("INVALID_INPUT");
  const partners = record(row.partners);
  fields(partners, ["A", "B"]);
  const parse = (value: unknown) => {
    const p = record(value);
    fields(p, ["monthlyNetIncomeCents", "monthlyPersonalObligationsCents"]);
    return {
      monthlyNetIncomeCents: money(p.monthlyNetIncomeCents),
      monthlyPersonalObligationsCents: money(p.monthlyPersonalObligationsCents),
    };
  };
  const costs = sharedExpenses(row.sharedExpenses),
    oneOff = money(row.oneOffSharedExpenseCents);
  money(expenseKeys.reduce<number>((sum, key) => sum + costs[key], oneOff));
  return {
    currency: "USD",
    sourceRevisions: revisions(row.sourceRevisions),
    partners: { A: parse(partners.A), B: parse(partners.B) },
    sharedExpenses: costs,
    sharedEmergencyFundCents: money(row.sharedEmergencyFundCents),
    oneOffSharedExpenseCents: oneOff,
  };
}
function allocate(total: bigint, a: bigint, b: bigint): [Cents, Cents] {
  const denominator = a + b;
  let aa = (total * a) / denominator,
    bb = (total * b) / denominator;
  if (aa + bb < total) {
    if ((total * a) % denominator >= (total * b) % denominator) aa++;
    else bb++;
  }
  if (aa + bb !== total) throw new Error("INTERNAL_ERROR");
  return [money(Number(aa)), money(Number(bb))];
}
function percent(cost: number, income: number): PercentDisplay | null {
  if (!income) return null;
  const rounded =
    (BigInt(cost) * 10000n + BigInt(income) / 2n) / BigInt(income);
  return `${rounded / 100n}.${String(rounded % 100n).padStart(2, "0")}` as PercentDisplay;
}
function signed(value: number): SignedCents {
  if (!Number.isSafeInteger(value)) throw new Error("INVALID_INPUT");
  return value as SignedCents;
}
function calculate(
  raw: FinancialInput,
  rawModel: SplitModel,
): SplitCalculation {
  const input = financialInput(raw),
    model = splitModel(rawModel);
  const ia = input.partners.A.monthlyNetIncomeCents,
    ib = input.partners.B.monthlyNetIncomeCents;
  if (model.kind === "proportional" && ia === 0 && ib === 0)
    return { status: "unavailable", model, reason: "zero_total_income" };
  const weights =
    model.kind === "equal"
      ? [1n, 1n]
      : model.kind === "proportional"
        ? [BigInt(ia), BigInt(ib)]
        : [
            BigInt(model.partnerAShareBasisPoints),
            BigInt(10000 - model.partnerAShareBasisPoints),
          ];
  const monthly = money(
    expenseKeys.reduce((sum, key) => sum + input.sharedExpenses[key], 0),
  );
  const [ma, mb] = allocate(BigInt(monthly), weights[0], weights[1]);
  const [oa, ob] = allocate(
    BigInt(input.oneOffSharedExpenseCents),
    weights[0],
    weights[1],
  );
  const warnings: FinancialWarning[] = [];
  const allocation = (slot: "A" | "B", month: Cents, oneOff: Cents) => {
    const p = input.partners[slot],
      total = money(month + oneOff);
    const after = signed(p.monthlyNetIncomeCents - total),
      available = signed(after - p.monthlyPersonalObligationsCents);
    if (p.monthlyNetIncomeCents === 0)
      warnings.push({ code: "zero_income", partnerSlot: slot });
    if (available < 0)
      warnings.push({ code: "income_shortfall", partnerSlot: slot });
    return {
      monthlyContributionCents: month,
      oneOffContributionCents: oneOff,
      totalContributionCents: total,
      incomeBurdenPercent: percent(total, p.monthlyNetIncomeCents),
      incomeAfterSharedCostsCents: after,
      availableAfterObligationsCents: available,
    };
  };
  return {
    status: "available",
    model,
    monthlySharedTotalCents: monthly,
    oneOffSharedTotalCents: input.oneOffSharedExpenseCents,
    allocations: { A: allocation("A", ma, oa), B: allocation("B", mb, ob) },
    warnings,
  };
}
export const financialEngine: FinancialSimulationEngine = {
  calculate,
  simulate(raw, model, rawStress) {
    const input = financialInput(raw),
      stress = stressTest(rawStress);
    let reserveUsed = 0;
    const costs = { ...input.sharedExpenses },
      partners = { A: { ...input.partners.A }, B: { ...input.partners.B } };
    let reserve = input.sharedEmergencyFundCents,
      oneOff = input.oneOffSharedExpenseCents;
    if (stress?.kind === "rent_increase")
      costs.rent = money(costs.rent + stress.increaseCents);
    if (stress?.kind === "savings_change")
      costs.shared_savings = stress.monthlyTargetCents;
    if (stress?.kind === "income_loss")
      partners[stress.partnerSlot].monthlyNetIncomeCents = money(0);
    if (stress?.kind === "income_reduction")
      partners[stress.partnerSlot].monthlyNetIncomeCents = money(
        Number(
          (BigInt(partners[stress.partnerSlot].monthlyNetIncomeCents) *
            BigInt(10000 - stress.reductionBasisPoints) +
            5000n) /
            10000n,
        ),
      );
    if (stress?.kind === "unexpected_expense") {
      reserveUsed = Math.min(reserve, stress.amountCents);
      reserve = money(reserve - reserveUsed);
      oneOff = money(oneOff + stress.amountCents - reserveUsed);
    }
    const effectiveInput = financialInput({
      ...input,
      partners,
      sharedExpenses: costs,
      sharedEmergencyFundCents: reserve,
      oneOffSharedExpenseCents: oneOff,
    });
    let split = calculate(effectiveInput, model);
    if (
      split.status === "available" &&
      stress?.kind === "unexpected_expense" &&
      stress.amountCents > 0 &&
      reserve === 0
    )
      split = {
        ...split,
        warnings: [
          ...split.warnings,
          { code: "reserve_exhausted", partnerSlot: null },
        ],
      };
    return { effectiveInput, reserveUsedCents: money(reserveUsed), split };
  },
};
