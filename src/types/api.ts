import type {
  AgreementRules,
  AgreementVersion,
  AgreementVersionId,
  AnswerValueByQuestion,
  ByPartner,
  Cents,
  ConflictResult,
  ContentHash,
  CoupleId,
  CoupleSession,
  FinancialScenario,
  ISODateTime,
  Partner,
  PrivacyConsent,
  QuestionCode,
  Questionnaire,
  RequestId,
  Revision,
  ScenarioId,
  SharedExpenseAmounts,
  SplitModel,
  StressTestScenario,
} from './domain'

declare const invitationTokenBrand: unique symbol
/** A 32-byte, base64url-encoded invitation capability; never store in app logs. */
export type InvitationToken = string & {
  readonly [invitationTokenBrand]: 'invitation-token'
}
export interface IssuedInvitation {
  readonly token: InvitationToken
  readonly expiresAt: ISODateTime
}
export interface CreateSessionRequest {
  readonly requestId: RequestId
  readonly displayName: string | null
}
export interface CreateSessionResponse {
  readonly session: CoupleSession
  /** Null on an idempotent retry; rotate the invite to issue another raw token. */
  readonly invitation: IssuedInvitation | null
}
export interface RedeemInvitationRequest {
  readonly token: InvitationToken
  readonly displayName: string | null
}
export interface RedeemInvitationResponse {
  readonly session: CoupleSession
  readonly partner: Partner<'B'>
}
export type SaveAnswerRequest<Code extends QuestionCode = QuestionCode> = {
  [Key in Code]: {
    readonly questionCode: Key
    readonly value: AnswerValueByQuestion[Key]
    readonly expectedRevision: Revision
  }
}[Code]
export interface SubmitQuestionnaireRequest {
  readonly expectedRevision: Revision
  readonly consent: PrivacyConsent
}
export interface ReopenQuestionnaireRequest {
  readonly expectedRevision: Revision
}
export interface UpdatePrivacyRequest {
  readonly expectedRevision: Revision
  readonly consent: PrivacyConsent
}
export interface ComparisonResponse {
  readonly sourceRevisions: ByPartner<Revision>
  readonly results: readonly ConflictResult[]
}
/** Income and obligation amounts are loaded by the server, never supplied here. */
export interface CreateScenarioRequest {
  readonly requestId: RequestId
  readonly expectedRevisions: ByPartner<Revision>
  readonly sharedExpenses: SharedExpenseAmounts
  readonly sharedEmergencyFundCents: Cents
  readonly model: SplitModel
  readonly stressTest: StressTestScenario | null
}
export interface CreateAgreementVersionRequest {
  readonly requestId: RequestId
  readonly expectedHeadVersionId: AgreementVersionId | null
  readonly sourceScenarioId: ScenarioId
  readonly rules: AgreementRules
}
export interface ProposeAgreementRequest {
  readonly expectedHeadVersionId: AgreementVersionId
  readonly expectedContentHash: ContentHash
}
export interface ApproveAgreementRequest {
  readonly expectedHeadVersionId: AgreementVersionId
  readonly expectedContentHash: ContentHash
}
export interface DeleteSessionRequest {
  readonly confirmation: 'DELETE_SESSION'
}
export interface DeleteSessionResponse {
  readonly deletedCoupleId: CoupleId
}
export interface RevokeAccessRequest {
  readonly confirmation: 'REVOKE_MY_ACCESS'
}

export type ApiErrorCode =
  | 'INVALID_INPUT'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'INVALID_INVITATION'
  | 'SESSION_FULL'
  | 'IDENTITY_ALREADY_JOINED'
  | 'STALE_REVISION'
  | 'STALE_VERSION'
  | 'QUESTIONNAIRES_INCOMPLETE'
  | 'CONSENT_REQUIRED'
  | 'INPUTS_CHANGED'
  | 'INVALID_STATE'
  | 'SCENARIO_UNAVAILABLE'
  | 'REQUEST_ID_REUSED'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
export interface ApiError {
  readonly code: ApiErrorCode
  readonly message: string
  /** Field names and public validation codes only; never rejected input values. */
  readonly fields: Readonly<Record<string, string>> | null
}
export type ApiResult<Data> =
  | { readonly ok: true; readonly data: Data; readonly requestId: RequestId }
  | { readonly ok: false; readonly error: ApiError; readonly requestId: RequestId }

interface Operation<Request, Response> {
  readonly request: Request
  readonly response: Response
}
/** Logical operation contracts; route paths and security rules are documented. */
export interface FsmApiContract {
  readonly createSession: Operation<CreateSessionRequest, CreateSessionResponse>
  readonly createDemoSession: Operation<CreateSessionRequest, CreateSessionResponse>
  readonly getSession: Operation<null, CoupleSession>
  readonly rotateInvitation: Operation<null, IssuedInvitation>
  readonly redeemInvitation: Operation<RedeemInvitationRequest, RedeemInvitationResponse>
  readonly getQuestionnaire: Operation<null, Questionnaire>
  readonly saveAnswer: Operation<SaveAnswerRequest, Questionnaire>
  readonly submitQuestionnaire: Operation<SubmitQuestionnaireRequest, Questionnaire>
  readonly reopenQuestionnaire: Operation<ReopenQuestionnaireRequest, Questionnaire>
  readonly updatePrivacy: Operation<UpdatePrivacyRequest, Questionnaire>
  readonly getComparison: Operation<null, ComparisonResponse>
  readonly createScenario: Operation<CreateScenarioRequest, FinancialScenario>
  readonly getScenario: Operation<null, FinancialScenario>
  readonly getCurrentAgreement: Operation<null, AgreementVersion | null>
  readonly getAgreementVersion: Operation<null, AgreementVersion>
  readonly createAgreementVersion: Operation<CreateAgreementVersionRequest, AgreementVersion>
  readonly proposeAgreement: Operation<ProposeAgreementRequest, AgreementVersion>
  readonly approveAgreement: Operation<ApproveAgreementRequest, AgreementVersion>
  readonly revokeOwnAccess: Operation<RevokeAccessRequest, null>
  readonly deleteSession: Operation<DeleteSessionRequest, DeleteSessionResponse>
}
