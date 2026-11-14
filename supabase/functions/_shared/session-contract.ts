import type {
  CoupleSession,
  EntityId,
  ISODateTime,
  Partner,
} from "../../../src/types/domain.ts";
import type {
  CreateSessionResponse,
  InvitationToken,
  IssuedInvitation,
  RedeemInvitationResponse,
} from "../../../src/types/api.ts";

export function isUUID(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      value,
    )
  );
}
export function uuid<Entity extends string>(value: unknown): EntityId<Entity> {
  if (!isUUID(value)) throw new Error("INVALID_INPUT");
  return value as EntityId<Entity>;
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("INVALID_INPUT");
  return value as Record<string, unknown>;
}
export function exactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
) {
  if (
    required.some((key) => !Object.hasOwn(value, key)) ||
    Object.keys(value).some(
      (key) => !required.includes(key) && !optional.includes(key),
    )
  )
    throw new Error("INVALID_INPUT");
}
export function displayName(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new Error("INVALID_INPUT");
  const normalized = value.trim();
  if (
    Array.from(normalized).length > 40 ||
    Array.from(normalized).some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    })
  )
    throw new Error("INVALID_INPUT");
  return normalized || null;
}
export function invitationToken(value: unknown): InvitationToken {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(value))
    throw new Error("INVALID_INVITATION");
  return value as InvitationToken;
}
function timestamp(value: unknown): ISODateTime {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T/.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    throw new Error("INVALID_INPUT");
  return value as ISODateTime;
}
function parsePartner(value: unknown): Partner {
  const row = object(value);
  if (row.slot !== "A" && row.slot !== "B") throw new Error("INVALID_INPUT");
  if (
    row.questionnaireStatus !== "draft" &&
    row.questionnaireStatus !== "submitted"
  )
    throw new Error("INVALID_INPUT");
  const name = displayName(row.displayName);
  if (!name) throw new Error("INVALID_INPUT");
  return {
    id: uuid<"partner">(row.id),
    coupleId: uuid<"couple">(row.coupleId),
    slot: row.slot,
    displayName: name,
    questionnaireStatus: row.questionnaireStatus,
    joinedAt: timestamp(row.joinedAt),
  };
}
export function parseSession(value: unknown): CoupleSession {
  const row = object(value);
  if (row.mode !== "standard" && row.mode !== "demo")
    throw new Error("INVALID_INPUT");
  if (row.currency !== "USD" || row.questionnaireVersion !== 1)
    throw new Error("INVALID_INPUT");
  if (
    row.stage !== "waiting_for_partner" &&
    row.stage !== "questionnaires_in_progress" &&
    row.stage !== "ready_for_shared_planning"
  )
    throw new Error("INVALID_INPUT");
  if (
    !Array.isArray(row.partners) ||
    row.partners.length < 1 ||
    row.partners.length > 2
  )
    throw new Error("INVALID_INPUT");
  const id = uuid<"couple">(row.id);
  const partners = row.partners.map(parsePartner);
  const viewerPartnerId = uuid<"partner">(row.viewerPartnerId);
  if (
    partners[0].slot !== "A" ||
    (partners[1] && partners[1].slot !== "B") ||
    partners.some((partner) => partner.coupleId !== id) ||
    new Set(partners.map((partner) => partner.id)).size !== partners.length ||
    !partners.some((partner) => partner.id === viewerPartnerId)
  )
    throw new Error("INVALID_INPUT");
  const ordered = partners as [Partner<"A">] | [Partner<"A">, Partner<"B">];
  return {
    id,
    mode: row.mode,
    currency: "USD",
    questionnaireVersion: 1,
    stage: row.stage,
    viewerPartnerId,
    partners: ordered,
    currentAgreementVersionId:
      row.currentAgreementVersionId === null
        ? null
        : uuid<"agreement-version">(row.currentAgreementVersionId),
    createdAt: timestamp(row.createdAt),
    expiresAt: timestamp(row.expiresAt),
  };
}
export function parseIssuedInvitation(value: unknown): IssuedInvitation {
  const row = object(value);
  return {
    token: invitationToken(row.token),
    expiresAt: timestamp(row.expiresAt),
  };
}
export function parseCreatedSession(value: unknown): CreateSessionResponse {
  const row = object(value);
  return {
    session: parseSession(row.session),
    invitation:
      row.invitation === null ? null : parseIssuedInvitation(row.invitation),
  };
}
export function parseRedeemedSession(value: unknown): RedeemInvitationResponse {
  const row = object(value);
  const session = parseSession(row.session);
  const partner = parsePartner(row.partner);
  if (
    partner.slot !== "B" ||
    partner.id !== session.viewerPartnerId ||
    partner.coupleId !== session.id
  )
    throw new Error("INVALID_INPUT");
  return { session, partner: partner as Partner<"B"> };
}
