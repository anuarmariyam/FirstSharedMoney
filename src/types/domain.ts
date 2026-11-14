/** Design contracts only. Runtime parsers must validate values before branding. */
declare const idBrand: unique symbol
declare const scalarBrand: unique symbol

export type EntityId<Entity extends string> = string & {
  readonly [idBrand]: Entity
}
export type CoupleId = EntityId<'couple'>
export type PartnerId = EntityId<'partner'>
export type AnswerId = EntityId<'answer'>
export type ScenarioId = EntityId<'scenario'>
export type AgreementVersionId = EntityId<'agreement-version'>
export type AgreementItemId = EntityId<'agreement-item'>
export type ApprovalId = EntityId<'approval'>
export type RequestId = EntityId<'request'>

/** Safe nonnegative integer cents, capped at 1_000_000_000_000. */
export type Cents = number & { readonly [scalarBrand]: 'cents' }
/** Safe integer cents; negative values represent a budget shortfall. */
export type SignedCents = number & { readonly [scalarBrand]: 'signed-cents' }
/** Integer in [0, 10_000]. */
export type BasisPoints = number & { readonly [scalarBrand]: 'basis-points' }
export type Revision = number & { readonly [scalarBrand]: 'revision' }
export type ISODate = string & { readonly [scalarBrand]: 'iso-date' }
export type ISODateTime = string & { readonly [scalarBrand]: 'iso-date-time' }
export type ContentHash = string & { readonly [scalarBrand]: 'sha256-hex' }
/** Nonnegative decimal percentage with two fractional digits, for display only. */
export type PercentDisplay = string & { readonly [scalarBrand]: 'percent-display' }

export type PartnerSlot = 'A' | 'B'
export type ByPartner<T> = Readonly<{ A: T; B: T }>
export type Currency = 'USD'
export type SessionMode = 'standard' | 'demo'
export type QuestionnaireStatus = 'draft' | 'submitted'
export type ReviewFrequency = 'monthly' | 'quarterly' | 'as_needed'
export type PersonalSpendingRule = 'independent' | 'discuss_above_threshold'
export type DebtExpectation = 'individual_responsibility' | 'discuss_support'
export type EmergencyPreference =
  | 'shared_reserve_first'
  | 'pause_savings_first'
  | 'discuss_each_event'
export type TransparencyPreference =
  | 'shared_totals_only'
  | 'voluntary_details'
  | 'prefer_private'

/** Safe member projection. Auth user IDs and private answers are excluded. */
export interface Partner<Slot extends PartnerSlot = PartnerSlot> {
  readonly id: PartnerId
  readonly coupleId: CoupleId
  readonly slot: Slot
  readonly displayName: string
  readonly questionnaireStatus: QuestionnaireStatus
  readonly joinedAt: ISODateTime
}

export interface CoupleSession {
  readonly id: CoupleId
  readonly mode: SessionMode
  readonly currency: Currency
  readonly questionnaireVersion: 1
  readonly stage:
    | 'waiting_for_partner'
    | 'questionnaires_in_progress'
    | 'ready_for_shared_planning'
  readonly viewerPartnerId: PartnerId
  readonly partners:
    | readonly [Partner<'A'>]
    | readonly [Partner<'A'>, Partner<'B'>]
  readonly currentAgreementVersionId: AgreementVersionId | null
  readonly createdAt: ISODateTime
  readonly expiresAt: ISODateTime
}

export type SharedExpenseCategory =
  | 'rent'
  | 'utilities'
  | 'groceries'
  | 'other'
  | 'shared_savings'
export type SharedExpenseAmounts = Readonly<Record<SharedExpenseCategory, Cents>>
export type SplitPreference = 'equal' | 'proportional' | 'custom'
export type QuestionCategory =
  | 'income_obligations'
  | 'shared_expenses'
  | 'expense_split'
  | 'savings'
  | 'personal_spending'
  | 'debt'
  | 'emergency'
  | 'large_purchase'
  | 'transparency'
  | 'reviews'

export interface MoneyAnswer {
  readonly kind: 'money'
  readonly cents: Cents
}
export interface SingleChoiceAnswer<Option extends string> {
  readonly kind: 'single_choice'
  readonly value: Option
}
export interface MultipleChoiceAnswer<Option extends string> {
  readonly kind: 'multiple_choice'
  readonly values: readonly Option[]
}
export interface SliderAnswer {
  readonly kind: 'slider'
  readonly basisPoints: BasisPoints
}
export interface TextAnswer {
  readonly kind: 'text'
  readonly text: string
}

