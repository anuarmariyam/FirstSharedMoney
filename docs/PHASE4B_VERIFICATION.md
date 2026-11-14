# Phase 4B Verification

Status: completed against the explicitly approved FSM test project
lgboxbtxutgggvluhhqt. This verifies questionnaire persistence/privacy, not the
future conflict, financial, or agreement engines. No real financial data was used.

## Database and Edge

The three prepared migrations were applied once, in order:

1. 20261114000500_questionnaire_tables.sql
2. 20261114000600_questionnaire_catalog.sql
3. 20261114000700_questionnaire_rpcs.sql

The cloud migration history now contains versions 00100 through 00700. Read-only
catalog checks confirmed questions/answers with RLS, 15 catalog entries with 14
required questions, five owner-scoped SECURITY DEFINER RPCs with authenticated
execution and no anon execution, and no authenticated answer-table write grants.

fsm-api is ACTIVE at version 2, with verify_jwt=true. CORS retains only the three
approved local origins; PUT/PATCH are now allowed for answer/privacy commands.
Database TLS verification remains enabled. No service_role runtime key is used.
The existing question catalog's wording, types, options, and bounds are unchanged.

## Executed tests

| Command | Passed | Failed | Evidence |
| --- | --- | --- | --- |
| test:backend | 19 | 0 | Catalog parity, strict parsers, exact cents, owner DTOs, five routes, identity-field rejection, stale revisions. |
| test:questionnaire | 16 | 0 | Real A/B/C Auth, PostgreSQL, RLS, Data API, RPC and deployed Edge; no authorization mocks. |
| test:security | 15 | 0 | Existing real session/invitation/auth regression from Phase 4A. |
| test:live | 2 | 0 | Real browser session scenario plus questionnaire persistence/privacy scenario. |
| test:ui | 27 | 0 | Existing desktop/tablet/mobile Demo regression. |

Typecheck, lint, and production build passed. The build emits a nonblocking
chunk-size warning for the approximately 501 kB entry chunk; the warning threshold
was not increased. No new dependency was installed.

The 16 real questionnaire checks verified independent empty questionnaires;
exact-cent persistence and fresh reload; A/B/C Data API isolation; direct-write
and identity-forgery denial; malformed SQL values without revision changes;
trigger validation even for privileged writes to a test-owned row; incomplete
submission/draft consent denial; one-winner stale-revision races; independent
A/B concurrent saves; independent consent flags; submitted-answer immutability;
revisioned consent withdrawal; raw privacy even with both consents; reopen with
both consents cleared and answers retained; all five Edge operations; and expired
membership losing both RPC and raw answer access.

The questionnaire browser test used independent real A/B identities. It checked
autosave and refresh, B's empty private form while A had saved answers, same-user
multi-tab conflict with unsaved input retained and an explicit Keep my changes
decision, a deliberately aborted backend request followed by a real successful
retry, submission without consent, separately persisted consent updates, and
reopening with answer retention and consent reset. The network fault used no
mock success response. Live trace/video/screenshot capture remained disabled.

## Cleanup and branch boundaries

Both security suites and both browser scenarios cleaned up only records owned
by their newly created users. A final independent READ ONLY query confirmed:

| Entity | Remaining rows |
| --- | --- |
| Auth users | 0 |
| Couples | 0 |
| Partners | 0 |
| Answers | 0 |
| Invitations | 0 |
| Published questions | 15 |

The immutable non-sensitive catalog intentionally remains. No existing user data
was deleted. Secrets/local environment files and test artifacts remain ignored.
The main and frontend/fsm-ux branch tips were not changed. No Git push, merge,
Vercel deployment, or Phase 5 implementation was performed.

Raw answers and notes remain owner-only even after consent. Phase 4B records and
revokes permissions but adds no shared comparison/budget endpoint. Phase 5 must
implement the approved consent/revision gates for its derived results.
