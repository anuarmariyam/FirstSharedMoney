# FirstSharedMoney (FSM)

**Two people. Different money habits. One shared plan.**

A web planning product for couples beginning their first shared financial life.

Current delivery: **Phase 5 — Conflict Detection & Financial Simulation**.
Consent-gated comparison, exact-cent financial calculations, five stress tests,
and immutable saved scenarios are verified in the approved FSM test project.
Nine migrations are applied and fsm-api version 3 is active with JWT verification.
See [Phase 5 implementation and verification](docs/PHASE5.md),
[Phase 4B verification](docs/PHASE4B_VERIFICATION.md) and the earlier
[Phase 4A baseline](docs/PHASE4A_VERIFICATION.md). Phase 6 has not started.

## Start here

- [Existing Supabase test project setup reference](docs/SUPABASE_SETUP.md)
- [Phase 4A real test results](docs/PHASE4A_VERIFICATION.md)
- [Phase 4B implementation and test results](docs/PHASE4B_VERIFICATION.md)
- [Phase 4A implementation, security boundaries, and verification status](docs/PHASE4A_BACKEND.md)
- [Full architecture and API design](docs/ARCHITECTURE.md)
- [Database schema](docs/DATABASE_SCHEMA.md)
- [Target user flow and questionnaire](docs/USER_FLOW.md)
- [MVP scope](docs/MVP_SCOPE.md)

Never send private keys or database passwords through chat or commit them.
The checked-in environment examples contain no working URL or key.

## Run the local application

Use Node.js satisfying the installed Vite engine range. Initialization used
Node.js 24.11.1 and npm 11.6.2. From PowerShell:

```powershell
Set-Location D:\FirstSharedMoney
npm.cmd ci
npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Open http://127.0.0.1:5173/. Stop with Ctrl+C. The .cmd suffix avoids PowerShell
script-policy restrictions. Dependencies are inside this project on D.
The user npm cache remains D:\npm-cache; command-scoped checkout-only caching
can be selected without changing the user setting:

```powershell
npm.cmd --cache .\node_modules\.cache\npm run build
```

## Phase 3 frontend that still works

The responsive landing page and fictional workspace include all 15 specified
questionnaire prompts, exact-cent input validation, progress and Previous/Next
navigation, separate sharing choices, discussion examples, simulator controls,
editable agreement rules, and an explicitly unapproved draft document.

The demo is not authenticated and does not represent a stored couple. All its
form data is held in memory and resets on refresh. Use fictional information.
Financial/comparison results are hand-authored fixtures, not algorithms or
results derived from the visitor's questionnaire. Changed simulator input hides
the primary sample result; the read-only baseline chart remains labeled.

## Phase 4A session source

After actual project setup, the integrated code calls real Supabase APIs for:

- Explicit anonymous sign-in, with existing-browser identity restoration.
- A creating a session and receiving a one-use B invitation.
- A replacing an unused invitation, revoking the old one.
- B redeeming an invitation under a separate Auth identity.
- Loading authorized session membership and refreshing status.

These paths passed real cloud security and isolated-browser integration checks.
With no configuration, Create/Join remain disabled instead of simulating success.
No local state is treated as a verified identity, membership, or approval.

Root .env.local requires the actual VITE_SUPABASE_URL and
VITE_SUPABASE_PUBLISHABLE_KEY. Server-only/privileged VITE_ settings are rejected.
The Edge Function needs only a publishable key and verified user JWTs in Phase 4A;
no service_role runtime key is needed.

Invitation fragments are captured only in memory and stripped immediately.
Issuance returns the raw token once; SQL stores only its digest. Refreshing A's
page loses that in-memory raw invitation, so A can issue a replacement. Losing
the browser's Auth session has no automatic account recovery.

## Private questionnaire persistence

The 15-question live flow saves valid answers privately and restores completed
saves after refresh. Next/Submit flush pending writes. Loading, unsaved changes,
network retry, incomplete answers, and stale revisions have explicit states.
Conflicting tabs preserve unsaved input and require a review before another write.

Submission allows either or both sharing permissions to remain off. Raw answers
and notes are never exposed to the other partner, even with consent. Editing
submitted answers requires reopening, which clears both permissions and retains
the answers as a draft. Sharing permissions can also be changed independently.
The original in-memory Demo and visual design remain intact.

## Routes

| Route                                 | Behavior                                                               |
| ------------------------------------- | ---------------------------------------------------------------------- |
| /                                     | Landing                                                                |
| /create                               | Actual create flow when configured; honest unavailable state otherwise |
| /join#token=...                       | In-memory invitation capture and explicit join                         |
| /sessions/:coupleId                   | Authorized real session status when configured                         |
| /sessions/:coupleId/questionnaire     | Owner-only persisted questions and answers                             |
| /sessions/:coupleId/questionnaire/consent | Submit or update independent sharing choices                         |
| /sessions/:coupleId/questionnaire/complete | Persisted submission status; reopen for editing                     |
| /sessions/demo                        | Separate fictional workspace                                           |
| /sessions/demo/questionnaire?step=1   | Sequential 15-question preview                                         |
| /sessions/demo/questionnaire/consent  | Preview sharing choices                                                |
| /sessions/demo/questionnaire/complete | Local completion, not server submission                                |
| /sessions/demo/differences            | Fictional comparison examples                                          |
| /sessions/demo/simulator              | Static examples and financial input UI                                 |
| /sessions/demo/agreement              | Local draft rules                                                      |
| /sessions/demo/agreement/preview      | Unapproved document                                                    |

Live comparison requires both comparison consents; shared financial inputs and
scenarios independently require both budget consents and submitted questionnaires.
The server calculates scenarios and rechecks revisions before saving. Saved
scenario URLs restore the form after refresh without storing financial amounts
in localStorage. A session UUID is only a locator; it cannot grant access.
Anonymous Auth persists in the browser profile.
Do not switch A's identity to fill B: use a separate profile or device.

## Source structure

- src/components: existing shared UI and workspace layout.
- src/features/questionnaire: catalog, form controls, input validation.
- src/engines: deterministic conflict comparison and BigInt financial calculations.
- src/features/comparison and simulator: live integration and separate Demo fixtures.
- src/features/agreement: local rule validation only.
- src/features/session: create/join handling and live status UI.
- src/app and src/hooks: separate demo state, actual Auth events, live loading.
- src/services: Supabase SDK and typed session/questionnaire/comparison/scenario adapter.
- src/types: approved Phase 2 domain/API/engine contracts.
- supabase/migrations: session, questionnaire and scenario tables, indexes, RLS and RPCs.
- supabase/functions: authenticated routed Edge Function and shared validation.
- tests/backend: transport/configuration unit tests.
- tests/ui: offline frontend regression tests.
- tests/live and scripts/test-session-security.ts: actual cloud verification.

Agreement engine, independent approval, payment, PDF export, cleanup job, and
public deployment are not implemented. Phase 6 requires separate authorization.

## Local verification

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd run test:backend
npm.cmd run test:ui
```

