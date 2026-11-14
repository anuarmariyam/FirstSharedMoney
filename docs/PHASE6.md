# Phase 6: Mutual Agreement and Authorized PDF Export

Status: verified after the owner's separate explicit approval in FSM test project
lgboxbtxutgggvluhhqt. Both approved Phase 6 migrations are applied (11/11 total).
The existing fsm-api is ACTIVE at version 4 with verify_jwt=true. RLS and verified
database TLS remain enabled. No other project, function or production site was changed.

## Content, lifecycle and authority

The existing domain/API contracts remain compatible. SQL creates a complete
nine-item version from an available, current **baseline** financial_scenarios row.
Stress scenarios and stale questionnaire revisions are rejected. Expense amounts,
shared savings, model and total A/B contributions come from the authoritative
Phase 5 scenario; clients supply only its locator and validated nonfinancial rules.
No new allocation formula is added.

Creating/editing makes a numbered immutable draft, moves the couple's current
pointer and copies no approvals. Previous versions and confirmations remain
historical shared terms. Each version's SHA-256 is computed over PostgreSQL's
canonical jsonb::text content: schema/version/couple identity, parent, source
scenario/revisions, summary and position-ordered item DTOs. Status, timestamps,
approvals and creator metadata are excluded. The hash is a content/concurrency
check, not a digital signature or legal certification.

Draft -> Proposed -> Under Review -> Approved requires explicit commands.
Proposal is not approval. Auth identity maps to the immutable partner seat;
no caller can select a partner or timestamp. Unique version/partner approvals,
same-couple/version/hash FKs and the shared couple-row lock serialize edits,
consent changes and confirmations. Duplicate approval of the same current
version is idempotent, including after both partners approved. Old-head or wrong
hash commands fail; revocation immediately blocks new progression/export. A
regrant does not revive old financial source revisions.

Before-update triggers prohibit content changes even on drafts. Append-only item
and approval triggers prohibit individual changes/deletes while permitting only
whole-session cascading cleanup. A deferred constraint checks nine items,
canonical hash, scenario-derived summary and lifecycle/approval-count agreement.
Changing a row's status alone cannot produce an approved agreement.

## Migrations and API

- 20261115001000_agreement_tables.sql adds agreement_versions, agreement_items,
  approvals, composite FKs, seven indexes and member-read/no-client-write RLS.
  It replaces the temporary current-head-is-null guard with the planned FK.
  No existing table/data is removed.
- 20261115001100_agreement_rpcs.sql adds strict rule validation, canonical
  payload/hash checks, content/approval guards and five authenticated RPCs.
  Private helpers have no anon/authenticated execution privileges.

Routes below the existing fsm-api /v1 prefix:

| Method | Route | Result |
| --- | --- | --- |
| GET | /couples/:id/agreement-versions/current | AgreementVersion or null |
| GET | /couples/:id/agreement-versions/:versionId | Member-only current/historical terms |
| POST | /couples/:id/agreement-versions | CreateAgreementVersionRequest; new draft, 201 or idempotent 200 |
| POST | /couples/:id/agreement-versions/:versionId/propose | Expected head/hash; explicit proposal |
| POST | /couples/:id/agreement-versions/:versionId/approve | Expected head/hash; caller's independent approval |
| POST | /couples/:id/agreement-versions/:versionId/pdf | Expected head/hash; authorized PDF bytes |

RPCs: fsm_get_agreement, fsm_create_agreement, fsm_propose_agreement,
fsm_approve_agreement, fsm_export_agreement. Read routes require active membership;
commands and export also require both current budget consents, submitted
questionnaires and matching source revisions. Historical terms do not expose raw
scenario inputs, salary, obligations, notes or Auth user IDs. Historical read
permission does not grant proposal, approval or export eligibility.

## PDF and presentation boundary

pdf-lib 1.17.1 is the single added runtime dependency (official npm package).
It runs server-side only with embedded standard fonts and local English copy.
No HTML execution, external fonts, AI, network PDF service or storage bucket.
The Letter-sized PDF includes version/date, shared costs/savings/model, total
contributions, personal/debt/purchase/emergency/review rules, both confirmation
timestamps, source/version locators, hash and a short planning/legal disclaimer.
Line wrapping, page margins and page numbers support printing.

The Edge authenticates, obtains the current approved DTO via the guarded RPC,
renders it, and rechecks head/hash/consents again before returning attachment
bytes with no-store. The same check applies on every download; no public URL.
The browser holds only a temporary Blob URL, then revokes it. No financial
agreement or source is copied to localStorage.

