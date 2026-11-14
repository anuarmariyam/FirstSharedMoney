import { basisPoints, cents } from "../../lib/money";
import type {
  PercentDisplay,
  SignedCents,
  SplitCalculation,
  SplitPreference,
} from "../../types/domain";

/** Hand-authored UI examples, never a substitute for a calculation engine. */
function allocation(
  contribution: number,
  remaining: number,
  available: number,
  burden: string,
) {
  return {
    monthlyContributionCents: cents(contribution),
    oneOffContributionCents: cents(0),
    totalContributionCents: cents(contribution),
    incomeAfterSharedCostsCents: remaining as SignedCents,
    availableAfterObligationsCents: available as SignedCents,
    incomeBurdenPercent: burden as PercentDisplay,
  };
}
export const modelFixtures = {
  equal: {
    label: "Equal split",
    description: "The same dollar amount from each person.",
    shares: ["50%", "50%"],
    bars: [50, 50],
    result: {
      status: "available",
      model: { kind: "equal" },
      monthlySharedTotalCents: cents(320000),
      oneOffSharedTotalCents: cents(0),
      allocations: {
        A: allocation(160000, 340000, 280000, "32.00"),
        B: allocation(160000, 140000, 110000, "53.33"),
      },
      warnings: [],
    },
  },
  proportional: {
    label: "Proportional split",
    description: "A share of costs based on each income.",
    shares: ["62.5%", "37.5%"],
    bars: [62.5, 37.5],
    result: {
      status: "available",
      model: { kind: "proportional" },
      monthlySharedTotalCents: cents(320000),
      oneOffSharedTotalCents: cents(0),
      allocations: {
        A: allocation(200000, 300000, 240000, "40.00"),
        B: allocation(120000, 180000, 150000, "40.00"),
      },
      warnings: [],
    },
  },
  custom: {
    label: "Custom split",
    description: "A percentage you decide on together.",
    shares: ["40%", "60%"],
    bars: [40, 60],
    result: {
      status: "available",
      model: {
        kind: "custom",
        partnerAShareBasisPoints: basisPoints(4000),
      },
      monthlySharedTotalCents: cents(320000),
      oneOffSharedTotalCents: cents(0),
      allocations: {
        A: allocation(128000, 372000, 312000, "25.60"),
        B: allocation(192000, 108000, 78000, "64.00"),
      },
      warnings: [],
    },
  },
} as const satisfies Record<
  SplitPreference,
  {
    label: string;
    description: string;
    shares: readonly string[];
    bars: readonly number[];
    result: Extract<SplitCalculation, { status: "available" }>;
  }
>;

export const baselineFields = {
  incomeA: "5000",
  incomeB: "3000",
  rent: "2200",
  utilities: "300",
  groceries: "500",
  other: "200",
  savings: "0",
  reserve: "1000",
};
export const stressExamples = [
  {
    id: "rent_increase",
    title: "Rent goes up",
    detail: "+$300 / month",
    icon: "home",
    explanation:
      "A future calculation will add $300 to monthly rent and recalculate each model.",
  },
  {
    id: "income_reduction",
    title: "A smaller paycheck",
    detail: "Partner A earns 20% less",
    icon: "chart",
    explanation:
      "A future calculation will reduce Partner A’s income by 20% and compare the impact.",
  },
  {
    id: "unexpected_expense",
    title: "An unexpected bill",
    detail: "$1,000 one-time cost",
    icon: "alert",
    explanation:
      "A future calculation will use the shared reserve first, then split any uncovered cost.",
  },
  {
    id: "income_loss",
    title: "Time between jobs",
    detail: "Partner B has no income",
    icon: "clock",
    explanation:
      "A future calculation will set Partner B’s income to zero for the modeled month.",
  },
  {
    id: "savings_change",
    title: "A new savings goal",
    detail: "$500 / month together",
    icon: "spark",
    explanation:
      "A future calculation will replace the shared monthly savings allocation with $500.",
  },
] as const;
