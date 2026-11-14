import {
  displayName,
  exactKeys,
  invitationToken,
  object,
  parseCreatedSession,
  parseIssuedInvitation,
  parseRedeemedSession,
  parseSession,
  uuid,
} from "../_shared/session-contract.ts";
import {
  answerValue,
  parseQuestionnaire,
  privacyConsent,
  questionCode,
  revision,
} from "../_shared/questionnaire-contract.ts";
import { financeOperation } from "./finance.ts";
import { parseScenario } from "../_shared/finance-contract.ts";

export interface SessionBackend {
  verifyUser(token: string): Promise<boolean | { id: string }>;
  internalRpc?: (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{
    data: unknown;
    error: { message: string; code?: string } | null;
  }>;
  rpc(
    name: string,
    args: Record<string, unknown>,
    token: string,
  ): Promise<{
    data: unknown;
    error: { message: string; code?: string } | null;
  }>;
}
const knownErrors: Record<string, { status: number; message: string }> = {
  INPUTS_CHANGED: {
    status: 409,
    message:
      "Submitted answers or permissions changed. Refresh the inputs before calculating again.",
  },
  STALE_REVISION: {
    status: 409,
    message:
      "Your answers changed in another tab. Review the latest saved answers before retrying.",
  },
  QUESTIONNAIRES_INCOMPLETE: {
    status: 409,
    message: "Complete all required questions before submitting.",
  },
  CONSENT_REQUIRED: {
    status: 403,
    message: "Both partners must explicitly allow this use of their data.",
  },
  INVALID_INPUT: { status: 400, message: "Check the submitted fields." },
  UNAUTHENTICATED: {
    status: 401,
    message:
      "Your browser session is unavailable. Try again without changing partner identities.",
  },
  FORBIDDEN: {
    status: 403,
    message: "This action is not available to your partner role.",
  },
  NOT_FOUND: {
    status: 404,
    message: "This session is unavailable or you do not have access.",
  },
  INVALID_INVITATION: {
    status: 404,
    message: "This invitation is unavailable. Ask your partner for a new link.",
  },
  IDENTITY_ALREADY_JOINED: {
    status: 409,
    message:
      "This browser already holds Partner A. Open the invitation in a separate browser profile or device.",
  },
  SESSION_FULL: {
    status: 409,
    message: "Both partner places are already taken.",
  },
  REQUEST_ID_REUSED: {
    status: 409,
    message: "This request ID was already used with different details.",
  },
  RATE_LIMITED: {
    status: 429,
    message: "Too many session creations. Try again later.",
  },
  INVALID_STATE: {
    status: 409,
    message: "The session state changed. Reload before continuing.",
  },
};

async function readBody(request: Request): Promise<Record<string, unknown>> {
  if (
    request.headers.get("content-type")?.split(";")[0].trim() !==
    "application/json"
  )
    throw new Error("INVALID_INPUT");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("INVALID_INPUT");
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > 65_536) {
        await reader.cancel();
        throw new Error("INVALID_INPUT");
      }
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return object(
      JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
    );
  } catch {
    throw new Error("INVALID_INPUT");
  } finally {
    reader.releaseLock();
  }
}

