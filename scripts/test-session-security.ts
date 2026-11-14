import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Client } from "pg";
import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { liveEnvironment } from "../tests/live/environment.ts";
import {
  parseCreatedSession,
  parseIssuedInvitation,
  parseRedeemedSession,
  parseSession,
} from "../supabase/functions/_shared/session-contract.ts";

// This suite uses real Supabase Auth, PostgREST, Edge requests, and a test DB.
// Never replace those dependencies with frontend or in-memory authorization mocks.
async function main() {
  const env = liveEnvironment();
  const database = new Client({
    connectionString: env.databaseURL,
    ssl: {
      rejectUnauthorized: true,
      ...(env.caFile ? { ca: readFileSync(env.caFile, "utf8") } : {}),
    },
    connectionTimeoutMillis: 10000,
    statement_timeout: 10000,
    query_timeout: 10000,
  });
  const userIds: string[] = [];
  let phase = "connect to the acknowledged test database";
  let checks = 0;
  let cleanupFailed = false;
  function check(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
  }
  async function run(label: string, operation: () => Promise<void>) {
    phase = label;
    await operation();
    checks++;
    console.log(`PASS ${label}`);
  }
  const clients: SupabaseClient[] = [];
  async function anonymous() {
    const client = createClient(env.url, env.key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    const response = await client.auth.signInAnonymously();
    check(
      !response.error &&
        response.data.session &&
        response.data.user?.is_anonymous,
      "Real anonymous sign-in failed.",
    );
    userIds.push(response.data.user.id);
    clients.push(client);
    return {
      client,
      user: response.data.user,
      jwt: response.data.session.access_token,
    };
  }
  async function rpc(
    client: SupabaseClient,
    name: string,
    args: Record<string, unknown>,
  ) {
    const response = await client.rpc(name, args);
    check(!response.error, "A required real RPC failed.");
    return response.data as unknown;
  }
  async function denied(
    client: SupabaseClient,
    name: string,
    args: Record<string, unknown>,
    code?: string,
  ) {
    const response = await client.rpc(name, args);
    check(
      response.error && (!code || response.error.message === code),
      "An expected authorization rejection did not occur.",
    );
  }
  async function api(path: string, jwt: string, body?: unknown) {
    const response = await fetch(`${env.url}/functions/v1/fsm-api/v1${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        apikey: env.key,
        origin: env.appOrigin,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    return {
      status: response.status,
      body: (await response.json()) as {
        ok?: boolean;
        data?: unknown;
        error?: { code?: string };
      },
    };
  }
  try {
    await database.connect();
    const present = await database.query(
      "select to_regclass('public.couples') is not null and to_regclass('fsm_private.session_invitations') is not null as ready",
    );
    check(present.rows[0].ready, "Required migrations have not been applied.");
    phase = "real independent anonymous identities";
    const identities = await Promise.allSettled([
      anonymous(),
      anonymous(),
      anonymous(),
    ]);
    const [a, b, c] = identities.map((identity) => {
      if (identity.status === "rejected")
        throw new Error("Anonymous sign-in failed.");
      return identity.value;
    });
    check(
      new Set(userIds).size === 3,
      "Anonymous identities are not distinct.",
    );
    console.log("PASS real independent anonymous identities");
    checks++;
    const requestId = randomUUID();
    const created = parseCreatedSession(
      await rpc(a.client, "fsm_create_session", {
        p_request_id: requestId,
        p_display_name: "Security Test A",
      }),
    );
    check(
      created.invitation &&
        created.session.partners.length === 1 &&
        created.session.partners[0].slot === "A",
      "Creation did not produce only Partner A.",
    );
    const originalToken = created.invitation.token;
    await run(
      "create A and store only a cryptographic invitation hash",
      async () => {
        const stored = await database.query(
          "select token_hash, expires_at - created_at as lifetime from fsm_private.session_invitations where couple_id = $1",
          [created.session.id],
        );
        check(
          stored.rowCount === 1 &&
            stored.rows[0].token_hash ===
              createHash("sha256").update(originalToken).digest("hex"),
          "The database invitation digest does not match.",
        );
        check(
          /^[A-Za-z0-9_-]{43}$/.test(originalToken) &&
            !originalToken.includes(".") &&
            !originalToken.includes(a.jwt),
          "Invitation is not an independent 256-bit capability.",
        );
        const duration = await database.query(
          "select extract(epoch from (expires_at - created_at)) as seconds from fsm_private.session_invitations where couple_id = $1",
          [created.session.id],
        );
        check(
          Number(duration.rows[0].seconds) === 86400,
          "The invitation lifetime is not 24 hours.",
        );
      },
    );
    await run(
      "create retries are idempotent and never replay a raw token",
      async () => {
        const repeated = parseCreatedSession(
          await rpc(a.client, "fsm_create_session", {
            p_request_id: requestId,
            p_display_name: "Security Test A",
          }),
        );
        check(
          repeated.session.id === created.session.id &&
            repeated.invitation === null,
          "Creation retry created another session or replayed a secret.",
        );
        await denied(
          a.client,
          "fsm_create_session",
          { p_request_id: requestId, p_display_name: "Changed name" },
          "REQUEST_ID_REUSED",
        );
      },
    );
    await run("A cannot take B using the same identity", async () => {
      await denied(
        a.client,
        "fsm_redeem_invitation",
        { p_token: originalToken },
        "IDENTITY_ALREADY_JOINED",
      );
    });
    await run(
      "direct database writes and forged RPC identities are denied",
      async () => {
        const forged = await c.client.from("partners").insert({
          couple_id: created.session.id,
          auth_user_id: c.user.id,
          slot: "B",
          display_name: "Forged B",
          access_expires_at: created.session.expiresAt,
        });
        check(!!forged.error, "An outsider inserted a partner directly.");
        await denied(a.client, "fsm_redeem_invitation", {
          p_token: originalToken,
          p_partner_id: randomUUID(),
        });
        const count = await database.query(
          "select count(*)::int as count from public.partners where couple_id = $1",
          [created.session.id],
        );
        check(
          count.rows[0].count === 1,
          "A forged request changed membership.",
        );
      },
    );
    await run(
      "only A can replace an unused invitation and the old token is revoked",
      async () => {
        await denied(
          c.client,
          "fsm_rotate_invitation",
          { p_couple_id: created.session.id },
          "NOT_FOUND",
        );
      },
    );
    const replacement = parseIssuedInvitation(
      await rpc(a.client, "fsm_rotate_invitation", {
        p_couple_id: created.session.id,
      }),
    );
    await run("invalid and revoked invitations share a rejection", async () => {
      check(replacement.token !== originalToken, "Rotation reused a token.");
      await denied(
        b.client,
        "fsm_redeem_invitation",
        { p_token: originalToken },
        "INVALID_INVITATION",
      );
      await denied(
        b.client,
        "fsm_redeem_invitation",
        { p_token: "malformed" },
        "INVALID_INVITATION",
      );
      await denied(
        b.client,
        "fsm_redeem_invitation",
        { p_token: "x".repeat(43) },
        "INVALID_INVITATION",
      );
    });
    const joined = parseRedeemedSession(
      await rpc(b.client, "fsm_redeem_invitation", {
        p_token: replacement.token,
        p_display_name: "Security Test B",
      }),
    );
    await run(
      "independent B joins exactly once and own retries are safe",
      async () => {
        check(
          joined.partner.slot === "B" && joined.session.partners.length === 2,
          "B did not join the session.",
        );
        const repeated = parseRedeemedSession(
          await rpc(b.client, "fsm_redeem_invitation", {
            p_token: replacement.token,
          }),
        );
        check(
          repeated.partner.id === joined.partner.id,
          "A same-user retry created another member.",
        );
        await denied(
          b.client,
          "fsm_rotate_invitation",
          { p_couple_id: created.session.id },
          "FORBIDDEN",
        );
      },
    );
    await run(
      "third-party replay and third-seat creation are denied",
      async () => {
        await denied(
          c.client,
          "fsm_redeem_invitation",
          { p_token: replacement.token },
          "INVALID_INVITATION",
        );
        await denied(
          a.client,
          "fsm_rotate_invitation",
          { p_couple_id: created.session.id },
          "SESSION_FULL",
        );
        const count = await database.query(
          "select count(*)::int as count, count(distinct auth_user_id)::int as users from public.partners where couple_id = $1",
          [created.session.id],
        );
        check(
          count.rows[0].count === 2 && count.rows[0].users === 2,
          "The two-identity membership invariant failed.",
        );
      },
    );
    await run(
      "RLS isolates sessions and owner partner rows through PostgREST",
      async () => {
        const outside = await c.client
          .from("couples")
          .select("id")
          .eq("id", created.session.id);
        check(
          !outside.error && outside.data?.length === 0,
          "An outsider could read the session.",
        );
        const own = await a.client
          .from("partners")
          .select("id, auth_user_id")
          .eq("couple_id", created.session.id);
        check(
          !own.error &&
            own.data?.length === 1 &&
            own.data[0].auth_user_id === a.user.id,
          "A could read B private partner metadata.",
        );
        const privateTable = await a.client
          .schema("fsm_private")
          .from("session_invitations")
          .select("*");
        check(!!privateTable.error, "The invitation hash table is exposed.");
        const update = await a.client
          .from("partners")
          .update({ auth_user_id: c.user.id })
          .eq("id", created.session.viewerPartnerId);
        check(!!update.error, "A direct identity mutation was not rejected.");
        await denied(
          c.client,
          "fsm_get_session",
          { p_couple_id: created.session.id },
          "NOT_FOUND",
        );
      },
    );
    await run(
      "unauthenticated API-key-only requests cannot call membership RPCs",
      async () => {
        const anonymous = createClient(env.url, env.key, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        await denied(anonymous, "fsm_get_session", {
          p_couple_id: created.session.id,
        });
      },
    );
    await run(
      "Edge checks actual user JWTs, object access, and forged body fields",
      async () => {
        const own = await api(`/couples/${created.session.id}`, a.jwt);
        check(
          own.status === 200 &&
            own.body.ok &&
            parseSession(own.body.data).viewerPartnerId ===
              created.session.viewerPartnerId,
          "A real Edge session load failed.",
        );
        const outsider = await api(`/couples/${created.session.id}`, c.jwt);
        check(
          outsider.status === 404 && outsider.body.error?.code === "NOT_FOUND",
          "Edge disclosed a foreign session.",
        );
        const forged = await api("/couples", a.jwt, {
          requestId: randomUUID(),
          displayName: "Test",
          partnerId: joined.partner.id,
        });
        check(
          forged.status === 400,
          "Edge accepted a client-selected partner identity.",
        );
        const invalidJwt = await api(
          `/couples/${created.session.id}`,
          "invalid-test-jwt",
        );
        check(invalidJwt.status === 401, "Edge accepted an invalid JWT.");
      },
    );
    const expired = parseCreatedSession(
      await rpc(a.client, "fsm_create_session", { p_request_id: randomUUID() }),
    );
    await run(
      "an actually expired database invitation is rejected",
      async () => {
        check(expired.invitation, "Missing expiry fixture.");
        await database.query(
          "update fsm_private.session_invitations set created_at = clock_timestamp() - interval '2 hours', expires_at = clock_timestamp() - interval '1 hour' where couple_id = $1",
          [expired.session.id],
        );
        await denied(
          c.client,
          "fsm_redeem_invitation",
          { p_token: expired.invitation.token },
          "INVALID_INVITATION",
        );
        const rejected = await api("/invitations/redeem", c.jwt, {
          token: expired.invitation.token,
        });
        check(
          rejected.status === 404 &&
            rejected.body.error?.code === "INVALID_INVITATION",
          "Edge did not reject the expired invitation.",
        );
      },
    );
    const racing = parseCreatedSession(
      await rpc(a.client, "fsm_create_session", { p_request_id: randomUUID() }),
    );
    await run("concurrent redemption creates only one B", async () => {
      check(racing.invitation, "Missing race fixture.");
      const responses = await Promise.all([
        b.client.rpc("fsm_redeem_invitation", {
          p_token: racing.invitation.token,
        }),
        c.client.rpc("fsm_redeem_invitation", {
          p_token: racing.invitation.token,
        }),
      ]);
      check(
        responses.filter((response) => !response.error).length === 1,
        "Concurrent callers did not produce exactly one winner.",
      );
      const count = await database.query(
        "select count(*)::int as count from public.partners where couple_id = $1",
        [racing.session.id],
      );
      check(
        count.rows[0].count === 2,
        "Concurrent redemption exceeded two participants.",
      );
    });
    await run(
      "expired membership cannot read despite an existing valid JWT",
      async () => {
        await database.query(
          "update public.partners set access_expires_at = clock_timestamp() + interval '50 milliseconds' where id = $1",
          [joined.partner.id],
        );
        await new Promise((resolve) => setTimeout(resolve, 100));
        await denied(
          b.client,
          "fsm_get_session",
          { p_couple_id: created.session.id },
          "NOT_FOUND",
        );
        const rows = await b.client
          .from("couples")
          .select("id")
          .eq("id", created.session.id);
        check(
          !rows.error && rows.data?.length === 0,
          "RLS ignored membership expiry.",
        );
      },
    );
    console.log(`Completed ${checks} real Supabase security checks.`);
  } catch {
    throw new Error(
      `Security verification failed at: ${phase}. Response bodies and credentials are deliberately suppressed.`,
    );
  } finally {
    // Only IDs returned by actual Auth/creation calls in this run are eligible.
    try {
      if (userIds.length)
        await database.query(
          "delete from public.couples where created_by_auth_user_id = any($1::uuid[])",
          [userIds],
        );
      if (userIds.length)
        await database.query(
          "delete from auth.users u where u.id = any($1::uuid[]) and not exists (select 1 from public.partners p where p.auth_user_id = u.id) and not exists (select 1 from public.couples c where c.created_by_auth_user_id = u.id)",
          [userIds],
        );
    } catch {
      cleanupFailed = true;
      console.error(
        "Targeted security-test cleanup failed; inspect only test-created records.",
      );
    }
    await Promise.all(
      clients.map((client) =>
        client.auth.signOut({ scope: "local" }).catch(() => undefined),
      ),
    );
    await database.end().catch(() => undefined);
  }
  if (cleanupFailed)
    throw new Error(
      "Targeted test cleanup failed; inspect test-only records in the disposable project.",
    );
}
main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : "Security tests failed without logging credentials.",
  );
  process.exitCode = 1;
});
