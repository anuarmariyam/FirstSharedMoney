import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createSessionHandler,
  type SessionBackend,
} from "../../supabase/functions/fsm-api/handler.ts";

// Transport mocks only. These tests do not verify Supabase Auth, SQL, or RLS.
const id = "cc7754d6-fd47-48b9-a9a2-dbd547f3031a";
const partnerId = "cc7754d6-fd47-48b9-a9a2-dbd547f3031b";
const session = {
  id,
  mode: "standard",
  currency: "USD",
  questionnaireVersion: 1,
  stage: "waiting_for_partner",
  viewerPartnerId: partnerId,
  partners: [
    {
      id: partnerId,
      coupleId: id,
      slot: "A",
      displayName: "Test A",
      questionnaireStatus: "draft",
      joinedAt: "2026-11-14T12:00:00Z",
    },
  ],
  currentAgreementVersionId: null,
  createdAt: "2026-11-14T12:00:00Z",
  expiresAt: "2026-12-14T12:00:00Z",
};
const origin = "http://127.0.0.1:5173";
function setup(
  data: unknown = session,
  error: { message: string; code?: string } | null = null,
) {
  const calls: {
    name: string;
    args: Record<string, unknown>;
    token: string;
  }[] = [];
  const backend: SessionBackend = {
    verifyUser: async (token) => token === "transport-unit-only",
    rpc: async (name, args, token) => {
      calls.push({ name, args, token });
      return { data, error };
    },
  };
  return { calls, handler: createSessionHandler(backend, [origin]) };
}
function request(path: string, body?: unknown, token = "transport-unit-only") {
  return new Request(`http://127.0.0.1/functions/v1/fsm-api/v1${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      authorization: `Bearer ${token}`,
      origin,
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
test("hosted route prefix returns only the validated session DTO", async () => {
  const { handler, calls } = setup({
    ...session,
    invitationHash: "must not be serialized",
  });
  const response = await handler(request(`/couples/${id}`));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = await response.json();
  assert.equal(body.data.id, id);
  assert.equal("invitationHash" in body.data, false);
  assert.equal(calls[0].name, "fsm_get_session");
  assert.deepEqual(calls[0].args, { p_couple_id: id });
});
test("unverified credentials and foreign origins never reach RPCs", async () => {
  const { handler, calls } = setup();
  assert.equal(
    (await handler(request(`/couples/${id}`, undefined, "invalid-unit-token")))
      .status,
    401,
  );
  const foreign = new Request(`http://127.0.0.1/v1/couples/${id}`, {
    headers: {
      origin: "https://example.invalid",
      authorization: "Bearer transport-unit-only",
    },
  });
  assert.equal((await handler(foreign)).status, 403);
  assert.equal(calls.length, 0);
});
test("actor, partner, mode, and unknown fields cannot enter create RPC arguments", async () => {
  for (const field of [
    "partnerId",
    "authUserId",
    "slot",
    "mode",
    "unexpected",
  ]) {
    const { handler, calls } = setup();
    const response = await handler(
      request("/couples", {
        requestId: id,
        displayName: "Test A",
        [field]: partnerId,
      }),
    );
    assert.equal(response.status, 400);
    assert.equal(calls.length, 0);
  }
});
test("created-session response and idempotency key use the approved API shape", async () => {
  for (const invitation of [
    null,
    { token: "a".repeat(43), expiresAt: "2026-11-15T12:00:00Z" },
  ]) {
    const { handler, calls } = setup({ session, invitation });
    const response = await handler(
      request("/couples", { requestId: id, displayName: " Test A " }),
    );
    assert.equal(response.status, invitation === null ? 200 : 201);
    assert.deepEqual((await response.json()).data.invitation, invitation);
    assert.deepEqual(calls[0].args, {
      p_request_id: id,
      p_display_name: "Test A",
    });
  }
});
test("malformed invitation input is rejected without a database call", async () => {
  const { handler, calls } = setup();
  assert.equal(
    (
      await handler(
        request("/invitations/redeem", { token: "not-a-capability" }),
      )
    ).status,
    404,
  );
  assert.equal(calls.length, 0);
});
test("rotation cannot accept a client-selected token or partner identity", async () => {
  const { handler, calls } = setup();
  assert.equal(
    (
      await handler(
        request(`/couples/${id}/invitations`, { token: "chosen", partnerId }),
      )
    ).status,
    400,
  );
  assert.equal(calls.length, 0);
});
test("oversized bodies and malformed JSON fail with no RPC side effect", async () => {
  const { handler, calls } = setup();
  assert.equal(
    (
      await handler(
        request("/couples", { requestId: id, displayName: "x".repeat(70_000) }),
      )
    ).status,
    400,
  );
  const malformed = new Request("http://127.0.0.1/v1/couples", {
    method: "POST",
    headers: {
      authorization: "Bearer transport-unit-only",
      "content-type": "application/json",
    },
    body: "{",
  });
  assert.equal((await handler(malformed)).status, 400);
  assert.equal(calls.length, 0);
});
test("unexpected SQL errors are sanitized instead of echoing private details", async () => {
  const { handler } = setup(null, { message: "private database diagnostic" });
  const response = await handler(request(`/couples/${id}`));
  assert.equal(response.status, 500);
  assert.equal(
    (await response.text()).includes("private database diagnostic"),
    false,
  );
});
test("CORS preflight has no authentication or database side effects", async () => {
  const { handler, calls } = setup();
  const response = await handler(
    new Request("http://127.0.0.1/v1/couples", {
      method: "OPTIONS",
      headers: { origin },
    }),
  );
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), origin);
  assert.equal(calls.length, 0);
});