/** Each stable question code determines the only legal answer shape. */
export interface AnswerValueByQuestion {
  readonly monthly_income: MoneyAnswer
  readonly personal_obligations: MoneyAnswer
  readonly shared_categories: MultipleChoiceAnswer<SharedExpenseCategory>
  readonly shared_budget_estimate: MoneyAnswer
  readonly split_preference: SingleChoiceAnswer<SplitPreference>
  readonly monthly_shared_savings: MoneyAnswer
  readonly personal_spending: SingleChoiceAnswer<PersonalSpendingRule>
  readonly debt_expectation: SingleChoiceAnswer<DebtExpectation>
  readonly emergency_preference: SingleChoiceAnswer<EmergencyPreference>
  readonly emergency_fund_target: MoneyAnswer
  readonly large_purchase_threshold: MoneyAnswer
  readonly transparency_preference: SingleChoiceAnswer<TransparencyPreference>
  readonly review_frequency: SingleChoiceAnswer<ReviewFrequency>
  readonly comfortable_income_share: SliderAnswer
  readonly discussion_note: TextAnswer
}
export type QuestionCode = keyof AnswerValueByQuestion
export type AnswerValue = AnswerValueByQuestion[QuestionCode]

interface ChoiceOption<Value extends string> {
  readonly value: Value
  readonly label: string
}
type QuestionControl<Value extends AnswerValue> =
  Value extends SingleChoiceAnswer<infer Option>
    ? { readonly kind: 'single_choice'; readonly options: readonly ChoiceOption<Option>[] }
    : Value extends MultipleChoiceAnswer<infer Option>
      ? { readonly kind: 'multiple_choice'; readonly options: readonly ChoiceOption<Option>[] }
      : Value extends MoneyAnswer
        ? { readonly kind: 'money'; readonly minCents: Cents; readonly maxCents: Cents }
        : Value extends SliderAnswer
          ? {
              readonly kind: 'slider'
              readonly minBasisPoints: BasisPoints
              readonly maxBasisPoints: BasisPoints
              readonly stepBasisPoints: number
            }
          : { readonly kind: 'text'; readonly maxLength: number }

export type Question<Code extends QuestionCode = QuestionCode> = {
  [Key in Code]: {
    readonly code: Key
    readonly catalogVersion: 1
    readonly title: string
    readonly helpText: string
    readonly category: QuestionCategory
    readonly required: boolean
    readonly position: number
    readonly comparisonRule: 'exact' | 'set_equality' | 'none'
  } & QuestionControl<AnswerValueByQuestion[Key]>
}[Code]

export type Answer<Code extends QuestionCode = QuestionCode> = {
  [Key in Code]: {
    readonly id: AnswerId
    readonly coupleId: CoupleId
    readonly partnerId: PartnerId
    readonly catalogVersion: 1
    readonly questionCode: Key
    readonly value: AnswerValueByQuestion[Key]
    readonly updatedAt: ISODateTime
  }
}[Code]

export interface PrivacyConsent {
  readonly comparison: boolean
  readonly budget: boolean
}
interface QuestionnaireBase {
  readonly partnerId: PartnerId
  readonly catalogVersion: 1
  readonly revision: Revision
  readonly questions: readonly Question[]
  readonly answers: readonly Answer[]
}
/** Owner-only response; never include the counterpart's questionnaire. */
export type Questionnaire = QuestionnaireBase & (
  | {
      readonly status: 'draft'
      readonly submittedAt: null
      readonly consent: { readonly comparison: false; readonly budget: false }
    }
  | {
      readonly status: 'submitted'
      readonly submittedAt: ISODateTime
      readonly consent: PrivacyConsent
    }
)
export type SubmittedQuestionnaire = Extract<Questionnaire, { status: 'submitted' }>

interface ConflictBase {
  readonly questionCode: QuestionCode
  readonly category: QuestionCategory
  /** Neutral copy identifier; no private answers or optional free text. */
  readonly discussionPromptCode: string
}
export type ConflictResult = ConflictBase & (
  | { readonly status: 'aligned'; readonly reason: 'same_preference' }
  | { readonly status: 'different'; readonly reason: 'different_expectations' }
  | {
      readonly status: 'unresolved'
      readonly reason: 'missing_answer' | 'decision_required'
    }
)

export interface PartnerFinancialInput {
  readonly monthlyNetIncomeCents: Cents
  readonly monthlyPersonalObligationsCents: Cents
}
/** Shared only after both partners explicitly consent to this numeric projection. */
export interface FinancialInput {
  readonly currency: Currency
  readonly sourceRevisions: ByPartner<Revision>
  readonly partners: ByPartner<PartnerFinancialInput>
  readonly sharedExpenses: SharedExpenseAmounts
  readonly sharedEmergencyFundCents: Cents
  readonly oneOffSharedExpenseCents: Cents
}
export type SplitModel =
  | { readonly kind: 'equal' }
  | { readonly kind: 'proportional' }
  | { readonly kind: 'custom'; readonly partnerAShareBasisPoints: BasisPoints }

export interface PartnerAllocation {
  readonly monthlyContributionCents: Cents
  readonly oneOffContributionCents: Cents
  readonly totalContributionCents: Cents
  /** Null when income is zero; the UI renders N/A rather than Infinity. */
  readonly incomeBurdenPercent: PercentDisplay | null
  readonly incomeAfterSharedCostsCents: SignedCents
  readonly availableAfterObligationsCents: SignedCents
}
export interface FinancialWarning {
  readonly code: 'zero_income' | 'income_shortfall' | 'reserve_exhausted'
  readonly partnerSlot: PartnerSlot | null
}
export type SplitCalculation =
  | {
      readonly status: 'available'
      readonly model: SplitModel
      readonly monthlySharedTotalCents: Cents
      readonly oneOffSharedTotalCents: Cents
      readonly allocations: ByPartner<PartnerAllocation>
      readonly warnings: readonly FinancialWarning[]
    }
  | {
      readonly status: 'unavailable'
      readonly model: { readonly kind: 'proportional' }
      readonly reason: 'zero_total_income'
    }

