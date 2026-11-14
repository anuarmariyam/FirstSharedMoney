import type {
  AgreementRules,
  AgreementVersion,
  AgreementItem,
  Approval,
  ISODate,
  ISODateTime,
  ContentHash,
} from "../../../src/types/domain.ts";
import type {
  CreateAgreementVersionRequest,
  ApproveAgreementRequest,
} from "../../../src/types/api.ts";
import {
  fields,
  record,
  money,
  revisions,
  splitModel,
  boundedInteger,
  expenseKeys,
} from "../../../src/engines/financial.ts";
import { uuid } from "./session-contract.ts";

export function contentHash(value: unknown): ContentHash {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value))
    throw new Error("INVALID_INPUT");
  return value as ContentHash;
}
function choice<T extends string>(value: unknown, allowed: readonly T[]): T {
  if (typeof value !== "string" || !allowed.includes(value as T))
    throw new Error("INVALID_INPUT");
  return value as T;
}
function date(value: unknown): ISODate {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value + "T00:00:00Z")) ||
    new Date(value + "T00:00:00Z").toISOString().slice(0, 10) !== value
  )
    throw new Error("INVALID_INPUT");
  return value as ISODate;
}
function timestamp(value: unknown): ISODateTime {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)))
    throw new Error("INVALID_INPUT");
  return value as ISODateTime;
}
export function agreementRules(
  value: unknown,
  checkWindow = false,
  now = new Date(),
): AgreementRules {
  const r = record(value);
  fields(r, [
    "personalSpending",
    "debtExpectation",
    "largePurchaseThresholdCents",
    "emergencyRule",
    "reviewFrequency",
    "nextReviewDate",
  ]);
  const day = date(r.nextReviewDate);
  if (checkWindow) {
    const today = Date.parse(now.toISOString().slice(0, 10) + "T00:00:00Z");
    const n = Date.parse(day + "T00:00:00Z");
    if (n <= today || n > today + 366 * 86400000)
      throw new Error("INVALID_INPUT");
  }
  return {
    personalSpending: choice(r.personalSpending, [
      "independent",
      "discuss_above_threshold",
    ]),
    debtExpectation: choice(r.debtExpectation, [
      "individual_responsibility",
      "discuss_support",
    ]),
    largePurchaseThresholdCents: money(r.largePurchaseThresholdCents),
    emergencyRule: choice(r.emergencyRule, [
      "use_shared_reserve_then_discuss",
      "pause_savings_then_discuss",
      "discuss_before_spending",
    ]),
    reviewFrequency: choice(r.reviewFrequency, [
      "monthly",
      "quarterly",
      "as_needed",
    ]),
    nextReviewDate: day,
  };
}
export function createAgreementRequest(
  value: unknown,
): CreateAgreementVersionRequest {
  const r = record(value);
  fields(r, [
    "requestId",
    "expectedHeadVersionId",
    "sourceScenarioId",
    "rules",
  ]);
  return {
    requestId: uuid<"request">(r.requestId),
    expectedHeadVersionId:
      r.expectedHeadVersionId === null
        ? null
        : uuid<"agreement-version">(r.expectedHeadVersionId),
    sourceScenarioId: uuid<"scenario">(r.sourceScenarioId),
    rules: agreementRules(r.rules, true),
  };
}
export function agreementAction(value: unknown): ApproveAgreementRequest {
  const r = record(value);
  fields(r, ["expectedHeadVersionId", "expectedContentHash"]);
  return {
    expectedHeadVersionId: uuid<"agreement-version">(r.expectedHeadVersionId),
    expectedContentHash: contentHash(r.expectedContentHash),
  };
}
export function rulesFromAgreement(v: AgreementVersion): AgreementRules {
  const personal = v.items.find((i) => i.key === "personal_spending"),
    purchase = v.items.find((i) => i.key === "large_purchase"),
    emergency = v.items.find((i) => i.key === "emergency"),
    review = v.items.find((i) => i.key === "review");
  if (
    personal?.key !== "personal_spending" ||
    purchase?.key !== "large_purchase" ||
    emergency?.key !== "emergency" ||
    review?.key !== "review"
  )
    throw new Error("INVALID_INPUT");
  return {
    personalSpending: personal.rule,
    debtExpectation: personal.debtExpectation,
    largePurchaseThresholdCents: purchase.thresholdCents,
    emergencyRule: emergency.rule,
    reviewFrequency: review.frequency,
    nextReviewDate: review.nextReviewDate,
  };
}
export function parseAgreement(value: unknown): AgreementVersion {
  const r = record(value),
    id = uuid<"agreement-version">(r.id),
    coupleId = uuid<"couple">(r.coupleId),
    hash = contentHash(r.contentHash);
  const versionNumber = boundedInteger(r.versionNumber, 2147483647);
  if (
    !versionNumber ||
    r.schemaVersion !== 1 ||
    !Array.isArray(r.items) ||
    r.items.length !== 9
  )
    throw new Error("INVALID_INPUT");
  const keys = [
    ...expenseKeys,
    "personal_spending",
    "large_purchase",
    "emergency",
    "review",
  ];
  const seen = new Set<string>();
  const items = r.items.map((value, index): AgreementItem => {
    const i = record(value),
      itemId = uuid<"agreement-item">(i.id);
    if (
      i.versionId !== id ||
      i.coupleId !== coupleId ||
      i.position !== index ||
      i.key !== keys[index] ||
      seen.has(itemId)
    )
      throw new Error("INVALID_INPUT");
    seen.add(itemId);
    const base = { id: itemId, versionId: id, coupleId, position: index };
    const common = ["id", "versionId", "coupleId", "position", "key"];
    if (index < 5) {
      fields(i, [...common, "monthlyCents"]);
      return {
        ...base,
        key: expenseKeys[index],
        monthlyCents: money(i.monthlyCents),
      };
    }
    if (i.key === "personal_spending") {
      fields(i, [...common, "rule", "debtExpectation"]);
      return {
        ...base,
        key: i.key,
        rule: choice(i.rule, ["independent", "discuss_above_threshold"]),
        debtExpectation: choice(i.debtExpectation, [
          "individual_responsibility",
          "discuss_support",
        ]),
      };
    }
    if (i.key === "large_purchase") {
      fields(i, [...common, "thresholdCents"]);
      return { ...base, key: i.key, thresholdCents: money(i.thresholdCents) };
    }
    if (i.key === "emergency") {
      fields(i, [...common, "rule"]);
      return {
        ...base,
        key: i.key,
        rule: choice(i.rule, [
          "use_shared_reserve_then_discuss",
          "pause_savings_then_discuss",
          "discuss_before_spending",
        ]),
      };
    }
    fields(i, [...common, "frequency", "nextReviewDate"]);
    return {
      ...base,
      key: "review",
      frequency: choice(i.frequency, ["monthly", "quarterly", "as_needed"]),
      nextReviewDate: date(i.nextReviewDate),
    };
  });
  const f = record(r.financialSummary);
  fields(f, [
    "currency",
    "splitModel",
    "monthlySharedTotalCents",
    "monthlyContributionsCents",
    "sharedEmergencyFundCents",
  ]);
  if (f.currency !== "USD") throw new Error("INVALID_INPUT");
  const amounts = record(f.monthlyContributionsCents);
  fields(amounts, ["A", "B"]);
  const a = money(amounts.A),
    b = money(amounts.B),
    total = money(f.monthlySharedTotalCents);
  if (
    a + b !== total ||
    items.reduce(
      (sum, i) => sum + ("monthlyCents" in i ? i.monthlyCents : 0),
      0,
    ) !== total
  )
    throw new Error("INVALID_INPUT");
  const base = {
    id,
    coupleId,
    versionNumber,
    parentVersionId:
      r.parentVersionId === null
        ? null
        : uuid<"agreement-version">(r.parentVersionId),
    createdByPartnerId: uuid<"partner">(r.createdByPartnerId),
    sourceScenarioId: uuid<"scenario">(r.sourceScenarioId),
    sourceRevisions: revisions(r.sourceRevisions),
    financialSummary: {
      currency: "USD" as const,
      splitModel: splitModel(f.splitModel),
      monthlySharedTotalCents: total,
      monthlyContributionsCents: { A: a, B: b },
      sharedEmergencyFundCents: money(f.sharedEmergencyFundCents),
    },
    items,
    contentHash: hash,
    schemaVersion: 1 as const,
    createdAt: timestamp(r.createdAt),
  };
  const approval = (value: unknown, slot: "A" | "B"): Approval | null => {
    if (value === null) return null;
    const p = record(value);
    fields(p, [
      "id",
      "versionId",
      "partnerId",
      "partnerSlot",
      "contentHash",
      "approvedAt",
    ]);
    if (p.versionId !== id || p.partnerSlot !== slot || p.contentHash !== hash)
      throw new Error("INVALID_INPUT");
    return {
      id: uuid<"approval">(p.id),
      versionId: id,
      partnerId: uuid<"partner">(p.partnerId),
      partnerSlot: slot,
      contentHash: hash,
      approvedAt: timestamp(p.approvedAt),
    };
  };
  const flags = record(r.approvals);
  fields(flags, ["state", "A", "B"]);
  const A = approval(flags.A, "A"),
    B = approval(flags.B, "B");
  if (A && B && (A.partnerId === B.partnerId || A.id === B.id))
    throw new Error("INVALID_INPUT");
  if (
    r.status === "draft" &&
    flags.state === "none" &&
    !A &&
    !B &&
    r.proposedAt === null &&
    r.approvedAt === null
  )
    return {
      ...base,
      status: "draft",
      approvals: { state: "none", A: null, B: null },
      proposedAt: null,
      approvedAt: null,
    };
  const proposedAt = timestamp(r.proposedAt);
  if (Date.parse(proposedAt) < Date.parse(base.createdAt))
    throw new Error("INVALID_INPUT");
  if (
    [A, B].some((p) => p && Date.parse(p.approvedAt) < Date.parse(proposedAt))
  )
    throw new Error("INVALID_INPUT");
  if (
    r.status === "proposed" &&
    flags.state === "none" &&
    !A &&
    !B &&
    r.approvedAt === null
  )
    return {
      ...base,
      status: "proposed",
      approvals: { state: "none", A: null, B: null },
      proposedAt,
      approvedAt: null,
    };
  if (
    r.status === "under_review" &&
    flags.state === "one" &&
    r.approvedAt === null
  ) {
    if (A && !B)
      return {
        ...base,
        status: "under_review",
        approvals: { state: "one", A, B: null },
        proposedAt,
        approvedAt: null,
      };
    if (B && !A)
      return {
        ...base,
        status: "under_review",
        approvals: { state: "one", A: null, B },
        proposedAt,
        approvedAt: null,
      };
  }
  if (r.status === "approved" && flags.state === "both" && A && B) {
    const approvedAt = timestamp(r.approvedAt);
    if (
      Date.parse(approvedAt) !==
      Math.max(Date.parse(A.approvedAt), Date.parse(B.approvedAt))
    )
      throw new Error("INVALID_INPUT");
    return {
      ...base,
      status: "approved",
      approvals: { state: "both", A, B },
      proposedAt,
      approvedAt,
    };
  }
  throw new Error("INVALID_INPUT");
}
