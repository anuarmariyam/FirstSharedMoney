# Phase 4A: Backend Foundation

Status: completed in the explicitly approved test project lgboxbtxutgggvluhhqt.
All four migrations were applied and catalog-checked; fsm-api version 1 is ACTIVE
with verify_jwt=true. Real security checks passed 15/15, live browser integration
passed 1/1, unit tests passed 12/12, and offline UI checks passed 27/27. Typecheck,
lint, and build passed. Final read-only counts confirmed complete test cleanup.
See [PHASE4A_VERIFICATION.md](PHASE4A_VERIFICATION.md) for the current evidence;
SUPABASE_PREFLIGHT.md records the earlier read-only setup stage.

## Baseline and source scope

Phase 3 was rechecked with typecheck, lint, production build, and 27 Playwright
checks. Candidate files were inspected for secret filenames/common credential
formats before local commit 590a234:
chore: complete phase 3 frontend foundation. No push was performed.

Phase 4A adds only session/membership operations. The approved full schema is
not being redesigned: couples, partners, and session_invitations are the first
implemented slice. Financial tables and all related write operations are deferred.
current_agreement_version_id is guarded as NULL until a later migration creates
agreement_versions and installs the approved composite foreign key. Public DTOs
and financial domain contracts are unchanged.

## Layers and implemented paths

| Layer           | Files / responsibility                                                                                                |
| --------------- | --------------------------------------------------------------------------------------------------------------------- |
| SQL             | Four migrations: tables/constraints, indexes, RLS/grants, transaction functions/triggers                              |
| Edge            | supabase/functions/fsm-api: bounded JSON parsing, user verification, route allowlist, safe errors, exact CORS origins |
| Shared contract | supabase/functions/_shared/session-contract.ts: request and response boundaries using existing DTOs                   |
| Auth            | src/services/supabase.ts and AuthProvider: actual anonymous sign-in, SDK session persistence/refresh, identity events |
| Transport       | src/services/fsm-client.ts: actual JWT-bearing fetch, four operation implementations, validated responses             |
| UI              | SessionEntryPage, LiveSessionPage, useLiveSession, existing workspace layout                                          |

Supported logical routes are POST /v1/couples, GET /v1/couples/:id,
POST /v1/couples/:id/invitations, and POST /v1/invitations/redeem, under the
deployed function prefix. The four public RPCs are fsm_create_session,
fsm_get_session, fsm_rotate_invitation, and fsm_redeem_invitation.

Creation inserts A and issues an invitation transactionally. Repeating the same
creation request returns the existing session but cannot replay a raw token.
Rotation revokes the old unused invite and mints a new one. Redemption consumes
one invitation and inserts B under the couple row lock. A same-B retry is
idempotent while its invitation and membership remain valid; other users cannot
reuse a consumed invitation. No operation accepts a client-selected actor ID.

## Security properties encoded in source

- Separate Supabase Auth user sessions; an existing browser identity is never
  automatically replaced to join a partner's invitation.
- Browser session restoration uses the SDK. Existing-session reads never create
  an anonymous identity automatically. Initial signup is serialized across tabs
  with Web Locks and within a tab with an in-flight promise. Without Web Locks,
  an existing identity may be restored, but a new signup fails closed.
- Only user JWTs and a publishable key reach Edge/Data API calls. Phase 4A uses
  no elevated runtime credential. Build configuration rejects privileged VITE_
  settings and non-publishable project keys.
- Tables enable RLS from their first migration. No browser INSERT/UPDATE/DELETE
  grants; couples have a safe column SELECT grant, partners an owner-row policy.
  Invitation storage has no browser SELECT grant or permissive policy.
- Definer functions use an empty search_path, qualified relations, current
  auth.uid(), active membership checks, and explicit execution grants. Helper
  functions are not exposed as a public actor-lookup API.
- Slot uniqueness plus separate-user uniqueness enforce at most A/B. A deferred
  owner trigger requires every surviving couple's A to match its creator.
- Tokens contain 32 random bytes, are encoded as base64url, stored as SHA-256
  digests, expire at 24 hours, and never carry A's JWT. Rotation and redemption
  lock the same couple; expiry is rechecked after acquiring the lock.
- The URL fragment is captured only in memory and stripped immediately. Issued
  tokens are held only in provider memory and cleared on identity changes;
  neither tokens nor financial responses enter locator storage or app logs.
