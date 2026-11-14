import type { MutualAgreementPolicy } from "../../types/engines.ts";

export const agreementPolicy: MutualAgreementPolicy = {
  canPropose(v, c) {
    if (!c.activePartnerIds.includes(c.actorPartnerId))
      return { allowed: false, reason: "not_a_member" };
    if (!c.bothBudgetConsentsGranted)
      return { allowed: false, reason: "consent_required" };
    if (c.currentHeadVersionId !== v.id)
      return { allowed: false, reason: "stale_version" };
    if (c.expectedContentHash !== v.contentHash)
      return { allowed: false, reason: "content_changed" };
    if (
      v.sourceRevisions.A !== c.submittedRevisions.A ||
      v.sourceRevisions.B !== c.submittedRevisions.B
    )
      return { allowed: false, reason: "inputs_changed" };
    return { allowed: true };
  },
  canApprove(v, c) {
    const check = agreementPolicy.canPropose(v, c);
    if (!check.allowed) return check;
    return v.status === "draft"
      ? { allowed: false, reason: "invalid_state" }
      : { allowed: true };
  },
};
