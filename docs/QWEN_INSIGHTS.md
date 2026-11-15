# Local Qwen Insights PoC

## Scope

This owner implementation lives in `src/features/financial-insights/`, separate
from Member 3's reserved `src/features/insights/`. No contributor branch was merged
or modified. Financial and agreement engines remain unchanged.

The simulator's Generate Insights button works immediately using deterministic
templates and the current validated scenario. It sends nothing externally.
Financial overview, category ranking, contributions, shortfalls, one-time/reserve
effects and discussion prompts derive from existing engine outputs. No datasets,
new accounting formulas, compatibility scores or invented AI prose are used.

## Provider verification

Checked official Groq documentation on 2026-11-15:
https://console.groq.com/docs/structured-outputs
lists `qwen/qwen3.8-27b` for `json_schema` with `strict: true`.
The owner confirmed a free account. One authorized fictional-only completion
returned HTTP 200 with response model `qwen/qwen3.8-27b`, source `qwen` and five
validated evidence IDs. No fallback was used for that request. This verifies
current account access, not future quota or availability. No billing setting changed.

The server-only adapter uses standard fetch, an eight-second deadline covering
response reading, byte/request bounds, strict schema and evidence validation,
sanitized fallback, and one request per minute per adapter instance. There are
no automatic retries. HTTP 401/429/5xx, malformed content, truncation, unknown or
duplicate evidence and timeout retain the complete deterministic summary.
LLM output can only reorder existing evidence; it cannot supply arbitrary prose,
amounts, recommendations or suppress concerns. Only allowlisted identifiers are
sent, not financial values or untrusted user text. This deliberately narrow PoC
does not claim a full natural-language reasoning feature.

## Run locally with fictional data only

`node scripts/qwen-insights-poc.ts` works without a key using fallback.
For a real completion, first confirm the Groq account has a free quota and no
paid usage. Put `GROQ_API_KEY` and `FSM_GROQ_FREE_POC=1` in ignored root
`.env.qwen.local`, then rerun that command. The earlier `.env.groq.local` is
supported when the Qwen file is absent. Both files are ignored by Git.
Never send the key in chat, use a
VITE-prefixed key, commit that file, or upload it to a browser.
The PoC constructs its own fictional engine inputs; it never reads user records.

Offline tests: `node --test tests/backend/financial-insights.test.ts`.
These mocks prove adapter behavior, not provider availability.

## Prepared server integration and remaining consent boundary

Local source adds GET `/v1/couples/:coupleId/scenarios/:scenarioId/insights` to
fsm-api. Existing JWT/CORS checks and the user-scoped `fsm_get_scenario` RPC enforce
membership, budget sharing and revision checks before deriving results. The
endpoint returns deterministic facts only. It cannot invoke Groq and creates no
database records. No cloud deployment or SQL change was performed.

The UI currently derives the same deterministic facts from its validated saved
scenario output. It does not call an undeployed endpoint or pretend cloud AI is
enabled. After separate deployment approval, the owner can wire server retrieval
through the typed client. No new migration is needed for this deterministic route.

Real external AI remains blocked. Existing budget/comparison consents do not
authorize external processing. A future enablement requires separately approved
versioned/revocable AI-consent storage, server verification for both partners,
consent recheck before release, payload minimization, actor-scoped durable rate
limits, account quota validation, tests and Edge deployment/secrets approval.
The PoC's boolean fictional-data guard and in-process throttle are not a
production consent or distributed abuse-control mechanism. Do not wire that
adapter to live requests before those controls exist. AI has no access to
agreement writes, approvals or PDF eligibility.

## Verification record

App typecheck, lint, build and explicit strict new-test typecheck passed.
Backend regression: 44/44; AI/response/fallback tests: 11/11 (including HTTP 403); offline UI: 57/57,
including Generate Insights from dynamic API-result DTOs on all three viewports.
The earlier fictional PoC verified KEY_MISSING fallback. The subsequent single
real request passed structured evidence validation as recorded above. Raw provider
output and credentials were not logged. The existing build entry warning remains
(503.13 kB). Configuration-only smoke-test follow-up reran AI tests, app typecheck,
lint and build; it did not repeat cloud/backend/browser regression suites.
The separately authorized integration check passed 68 real security checks and
four real browser flows; see FRONTEND_INTEGRATION.md for targeted retry details.
Those cloud runs exercised deployed v4, not the prepared local Insights route.