- A last-session UUID locator may be stored under the current Auth user ID.
  It is not an access capability; every restored page still requests server
  authorization. Raw questionnaires remain fictional/demo-only in Phase 4A.

The session-management rules above passed the real integration checks recorded
in PHASE4A_VERIFICATION.md. Shared preference/budget consents and financial
answer privacy policies are not implemented against live financial data yet.

## Tests and what they prove

| Command                   | Evidence / boundary                                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| npm.cmd run typecheck     | Strict frontend, tooling, tests, and Edge-source contracts; not a Deno runtime test                                |
| npm.cmd run lint          | Source analysis                                                                                                    |
| npm.cmd run build         | Local production bundle; does not contact or validate a cloud database                                             |
| npm.cmd run test:backend  | Local configuration/HTTP transport unit tests with mocks; not real Auth/RLS verification                           |
| npm.cmd run test:ui       | Offline fictional UI regression on port 5174, explicitly excluding Supabase                                        |
| npm.cmd run test:security | Real A/B/C Auth, PostgREST/RPC, Edge, hashing, expiry, race, and access tests; requires actual test project and DB |
| npm.cmd run test:live     | Real isolated browser contexts, create/join/reload/no takeover; requires actual project and deployed function      |

The offline UI server uses ui-test mode to clear public backend settings even
if .env.local later connects the operator's browser. It cannot accidentally
perform cloud writes. Live tests use a separate acknowledged project and port
5175, with automatic traces/screenshots disabled. Missing cloud settings fail
preflight explicitly; those commands must not be reported as passing.

Real security cases prepared: A creation; B's distinct identity; same-A denial;
third-user denial; invalid, revoked, expired and replayed tokens; nonmember
session reads; direct row insert/update and forged RPC/body identities; private
hash-table access; concurrent redemption; active JWT with expired membership;
and identity restoration after browser reload.

### Historical local verification before cloud authorization

- Typecheck, lint, and production build completed successfully.
- All 12 configuration/transport unit tests passed. Their backend dependencies
  are mocks; they provide no database authorization evidence.
- The final offline Playwright run passed all 27 checks across desktop, tablet,
  and mobile in 55.9 seconds, including console-error assertions. An earlier
  run had two questionnaire failures with ERR_NETWORK_IO_SUSPENDED after a long
  execution pause. Those failures were not filtered out; the test now waits for
  each question URL transition, and the full final run passed without retries.
- Both live commands exited with code 1 at missing-configuration preflight.
  No real security or live browser test ran, and zero migrations were applied.
- The existing local frontend returned HTTP 200 at /create on port 5173.
- git diff --check reported no whitespace errors. A filename/credential-format
  scan covered 85 tracked and untracked candidate files with no matches; this
  is a limited scan, not a guarantee that every possible secret format is covered.
- Ignored local environment paths were checked. Phase 4A has since been preserved
  in backend/fsm-core at checkpoint 9a9ddeb. main remains at the Phase 3 baseline
  590a234; frontend/fsm-ux adds only collaboration documents to that baseline.
  Local environment files were verified unchanged across branch setup. No push occurred.

## Remaining boundaries

The existing test project is linked, all four migrations are applied, and the
single fsm-api function is deployed. Real Auth/RLS/Edge/live verification passed.
Supabase CLI 3.1.0 was obtained via npx without a global installation. Docker,
Deno, and a local PostgreSQL server were not installed. The pg dependency is
only a Node test client for the remote test database. Direct database credentials
and TLS are verified. The owner explicitly authorized only this test project,
the four migrations, one function, and test-owned fixture creation/cleanup.

See DEVELOPMENT_STORAGE.md for the targeted C/D storage audit. The prepared
pre_migration_inventory.sql reads object names and aggregate Auth/Storage counts
without selecting private records. It must be run before requesting cloud-write
approval; the read-only inventory and dry-run results are in SUPABASE_PREFLIGHT.md.

Session deletion/self-revocation endpoints, expiry cleanup jobs, CAPTCHA UI,
questionnaire persistence, conflict/financial engines, agreement versioning,
approvals, and real two-person jury demo are not implemented. The creation quota
counts existing session rows in the last hour; revisit durable quota accounting
when session deletion is introduced. No real financial data should be collected
until the remaining access boundary and database tests are complete.

Use [SUPABASE_SETUP.md](SUPABASE_SETUP.md) for account-owner setup and the
unchanged full design documents for later phases. Phase 4B is not authorized.
