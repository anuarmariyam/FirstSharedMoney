import { randomUUID } from "node:crypto";
import { parseAgreement } from "../../supabase/functions/_shared/agreement-contract.ts";
import {
  financialEngine,
  financialInput,
  expenseKeys,
} from "../../src/engines/financial.ts";
import type { AgreementVersion } from "../../src/types/domain.ts";

/** Fictional transport fixture; its test hash is not database evidence. */
export function agreementFixture(
  status: AgreementVersion["status"] = "draft",
  sharedSavingsCents = 0,
): AgreementVersion {
  const input = financialInput({
    currency: "USD",
    sourceRevisions: { A: 17, B: 17 },
    partners: {
      A: {
        monthlyNetIncomeCents: 500000,
        monthlyPersonalObligationsCents: 60000,
      },
      B: {
        monthlyNetIncomeCents: 300000,
        monthlyPersonalObligationsCents: 30000,
      },
    },
    sharedExpenses: {
      rent: 220000,
      utilities: 30000,
      groceries: 50000,
      other: 20000,
      shared_savings: sharedSavingsCents,
    },
    sharedEmergencyFundCents: 60000,
    oneOffSharedExpenseCents: 0,
  });
  const split = financialEngine.calculate(input, { kind: "proportional" });
  if (split.status !== "available") throw new Error("Fixture unavailable");
  const id = randomUUID(),
    coupleId = randomUUID(),
    hash = "a".repeat(64);
  const values = [
    ...expenseKeys.map((key) => ({
      key,
      monthlyCents: input.sharedExpenses[key],
    })),
    {
      key: "personal_spending",
      rule: "independent",
      debtExpectation: "individual_responsibility",
    },
    { key: "large_purchase", thresholdCents: 50000 },
    { key: "emergency", rule: "discuss_before_spending" },
    {
      key: "review",
      frequency: "monthly",
      nextReviewDate: new Date(Date.now() + 86400000 * 30)
        .toISOString()
        .slice(0, 10),
    },
  ];
  const A = {
    id: randomUUID(),
    versionId: id,
    partnerId: randomUUID(),
    partnerSlot: "A",
    contentHash: hash,
    approvedAt: "2026-11-15T12:00:02.000Z",
  };
  const B = {
    id: randomUUID(),
    versionId: id,
    partnerId: randomUUID(),
    partnerSlot: "B",
    contentHash: hash,
    approvedAt: "2026-11-15T12:00:03.000Z",
  };
  return parseAgreement({
    id,
    coupleId,
    versionNumber: 1,
    parentVersionId: null,
    createdByPartnerId: A.partnerId,
    sourceScenarioId: randomUUID(),
    sourceRevisions: input.sourceRevisions,
    schemaVersion: 1,
    financialSummary: {
      currency: "USD",
      splitModel: split.model,
      monthlySharedTotalCents: split.monthlySharedTotalCents,
      monthlyContributionsCents: {
        A: split.allocations.A.monthlyContributionCents,
        B: split.allocations.B.monthlyContributionCents,
      },
      sharedEmergencyFundCents: input.sharedEmergencyFundCents,
    },
    items: values.map((v, position) => ({
      ...v,
      id: randomUUID(),
      coupleId,
      versionId: id,
      position,
    })),
    contentHash: hash,
    status,
    createdAt: "2026-11-15T12:00:00.000Z",
    proposedAt: status === "draft" ? null : "2026-11-15T12:00:01.000Z",
    approvedAt: status === "approved" ? B.approvedAt : null,
    approvals:
      status === "approved"
        ? { state: "both", A, B }
        : status === "under_review"
          ? { state: "one", A, B: null }
          : { state: "none", A: null, B: null },
  });
}
