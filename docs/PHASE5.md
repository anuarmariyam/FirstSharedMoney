# Phase 5: Conflict Detection and Financial Simulation

Status: verified in the owner's dedicated FSM test project lgboxbtxutgggvluhhqt
after explicit approval following dry-run. Both Phase 5 migrations are applied
(9/9 total); fsm-api v3 is ACTIVE with verify_jwt=true.

## Implementation boundary

src/engines/conflict.ts compares only catalog exact/set_equality questions.
It emits 11 neutral derived results, never raw answers, income, obligations,
comfort percentages, or notes. Matching custom preferences remain unresolved
until a percentage is chosen in the simulator. There is no compatibility score.

src/engines/financial.ts implements the existing FinancialSimulationEngine port.
Money uses integer cents and BigInt multiplication/division. Monthly and one-off
totals allocate independently by largest remainder; ties favor A. Shared savings
are included once in the household monthly allocation, not split/rounded again
per category. Reduced income rounds halves upward. Emergency reserves pay only
the unexpected expense's funded part; only its uncovered part becomes one-off cost.
Inputs are copied; questionnaires and agreement data are never mutated.

Each input amount and shared-spending aggregate is capped at 1e12 cents. The
combined income weight may be twice that cap and stays BigInt; signed balances
can include personal obligations and remain safe JSON integers. Burden percentages
are two-decimal display strings, possibly above 100%, or null for zero income.

## Database and trusted calculation path

- 20261115000800_financial_scenarios.sql adds immutable input/output snapshots,
  source revisions, idempotency, constraints and indexes, initially closed by RLS.
- 20261115000900_shared_finance_rpcs.sql adds consent/revision gates, three
  service_role-only internal RPCs, guarded scenario retrieval, current-snapshot
  SELECT policy, immutability and 30 writes/couple/minute quota.

The internal actor ID comes only from auth.getUser(user JWT), never the HTTP body.
Internal getters lock the couple while authorizing and reading; the store locks
again and rechecks current income/obligation projection, consent, and revisions.
The Edge calls the pure engine itself and ignores/rejects any client output.
Database checks enforce current source inputs and output conservation; runtime
scenario parsers also recompute and compare stored outputs before serialization.
Public authenticated users cannot execute internal getters/stores or write tables.
Raw questionnaires remain owner-only regardless of sharing flags.

The Edge uses Supabase's injected server secret dictionary (legacy server key
fallback) only for the three explicitly allowed internal RPCs. No elevated key
is copied locally or shipped to frontend. See the official
[Edge environment reference](https://supabase.com/docs/guides/functions/secrets).
JWT verification, exact CORS origins, and database TLS remain enabled.

## API and minimal contract addition

| Method / route under /v1 | Behavior |
| --- | --- |
| GET /couples/:id/comparison | Both comparison consents; derived results and source revisions only. |
| GET /couples/:id/financial-inputs | Both budget consents; approved income/obligation projection and revisions. |
| POST /couples/:id/scenarios | Validated household inputs; authoritative server calculation/save; 201/200 on retry. |
| GET /couples/:id/scenarios/:scenarioId | Active membership, both current budget consents and matching revisions. |

getFinancialInputs is the single additive API contract: initial scenario creation
requires both source revisions even when comparison consent is withheld. It does
not expand the approved numeric consent projection. Baseline household costs and
reserve start at zero until supplied by the users; personal income is never editable
through this shared operation. Revocation blocks all newly authorized relevant
reads; regranting consent never revives snapshots from unrelated old revisions.
Already received data cannot be recalled from a recipient's browser.

## Frontend and tests

Existing Differences/Simulator pages dispatch to real APIs for live sessions and
keep the separate labeled Demo. Shared data refreshes after requests complete and
on focus. The simulator debounces authoritative saved scenarios, reuses request
IDs on retries, hides stale selected outputs, compares all models with the same
pure engine, and restores saved scenarios using a UUID URL locator after reload.
No private amounts or raw questionnaire responses enter localStorage.

Local engine tests cover known examples, odd cents, 0/100 boundaries, zeros,
large weights, signed balances, deterministic nonmutating stress transforms,
invalid values, and 900 allocation invariant combinations. Real finance tests
passed for separate consent gates, actor forgery/RPC permissions, immutable
snapshots, raw RLS, withdrawal/regrant, commit-time stale checks, cross-couple
denials and quota. A new real browser case covers derived privacy, dynamic models,
odd cents, stress/reserve use, refresh persistence and consent withdrawal.

## Verification evidence

| Check | Final result |
| --- | --- |
| TypeScript typecheck | Passed |
| Lint | Passed |
| Production build | Passed; existing 501.79 kB entry-chunk advisory remains |
| Backend unit tests | 32/32 |
| Real session security | 15/15 |
| Real questionnaire security | 16/16 |
| Real finance security | 18/18 |
| Offline UI, three viewports | 27/27 |
| Real browser scenarios | 3/3 |

There are 111 distinct passing automated cases, with no remaining failures.
The first browser finance run expected `$0.00` while the existing formatter
intentionally renders `$0`. Only that assertion was corrected; its targeted
rerun passed. The other two browser scenarios had already passed unchanged.
No success response was mocked in the live scenarios.

A read-only cloud catalog check confirmed RLS enabled, five scenario indexes,
the current-snapshot SELECT policy, and all three internal RPCs executable only
by service_role (not anon/authenticated). Scenario retrieval is authenticated-only.
Real tests separately verified those denials and the update immutability trigger.
The final independent read-only cleanup query found zero Auth users, couples,
partners, answers, invitations, or scenarios; the 15 published questions remain.
Cleanup deleted only objects owned by the fresh identities created by each test.

No new dependency was added. New project caches and test artifacts stayed under
D:\FirstSharedMoney; active system/application directories were not moved.

Phase 6, Git push/merge, frontend/fsm-ux changes and website deployment are excluded.