LiveAgreementPage is a minimal integration container reusing existing UI/CSS,
AgreementStatus and document classes. Existing Demo pages remain unchanged in
behavior. A saved baseline simulator result links to agreement creation; live
pages load server statuses, preserve errors, require a review checkbox and an
explicit confirmation button, poll updates and restore after refresh. Member 2
still owns visual/PDF presentation polish; replace presentation blocks through
reviewed props, preserving server actions and lifecycle guards. No teammate
branch is modified or merged.

## Future Insights seam, without AI

The existing typed getScenario response (FinancialScenario) and its
SimulationOutput already provide the future dashboard integration boundary.
The owner can later pass an authorized current scenario and matching precomputed
alternatives into Member 3's proposed InsightsInput. No new unused service or
shared type is needed now, and no insight participates in agreement approval.
No Insights/Qwen branch is imported, no external request/key/dependency/permission
is added. Any future external AI analysis requires separately designed explicit
consent; budget/comparison consent alone does not authorize it.

## Verification evidence

| Check | Result |
| --- | --- |
| App TypeScript typecheck | Passed |
| Explicit strict typecheck of new backend/security/live test sources | Passed; TypeScript 7 requires --ignoreConfig for explicit file arguments |
| Lint | Passed |
| Production build | Passed; nonblocking 503.14 kB entry-chunk advisory remains |
| Backend unit tests | 44/44 (12 agreement/PDF cases) |
| Offline UI regression, desktop/tablet/mobile | 27/27 |
| Real session security | 15/15 |
| Real questionnaire security | 16/16 |
| Real finance security | 18/18 |
| Real agreement security | 19/19 |
| Real browser integration | 4/4 distinct scenarios |

There are **143 distinct passing automated cases**, with no remaining failures.
The real agreement suite verified independent A/B/C, canonical PostgreSQL hash,
proposal without approval, duplicate concurrent same-user confirmation, concurrent
A/B confirmation, a new-version/approval race, fake actor/hash/head denial, direct
Data API/RPC denials, immutable approved content, no inherited confirmations,
withdrawal/regrant, stale source/head checks, repeated authorized PDFs, cross-couple
access denial and expired membership. A privileged test-owned status change with
only one approval was rejected by the deferred integrity constraint.

The browser case created actual independent anonymous A/B identities, saved a
baseline, created/proposed a draft, explicitly confirmed in each browser, reloaded
the approved agreement, downloaded its PDF, edited the purchase threshold to make
version 2 and reloaded the zero-confirmation draft. A DB check confirmed version 1
retained two confirmations while version 2 had none. Mobile overflow and browser
page errors were checked. Other real browser regressions covered sessions,
questionnaires and financial scenarios unchanged.

PDF verification parses the **actual downloaded file**, decompresses its content
streams and matches text to the approved server DTO: total, every expense/savings
category, A/B contributions, reserve, purchase threshold, next review, version,
IDs and both confirmation timestamps. Header, metadata and Letter page sizes are
also checked. A unit case covers nonzero $200.01 savings and a $3,400.01 odd-cent
budget calculated by the existing Financial Engine. The renderer never receives
private salary, obligation or questionnaire-note fields.

Two issues were corrected without dropping security assertions. The first 0011
application rolled back on a PL/pgSQL CASE-expression syntax error; parentheses
fixed the still-unapplied migration, and the next attempt applied only 0011.
The first browser agreement run failed because Edge's network inspector returned
zero response-body bytes for a fetch-to-Blob download. The saved download contained
a valid PDF. The test now verifies that artifact (including monetary contents)
and its targeted rerun passed; the other three browser scenarios had already passed.

A final independent READ ONLY query confirmed zero remaining Auth users, couples,
partners, answers, invitations, scenarios, versions, items and approvals; all 15
published questions remain. Cleanup deleted only records owned by fresh test
identities. The same catalog check confirmed all eight new private helpers are
non-executable by anon/authenticated; all five public agreement RPCs are
authenticated-only and RLS is enabled on the three new tables.

Secrets, environment files, generated PDFs/artifacts and caches remain ignored.
No AI service/key/permission was added. main, frontend/fsm-ux and
feature/fsm-insights retain their original local tips. No Git push, merge,
website deployment or release was performed. Further scope needs owner approval.
