# Phase 4B: Questionnaire Persistence and Privacy

Status: verified in the explicitly approved test project. All three migrations
are applied and fsm-api version 2 is active with JWT verification. Real
questionnaire security checks passed 16/16, session security 15/15, live tests 2/2,
unit tests 19/19, and offline UI tests 27/27. See PHASE4B_VERIFICATION.md.

## Changes prepared for the existing test project

| Migration | Change |
| --- | --- |
| 20261114000500_questionnaire_tables.sql | questions/answers, composite foreign keys, unique owner/question answer, bounded JSON, indexes, initially closed RLS/grants. |
| 20261114000600_questionnaire_catalog.sql | Immutable version 1 catalog exported from the existing 15 questions, including 14 required fields; no wording/type changes. |
| 20261114000700_questionnaire_rpcs.sql | Owner-only RLS, SQL value validation/answer trigger, exact revision checks, five transactional owner RPCs, independent consents. |

The approved Phase 2 types remain unchanged. No financial/conflict/agreement
engine or shared-answer projection is added. Raw answers and the optional note
stay owner-only even after both partners grant both permissions.

## API and transaction rules

All operations verify the actual Auth user and derive their own partner from
auth.uid(). No caller-selected partner ID is accepted. Writes lock the couple
before its owner partner, recheck active membership, check expectedRevision, and
increment that partner's revision once. A/B revisions remain independent.

| Method / route under /v1 | RPC |
| --- | --- |
| GET /couples/:id/questionnaire | fsm_get_questionnaire |
| PUT /couples/:id/answers/:questionCode | fsm_save_answer |
| POST /couples/:id/questionnaire/submit | fsm_submit_questionnaire |
| POST /couples/:id/questionnaire/reopen | fsm_reopen_questionnaire |
| PATCH /couples/:id/privacy | fsm_update_privacy |

Request bodies and owner Questionnaire responses use src/types/api.ts/domain.ts.
Runtime validation is shared by frontend and Edge; SQL validates independently
because the Data API/RPC surface is directly reachable. JSON keys, options,
integer cents/basis points, bounds, text length, and duplicate choices are checked.
Direct browser writes are not granted, including on the caller's own rows.

Only a draft may save answers. Submission requires all 14 required answers and
explicit boolean values for both consent flags; false/false is valid. Reopening
preserves answers but clears submission and both permissions. Privacy updates
require submitted status and revision the consent change. Revocation does not
erase private answers. Subsequent shared features must check both applicable
permissions and current revisions when those features are implemented.

## Frontend integration

The existing demo questionnaire remains in memory and keeps its original behavior.
Live sessions use the same QuestionField components, catalog, and visual classes.
Valid edits autosave after 600 ms, serially per owner; Next/Submit flush pending
saves. Incomplete/invalid edits stay in memory with an unsaved status and browser
unload warning, rather than sending invalid values or writing financial data to
localStorage. A completed save is restored from the server after refresh.

Network failures preserve in-memory edits and offer Retry. A transient session
status poll failure retains an already-loaded workspace and displays a warning;
auth/access failures still block it. A revision conflict preserves unsaved input,
loads the latest owner questionnaire, and requires an explicit Use saved answers
or Keep my changes decision. No automatic overwrite/retry of stale data occurs.
Editing a submitted questionnaire explicitly reopens it and clears consent.

## Verification coverage

- Backend unit tests: catalog migration parity, strict value/consent/revision
  boundaries, exact-cent UI conversion, owner response parsing, all five routes,
  forbidden identity fields, and sanitized stale responses.
- test:questionnaire: real A/B/C Auth, owner reload, Data API and RPC isolation,
  direct write/identity forgery denial, SQL and trigger validation, stale/concurrent
  revisions, completeness, all consent states, withdrawal, reopen, five Edge
  operations, and expired membership. Cleanup targets only test-created users.
- test:live: retains the Phase 4A session case and adds actual questionnaire
  autosave/refresh, separate browser identities, multi-tab stale revision review,
  network retry, submission, independent consent persistence, and reopen.
- Existing test:security and offline test:ui remain regression requirements.

Only lgboxbtxutgggvluhhqt was used. A fresh read-only inventory and migration
dry-run preceded the owner's explicit cloud-write confirmation.
Keep JWT verification, exact CORS origins (now permitting PUT/PATCH), and verified
database TLS. No secrets, response bodies, or private notes belong in test logs.
Phase 5, frontend/fsm-ux changes, Git push, merge, and website deployment are excluded.