Strict typechecking covers frontend, tooling, tests, and Edge-source contracts.
It is not proof of Deno execution or a deployed database. Backend unit tests use
transport mocks and must not be described as real Auth/RLS tests.

The offline Playwright suite starts a separate server on port 5174 in ui-test
mode, which explicitly removes Supabase configuration. It cannot accidentally
write to a real project. It checks desktop/tablet/mobile, navigation, form
validation, sharing choices, keyboard access, fixture boundaries, local draft
editing, memory reset, invitation fragment removal, and horizontal overflow.
Browser console errors fail the suite. Installed Microsoft Edge is used.

Screenshots and test results are written under ignored artifacts/. No financial
or authentication live-test trace is intentionally captured.

## Real cloud verification

After configuring a separate disposable test project as described in
SUPABASE_SETUP.md, copy tests/security.env.example to ignored root
.env.security.local, supply the actual project/database settings, and explicitly
acknowledge targeted test mutations:

```powershell
npm.cmd run test:security
npm.cmd run test:questionnaire
npm.cmd run test:finance
npm.cmd run test:live
```

The security suites exercise real A/B/C Auth identities, PostgREST/RPC, Edge,
expiry, revocation, replay, direct-write denials, identity forgery, concurrent
join, and expired membership. The live browser test checks separate identities
and persistence after reload, owner-only answers, conflict/network recovery,
independent consents, and reopening on isolated port 5175.

All four commands fail preflight if the actual test project is missing. Such a result
means **cloud tests did not run**, not that security passed. Tests create only
fictional session data and clean up records owned by their newly created users.
Database TLS verification stays enabled.

Runtime addition: @supabase/supabase-js. Development additions: pg and @types/pg,
which are remote database clients/types, not a PostgreSQL server. Docker, local
PostgreSQL, Deno CLI, .NET, and Python ML libraries were not installed.

Phase 3 is preserved on main at local commit 590a234. Phase 4A is saved in
backend/fsm-core at checkpoint 9a9ddeb, followed by collaboration documentation.
The frontend/fsm-ux branch starts at stable main and adds only collaboration
instructions. See [the two-developer workflow](docs/COLLABORATION.md).
main and frontend/fsm-ux were published earlier with owner approval. The backend
branch has not been pushed. Nine migrations and one test Edge Function were
applied/deployed after separate explicit approval. No Vercel website deployment
or merge was performed. Phase 5 is verified; Phase 6 has not started.
