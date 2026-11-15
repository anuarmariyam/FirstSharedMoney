# Vercel Release Preparation

## Current release candidate

Use `integration/fsm-frontend-review`, not the older remote main or backend tip.
It contains Phase 6, reviewed Member 2 presentation, deterministic Insights and
the separately verified fictional-data Qwen PoC. Member 3's published tip remains
the handoff base; no new implementation or merge was found during final fetch.
No public website has been deployed by this preparation.

Local review server: http://127.0.0.1:5173/
Demo: http://127.0.0.1:5173/sessions/demo
Create: http://127.0.0.1:5173/create
Restart in PowerShell if the agent session ends:

```powershell
Set-Location D:\FirstSharedMoney
npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

For two partners use separate browser profiles/devices. Invitations carry a
one-time token; a session address alone does not confer access. Use fictional
financial details in the existing FSM test backend. Anonymous access cannot be
recovered automatically after browser storage is cleared.

## Prepared files

`vercel.json` selects Vite, `npm run build`, output `dist`, and the official SPA
rewrite to `/index.html` for direct React Router links. `.vercelignore` excludes
local environments, keys, dependencies, artifacts and CLI cache from CLI uploads.
Git already ignores secret environments. No package, engine, auth or migration
change is required. Actual Vercel routing/build behavior awaits deployment.

Official references checked on 2026-11-15:
- https://vercel.com/docs/frameworks/frontend/vite
- https://vercel.com/docs/plans/hobby
- https://vercel.com/docs/limits/fair-use-guidelines

Hobby is a free plan with usage limits and no paid upgrade authorized here.
The owner's account/plan has not been inspected: no local Vercel project link,
CLI or VERCEL_TOKEN was found. Do not select Pro/trial, add a card, buy a domain
or enable paid add-ons. Stop if the account/import flow requires paid access.

## Safe Git promotion plan — not executed

1. Review the final local release-preparation commit and its secret scan/tests.
2. Re-fetch before promotion. Confirm remote backend contains no unknown commits.
3. After owner approval, fast-forward local backend/fsm-core to the reviewed
   integration tip; no conflict resolution is needed with the current graph.
4. Publish only specifically approved refs, then open/review backend -> main.
   Main is currently an ancestor, but promotion still needs separate explicit
   owner approval. Never force-push or merge another contributor's branch.
5. Publish the approved release commit before Git-based Vercel import. Confirm
   the selected deployment branch/SHA; old main currently contains Phase 3 only.

Do not trigger automatic Vercel builds on old main. If a Vercel project already
exists when continuing, inspect it first rather than creating a duplicate.

## Owner dashboard steps — stop before Deploy until approved

1. Log into the owner's Vercel account. Confirm Settings/Billing shows Hobby.
2. After Git publication is approved/completed, choose Add New -> Project and
   import `anuarmariyam/FirstSharedMoney`; grant access only to that repository.
3. Select the approved release branch/commit. Root directory is repository root.
   Framework: Vite. Install: `npm ci`. Build: `npm run build`. Output: `dist`.
   Match the verified Node 24 toolchain using available Node 24.x settings.
4. Add only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, copied locally
   from the existing test configuration, to the intended deployment environment.
   These are public client settings; never add GROQ_API_KEY, database URLs or
   passwords, service_role/server keys, or upload any local .env file.
5. Review the settings. Clicking Deploy publishes a site and requires the owner's
   separate permission. Keep the assigned vercel.app domain; no paid domain needed.
6. Record the actual successful HTTPS URL; do not guess it. Check the deployed
   SHA, Home, Demo, direct /create and /sessions/demo/simulator refresh.
7. Ensure the jury link is accessible without Vercel login. Review deployment
   protection for that specific approved public deployment; do not disable
   Supabase authentication, JWT, TLS, RLS or partner authorization.

## Supabase origin boundary

Existing local Edge configuration permits only localhost origins on 5173/5175.
The new exact HTTPS origin will need separate approved addition to
`FSM_ALLOWED_ORIGINS` in FSM test project `lgboxbtxutgggvluhhqt`. Preserve existing
origins, never add `*` or wildcard Vercel preview domains. Unapproved preview
origins should remain denied. Do not change SQL/RLS or disable JWT verification.
This CORS setting is read from the existing fsm-api runtime environment.
Do not accidentally deploy the locally prepared Insights endpoint or other new
function source while adjusting origins. Any required function deployment must
have its exact source/scope separately reviewed and approved.

Anonymous sign-in already works in the test project; no email/OAuth redirect
flow is being added. Verify public-origin create/join, independent browser
identities, questionnaire persistence, sharing gates, saved scenarios, approvals
and actual PDF download after CORS authorization. A successful static Demo alone
does not prove live backend access from the public domain.

## AI and public testing

Generate Insights uses deterministic analysis of validated engine results.
It is explicitly not online Qwen analysis. Do not add Groq secrets to Vercel.
The real Qwen PoC was already verified; no new Groq request is needed for release.
External AI for real sessions remains blocked pending separate consent storage,
server checks/rate limiting and approved deployment. No AI changes agreements.

This candidate is verified for the hackathon test-project flow, not a claim of
commercial production readiness. Public testing should use fictional details;
real-user data lifecycle/deletion and abuse/privacy readiness need their own
review before opening collection of real finances.

## Verification evidence

| Final check | Actual result |
| --- | --- |
| Typecheck, lint, production build | Passed; existing 503.13 kB entry warning |
| Backend unit tests | 44/44 |
| AI/fallback unit tests | 11/11; no new Groq network request |
| Offline UI desktop/tablet/mobile | 57/57; screenshots refreshed, no tested overflow/console failures |
| Real session/questionnaire/finance/agreement security | 68/68 (15+16+18+19) |
| Real finance and Agreement/PDF browser flows | 2/2 passed, including deterministic Generate Insights and actual PDF verification |
| Real questionnaire and session browser flows | Failed at anonymous signup; targeted retry observed HTTP 429 `over_request_rate_limit` |
| Local Home/Demo/Create/Simulator HTTP checks | 200 on port 5173 |
| Secret scan of tracked files and production assets | No known secret findings; no Groq network adapter in browser bundle |

**Historical rate-limit failure (superseded by the consumer UX verification below).** Two of four final live browser cases could
not complete because the Auth service rejected signup. One targeted diagnostic
retry was performed; no rate limit, CAPTCHA, Auth setting, RLS, TLS or JWT check
was changed. Do not claim all final tests passed, or deploy as a fully verified
live release until the signup window resets and those two cases pass. No further
signup attempts should be made while the limit remains active. Diagnostic test
listeners log only HTTP status and an allowlisted error code, never tokens or
provider messages. Test cleanup remains scoped to identities created by each run.

The previous successful four-flow integration evidence is historical; it does
not override this final-run rate-limit failure. The user can inspect Demo now;
new live sessions may remain unavailable until the external quota recovers.

Final logs: ignored `artifacts/final-verification/` and `artifacts/final-cloud/`.
Screenshots: ignored `artifacts/screenshots/` (desktop/tablet/mobile routes,
financial warnings, consent and agreement/print preview).
Only test-owned data may be created/cleaned by approved security/live suites.
No deployment, origin update, Git promotion or push is part of this preparation.

## Consumer UX verification update

The subsequent owner-authorized consumer UX run passed all four real browser
flows (session A/B/C, questionnaire persistence and independent consents, finance,
and Agreement/PDF). Anonymous signup worked in this run; the prior HTTP 429
blocker was not observed. No Auth setting, rate limit, schema, RLS, JWT, TLS or
Edge deployment was changed. Future quota availability is not guaranteed.

Consumer copy now uses Preview, Example Plan and Start your plan. Example pages
retain a concise no-persistence notice; fixed results are hidden after edits.
Generate Insights is available for the displayed example budget as well as live
saved scenarios, and sends no data to outside AI. Rules forms have consistent
spacing/focus styles, confirmations show human-readable state/times rather than
technical identifiers, and simulator blockers use known DTO/error states.
The session DTO does not expose partner consents: sharing readiness is never
inferred from questionnaire completion. Server gates remain authoritative.

Checks: app typecheck, lint, production build and strict changed-test typecheck
passed. Offline UI verified 63 distinct cases across desktop/tablet/mobile after
targeted corrections. The initial full run passed 58/63; a preview state naming
error was corrected, and repeated writes of identical test harnesses were avoided
to prevent cross-worker Vite reloads. All six affected questionnaire/simulator
viewport cases then passed, without removing assertions. The earlier targeted
consent copy expectations were updated to the new wording and passed.
No backend/security or Groq smoke suite was unnecessarily repeated.

Evidence: artifacts/consumer-ux/ (ignored); refreshed route screenshots and
desktop-preview-insights.png, tablet-preview-insights.png, mobile-preview-insights.png
under artifacts/screenshots/. Test-owned cloud data was cleaned by existing suites;
no cleanup error was reported. These sessions are not retained as user preview links.
All changes stay in the local integration branch pending release review.
