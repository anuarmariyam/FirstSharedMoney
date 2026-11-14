import type { FsmApiContract } from "../types/api";
import {
  backendConfig,
  ensureAnonymousSession,
  existingBrowserSession,
} from "./supabase";
import {
  parseCreatedSession,
  parseIssuedInvitation,
  parseRedeemedSession,
  parseSession,
  uuid,
} from "../../supabase/functions/_shared/session-contract";
import { SessionServiceError } from "./session-error";

/** An integration seam, not local authentication or a simulated server. */
export interface FsmClient {
  readonly connection: "connected" | "not_connected";
  request<Operation extends keyof FsmApiContract>(
    operation: Operation,
    body: FsmApiContract[Operation]["request"],
    resource: { coupleId?: string; versionId?: string; scenarioId?: string },
    options?: { signal?: AbortSignal },
  ): Promise<FsmApiContract[Operation]["response"]>;
}
export const fsmClient: FsmClient = {
  connection: backendConfig ? "connected" : "not_connected",
  async request<Operation extends keyof FsmApiContract>(
    operation: Operation,
    body: FsmApiContract[Operation]["request"],
    resource: { coupleId?: string },
    options?: { signal?: AbortSignal },
  ): Promise<FsmApiContract[Operation]["response"]> {
    if (!backendConfig)
      throw new SessionServiceError(
        "NOT_CONNECTED",
        "Live sessions are not connected yet.",
      );
    const session =
      operation === "createSession" || operation === "redeemInvitation"
        ? await ensureAnonymousSession()
        : await existingBrowserSession();
    let path: string;
    let method: string;
    let parse: (value: unknown) => unknown;
    switch (operation) {
      case "createSession":
        path = "/couples";
        method = "POST";
        parse = parseCreatedSession;
        break;
      case "redeemInvitation":
        path = "/invitations/redeem";
        method = "POST";
        parse = parseRedeemedSession;
        break;
      case "getSession":
        path = `/couples/${uuid(resource.coupleId)}`;
        method = "GET";
        parse = parseSession;
        break;
      case "rotateInvitation":
        path = `/couples/${uuid(resource.coupleId)}/invitations`;
        method = "POST";
        parse = parseIssuedInvitation;
        break;
      case "getQuestionnaire":
      case "submitQuestionnaire":
      case "reopenQuestionnaire":
      case "updatePrivacy":
      case "saveAnswer": {
        const { parseQuestionnaire, questionCode } =
          await import("../../supabase/functions/_shared/questionnaire-contract.ts");
        const base = `/couples/${uuid(resource.coupleId)}`;
        parse = parseQuestionnaire;
        if (operation === "saveAnswer") {
          if (!body || !("questionCode" in body))
            throw new SessionServiceError(
              "INVALID_INPUT",
              "Choose a valid question.",
            );
          path = `${base}/answers/${questionCode(body.questionCode)}`;
          method = "PUT";
        } else if (operation === "updatePrivacy") {
          path = `${base}/privacy`;
          method = "PATCH";
        } else {
          path = `${base}/questionnaire${operation === "submitQuestionnaire" ? "/submit" : operation === "reopenQuestionnaire" ? "/reopen" : ""}`;
          method = operation === "getQuestionnaire" ? "GET" : "POST";
        }
        break;
      }
      default:
        throw new SessionServiceError(
          "NOT_IMPLEMENTED",
          "This feature is not connected in Phase 4A.",
        );
    }
    let response: Response;
    try {
      response = await fetch(
        `${backendConfig.url}/functions/v1/fsm-api/v1${path}`,
        {
          method,
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: backendConfig.publishableKey,
            "Content-Type": "application/json",
          },
          body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
          credentials: "omit",
          cache: "no-store",
          signal: options?.signal
            ? AbortSignal.any([options.signal, AbortSignal.timeout(15_000)])
            : AbortSignal.timeout(15_000),
        },
      );
    } catch (error) {
      if (options?.signal?.aborted) throw error;
      throw new SessionServiceError(
        "NETWORK_ERROR",
        "The server could not be reached. Retrying session creation uses the same request ID.",
      );
    }
    const payload: unknown = await response.json().catch(() => null);
    if (!payload || typeof payload !== "object" || !("ok" in payload))
      throw new SessionServiceError(
        "INVALID_RESPONSE",
        "The session API returned an unexpected response. Check that the Edge Function is deployed.",
      );
    if (!response.ok || payload.ok !== true) {
      const candidate =
        "error" in payload && payload.error && typeof payload.error === "object"
          ? payload.error
          : null;
      const code =
        candidate && "code" in candidate && typeof candidate.code === "string"
          ? candidate.code
          : "INTERNAL_ERROR";
      const messages: Record<string, string> = {
        STALE_REVISION:
          "Your answers changed in another tab. Review the latest saved answers before retrying.",
        QUESTIONNAIRES_INCOMPLETE:
          "Complete all required questions before submitting.",
        INVALID_STATE:
          "This questionnaire changed. Reload it before continuing.",
        INVALID_INPUT: "Check your answer and try again.",
        CONSENT_REQUIRED:
          "Both partners must explicitly allow this use of their data.",
        INVALID_INVITATION:
          "This invitation is unavailable, expired, revoked, or already used. Ask your partner for a new link.",
        IDENTITY_ALREADY_JOINED:
          "This browser already belongs to Partner A. Open the invitation in a separate browser profile or device. Your identity has not been changed.",
        NOT_FOUND:
          "This session is unavailable or this browser does not have access.",
        FORBIDDEN: "This action is not available to your partner role.",
        SESSION_FULL: "Both partner places are already taken.",
        RATE_LIMITED: "Too many requests. Wait before trying again.",
        UNAUTHENTICATED:
          "Your browser session could not be verified. Retry without clearing your browser storage.",
        REQUEST_ID_REUSED:
          "The request was already used with different details. Change the details or reload before creating another plan.",
      };
      throw new SessionServiceError(
        code,
        (Object.hasOwn(messages, code) ? messages[code] : undefined) ??
          "The request could not be completed. Check the backend setup and try again.",
      );
    }
    if (!("data" in payload))
      throw new SessionServiceError(
        "INVALID_RESPONSE",
        "The response did not contain session data.",
      );
    try {
      return parse(payload.data) as FsmApiContract[Operation]["response"];
    } catch {
      throw new SessionServiceError(
        "INVALID_RESPONSE",
        "The session response did not match the application contract.",
      );
    }
  },
};
