import type {
  AgreementVersion,
  AgreementVersionId,
  Answer,
  ByPartner,
  ConflictResult,
  ContentHash,
  FinancialInput,
  PartnerId,
  Question,
  QuestionCode,
  Revision,
  SimulationOutput,
  SplitCalculation,
  SplitModel,
  StressTestScenario,
} from './domain'

export type ComparableQuestionCode = Exclude<
  QuestionCode,
  'monthly_income' | 'personal_obligations' | 'comfortable_income_share' | 'discussion_note'
>
/** Server-only projection that excludes private notes and non-comparison fields. */
export interface ComparisonQuestionnaire {
  readonly catalogVersion: 1
  readonly revision: Revision
  readonly questions: readonly Question<ComparableQuestionCode>[]
  readonly answers: readonly Answer<ComparableQuestionCode>[]
}

/** Never return these server input projections to a shared UI. */
export interface ConflictDetectionEngine {
  compare(
    questionnaires: ByPartner<ComparisonQuestionnaire>,
  ): readonly ConflictResult[]
}

/** Pure computation ports: no React, storage, network, or identity dependencies. */
export interface FinancialSimulationEngine {
  calculate(input: FinancialInput, model: SplitModel): SplitCalculation
  simulate(
    input: FinancialInput,
    model: SplitModel,
    stressTest: StressTestScenario | null,
  ): SimulationOutput
}

export interface AgreementActorContext {
  readonly actorPartnerId: PartnerId
  readonly currentHeadVersionId: AgreementVersionId
  readonly submittedRevisions: ByPartner<Revision>
  readonly activePartnerIds: readonly [PartnerId, PartnerId]
  readonly bothBudgetConsentsGranted: boolean
  readonly expectedContentHash: ContentHash
}
export type AgreementPolicyDecision =
  | { readonly allowed: true }
  | {
      readonly allowed: false
      readonly reason:
        | 'not_a_member'
        | 'stale_version'
        | 'content_changed'
        | 'inputs_changed'
        | 'consent_required'
        | 'invalid_state'
    }

/**
 * Policy ports only. The database must recheck these rules inside the same
 * transaction that changes lifecycle state or inserts an approval.
 */
export interface MutualAgreementPolicy {
  canPropose(
    version: AgreementVersion,
    context: AgreementActorContext,
  ): AgreementPolicyDecision
  canApprove(
    version: AgreementVersion,
    context: AgreementActorContext,
  ): AgreementPolicyDecision
}