export function createSessionHandler(
  backend: SessionBackend,
  allowedOrigins: readonly string[],
) {
  return async (request: Request): Promise<Response> => {
    const requestId = crypto.randomUUID();
    const origin = request.headers.get("origin");
    const allowed = origin === null || allowedOrigins.includes(origin);
    const headers = new Headers({
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      Vary: "Origin",
      "Access-Control-Allow-Headers":
        "authorization, apikey, content-type, x-client-info",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, OPTIONS",
    });
    if (origin && allowed) headers.set("Access-Control-Allow-Origin", origin);
    function failure(code: string) {
      const error = Object.hasOwn(knownErrors, code)
        ? knownErrors[code]
        : undefined;
      return new Response(
        JSON.stringify({
          ok: false,
          error: {
            code: error ? code : "INTERNAL_ERROR",
            message: error?.message ?? "The request could not be completed.",
            fields: null,
          },
          requestId,
        }),
        { status: error?.status ?? 500, headers },
      );
    }
    if (!allowed) return failure("FORBIDDEN");
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    try {
      const authorization = request.headers.get("authorization");
      if (
        !authorization?.startsWith("Bearer ") ||
        authorization.length > 10_000
      )
        return failure("UNAUTHENTICATED");
      const token = authorization.slice(7);
      const verified = await backend.verifyUser(token);
      if (!verified) return failure("UNAUTHENTICATED");
      const path = new URL(request.url).pathname;
      const marker = path.indexOf("/v1/");
      // Supports the hosted /functions/v1/fsm-api/v1 prefix and local handler tests.
      const route = path.includes("/fsm-api/v1/")
        ? path.slice(path.indexOf("/fsm-api/v1/") + 8)
        : marker >= 0
          ? path.slice(marker)
          : path;
      let name: string;
      let args: Record<string, unknown>;
      let parse: (value: unknown) => unknown;
      let status = 200;
      const financeRoute =
        /^\/v1\/couples\/([^/]+)\/(comparison|financial-inputs|scenarios)(?:\/([^/]+))?$/.exec(
          route,
        );
      if (financeRoute) {
        const coupleId = uuid(financeRoute[1]);
        if (
          financeRoute[2] === "scenarios" &&
          financeRoute[3] &&
          request.method === "GET"
        ) {
          name = "fsm_get_scenario";
          args = {
            p_couple_id: coupleId,
            p_scenario_id: uuid(financeRoute[3]),
          };
          parse = parseScenario;
        } else {
          if (
            financeRoute[3] ||
            (financeRoute[2] === "scenarios"
              ? request.method !== "POST"
              : request.method !== "GET")
          )
            return failure("NOT_FOUND");
          if (typeof verified !== "object") return failure("UNAUTHENTICATED");
          const actorId = uuid(verified.id);
          const operation = await financeOperation(
            backend,
            actorId,
            coupleId,
            financeRoute[2] as "comparison" | "financial-inputs" | "scenarios",
            financeRoute[2] === "scenarios" ? await readBody(request) : null,
          );
          return new Response(
            JSON.stringify({ ok: true, data: operation.data, requestId }),
            {
              status: operation.status,
              headers,
            },
          );
        }
      } else if (request.method === "POST" && route === "/v1/couples") {
        const body = await readBody(request);
        exactKeys(body, ["requestId"], ["displayName"]);
        name = "fsm_create_session";
        args = {
          p_request_id: uuid(body.requestId),
          p_display_name: displayName(body.displayName),
        };
        parse = parseCreatedSession;
        status = 201;
      } else if (
        request.method === "POST" &&
        route === "/v1/invitations/redeem"
      ) {
        const body = await readBody(request);
        exactKeys(body, ["token"], ["displayName"]);
        name = "fsm_redeem_invitation";
        args = {
          p_token: invitationToken(body.token),
          p_display_name: displayName(body.displayName),
        };
        parse = parseRedeemedSession;
      } else {
        const questionnaireRoute =
          /^\/v1\/couples\/([^/]+)\/(questionnaire(?:\/(submit|reopen))?|privacy|answers\/([^/]+))$/.exec(
            route,
          );
        if (questionnaireRoute) {
          const coupleId = uuid(questionnaireRoute[1]);
          parse = parseQuestionnaire;
          if (
            request.method === "GET" &&
            questionnaireRoute[2] === "questionnaire"
          ) {
            name = "fsm_get_questionnaire";
            args = { p_couple_id: coupleId };
          } else {
            const body = await readBody(request);
            const expectedRevision = revision(body.expectedRevision);
            if (request.method === "PUT" && questionnaireRoute[4]) {
              exactKeys(body, ["questionCode", "value", "expectedRevision"]);
              const code = questionCode(questionnaireRoute[4]);
              if (body.questionCode !== code) throw new Error("INVALID_INPUT");
              name = "fsm_save_answer";
              args = {
                p_couple_id: coupleId,
                p_question_code: code,
                p_value: answerValue(code, body.value),
                p_expected_revision: expectedRevision,
              };
            } else if (
              request.method === "POST" &&
              questionnaireRoute[3] === "reopen"
            ) {
              exactKeys(body, ["expectedRevision"]);
              name = "fsm_reopen_questionnaire";
              args = {
                p_couple_id: coupleId,
                p_expected_revision: expectedRevision,
              };
            } else if (
              (request.method === "POST" &&
                questionnaireRoute[3] === "submit") ||
              (request.method === "PATCH" &&
                questionnaireRoute[2] === "privacy")
            ) {
              exactKeys(body, ["expectedRevision", "consent"]);
              const consent = privacyConsent(body.consent);
              name =
                questionnaireRoute[2] === "privacy"
                  ? "fsm_update_privacy"
                  : "fsm_submit_questionnaire";
              args = {
                p_couple_id: coupleId,
                p_expected_revision: expectedRevision,
                p_comparison: consent.comparison,
                p_budget: consent.budget,
              };
            } else return failure("NOT_FOUND");
          }
        } else {
          const match = /^\/v1\/couples\/([^/]+)(\/invitations)?$/.exec(route);
          if (!match) return failure("NOT_FOUND");
          const coupleId = uuid(match[1]);
          if (request.method === "GET" && !match[2]) {
            name = "fsm_get_session";
            args = { p_couple_id: coupleId };
            parse = parseSession;
          } else if (request.method === "POST" && match[2]) {
            if (request.body) {
              const body = await readBody(request);
              exactKeys(body, []);
            }
            name = "fsm_rotate_invitation";
            args = { p_couple_id: coupleId };
            parse = parseIssuedInvitation;
            status = 201;
          } else return failure("NOT_FOUND");
        }
      }
      const result = await backend.rpc(name, args, token);
      if (result.error)
        return failure(
          result.error.code === "42501" ? "FORBIDDEN" : result.error.message,
        );
      let data: unknown;
      try {
        if (name === "fsm_create_session") {
          const created = parseCreatedSession(result.data);
          data = created;
          status = created.invitation === null ? 200 : 201;
        } else data = parse(result.data);
      } catch {
        return failure("INTERNAL_ERROR");
      }
      // No request/response-body, token, or database-error logging.
      return new Response(JSON.stringify({ ok: true, data, requestId }), {
        status,
        headers,
      });
    } catch (error) {
      return failure(
        error instanceof Error && Object.hasOwn(knownErrors, error.message)
          ? error.message
          : "INTERNAL_ERROR",
      );
    }
  };
}