export type StressTestScenario =
  | { readonly kind: 'rent_increase'; readonly increaseCents: Cents }
  | {
      readonly kind: 'income_reduction'
      readonly partnerSlot: PartnerSlot
      readonly reductionBasisPoints: BasisPoints
    }
  | { readonly kind: 'unexpected_expense'; readonly amountCents: Cents }
  | { readonly kind: 'income_loss'; readonly partnerSlot: PartnerSlot }
  | { readonly kind: 'savings_change'; readonly monthlyTargetCents: Cents }

export interface SimulationOutput {
  readonly effectiveInput: FinancialInput
  readonly reserveUsedCents: Cents
  readonly split: SplitCalculation
}
export interface FinancialScenario {
  readonly id: ScenarioId
  readonly coupleId: CoupleId
  readonly createdByPartnerId: PartnerId
  readonly input: FinancialInput
  readonly model: SplitModel
  readonly stressTest: StressTestScenario | null
  readonly output: SimulationOutput
  readonly createdAt: ISODateTime
}

export type EmergencyRule =
  | 'use_shared_reserve_then_discuss'
  | 'pause_savings_then_discuss'
  | 'discuss_before_spending'
export interface AgreementRules {
  readonly personalSpending: PersonalSpendingRule
  readonly debtExpectation: DebtExpectation
  readonly largePurchaseThresholdCents: Cents
  readonly emergencyRule: EmergencyRule
  readonly reviewFrequency: ReviewFrequency
  readonly nextReviewDate: ISODate
}
interface AgreementItemBase {
  readonly id: AgreementItemId
  readonly versionId: AgreementVersionId
  readonly coupleId: CoupleId
  readonly position: number
}
export type AgreementItem = AgreementItemBase & (
  | { readonly key: SharedExpenseCategory; readonly monthlyCents: Cents }
  | {
      readonly key: 'personal_spending'
      readonly rule: PersonalSpendingRule
      readonly debtExpectation: DebtExpectation
    }
  | { readonly key: 'large_purchase'; readonly thresholdCents: Cents }
  | { readonly key: 'emergency'; readonly rule: EmergencyRule }
  | {
      readonly key: 'review'
      readonly frequency: ReviewFrequency
      readonly nextReviewDate: ISODate
    }
)
export interface AgreementFinancialSummary {
  readonly currency: Currency
  readonly splitModel: SplitModel
  readonly monthlySharedTotalCents: Cents
  readonly monthlyContributionsCents: ByPartner<Cents>
  readonly sharedEmergencyFundCents: Cents
}
export interface Approval {
  readonly id: ApprovalId
  readonly versionId: AgreementVersionId
  readonly partnerId: PartnerId
  readonly partnerSlot: PartnerSlot
  readonly contentHash: ContentHash
  readonly approvedAt: ISODateTime
}
export type ApprovalStatus =
  | { readonly state: 'none'; readonly A: null; readonly B: null }
  | { readonly state: 'one'; readonly A: Approval; readonly B: null }
  | { readonly state: 'one'; readonly A: null; readonly B: Approval }
  | { readonly state: 'both'; readonly A: Approval; readonly B: Approval }

interface AgreementVersionBase {
  readonly id: AgreementVersionId
  readonly coupleId: CoupleId
  readonly versionNumber: number
  readonly parentVersionId: AgreementVersionId | null
  readonly createdByPartnerId: PartnerId
  readonly sourceScenarioId: ScenarioId
  readonly sourceRevisions: ByPartner<Revision>
  readonly financialSummary: AgreementFinancialSummary
  readonly items: readonly AgreementItem[]
  readonly contentHash: ContentHash
  readonly schemaVersion: 1
  readonly createdAt: ISODateTime
}
/** Content is immutable; only server-authorized lifecycle metadata can change. */
export type AgreementVersion = AgreementVersionBase & (
  | {
      readonly status: 'draft'
      readonly approvals: Extract<ApprovalStatus, { state: 'none' }>
      readonly proposedAt: null
      readonly approvedAt: null
    }
  | {
      readonly status: 'proposed'
      readonly approvals: Extract<ApprovalStatus, { state: 'none' }>
      readonly proposedAt: ISODateTime
      readonly approvedAt: null
    }
  | {
      readonly status: 'under_review'
      readonly approvals: Extract<ApprovalStatus, { state: 'one' }>
      readonly proposedAt: ISODateTime
      readonly approvedAt: null
    }
  | {
      readonly status: 'approved'
      readonly approvals: Extract<ApprovalStatus, { state: 'both' }>
      readonly proposedAt: ISODateTime
      readonly approvedAt: ISODateTime
    }
)
