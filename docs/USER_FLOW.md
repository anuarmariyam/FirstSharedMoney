# FirstSharedMoney: User Flow

Status: accepted target workflow. Phase 3 implements a local frontend preview;
live sessions, server persistence, financial engines, and independent approvals
remain unconnected. All UI copy and questionnaire wording are English.

## 1. Primary journey

| Step | User action | Server behavior and privacy | Next state |
| --- | --- | --- | --- |
| 1 | A selects Create a shared plan | Establish A's anonymous Auth session, create couple/A transactionally | Session contains A only |
| 2 | A copies an invitation link | Mint a strong, expiring, one-use B capability; never include A's credential | Waiting for B |
| 3 | B opens the link in another browser context | Clear fragment, establish B identity, redeem token atomically | Two separate seats |
| 4 | Each completes My questionnaire | Autosave only that identity's draft, validate revisions and inputs | Submitted independently |
| 5 | Each chooses sharing permissions and submits | Record separate comparison/budget consents; never infer consent from an answer | Appropriate shared features unlock |
| 6 | They inspect Differences | Return only derived neutral comparison results after both comparison consents | Topics to discuss |
| 7 | They try financial models and stress tests | Both budget consents allow the income/obligation projection; server recomputes saved scenarios | Candidate baseline |
| 8 | Either creates a complete draft agreement | Derive expense terms from the baseline, add explicit rules, create immutable version | Draft |
| 9 | Either proposes that version | Verify head, content, readiness, and required terms | Proposed |
| 10 | First partner explicitly approves | Bind their approval to the exact current version/hash | Under review |
| 11 | Other partner independently approves | Verify the second distinct identity on the same version | Approved |
| 12 | Both inspect First Money Agreement | Display frozen shared terms, contributions, review date, version and both confirmations | Final planning document |

The planning document is a personal planning tool, not a legal contract or
professional financial advice. Matching answers, viewing a proposal, or clicking
Continue must never count as approval.

### Proposed routes for later implementation

| Route | Purpose and access |
| --- | --- |
| `/` | Product introduction, Create a shared plan, Try a demo |
| `/join#token=...` | One-use invitation handling; strip fragment immediately |
| `/sessions/:coupleId` | Safe progress overview for an authenticated member |
| `/sessions/:coupleId/questionnaire` | Caller-only form |
| `/sessions/:coupleId/differences` | Derived comparison, consent gate |
| `/sessions/:coupleId/simulator` | Shared projections/models, budget consent gate |
| `/sessions/:coupleId/agreement` | Current draft/proposal and explicit review |
| `/sessions/:coupleId/agreement/:versionId` | Historical or current shared document |

Route guards are navigation aids; database and API checks enforce access.
Session IDs in URLs never grant membership. Do not implement these routes in
Phase 2; Phase 3 implements their frontend preview only.

## 2. Questionnaire v1

Use stable codes from `AnswerValueByQuestion` in `src/types/domain.ts`. Questions
1-14 are required; question 15 is optional. No identifiers, bank account numbers,
credit-card details, passwords, or debt account names are requested.

All money inputs are USD per month unless the prompt says target/threshold.
Parse currency text into exact integer cents, reject fractions of a cent,
negative/non-finite/unsafe/out-of-range values, and never use `parseFloat * 100`
as the authoritative parser. Bounds are 0 to 1,000,000,000,000 cents. Zero income
is allowed. The slider uses 0-10,000 basis points, steps of 100 (one percent).

| # / code | English prompt | Control / allowed values | Comparison rule |
| --- | --- | --- | --- |
| 1 monthly_income | What is your monthly take-home income? | money; after taxes; include reliable recurring income only | none |
| 2 personal_obligations | What do you pay monthly for personal obligations outside this shared budget? | money; include minimum debt payments/support; exclude expenses proposed as shared | none |
| 3 shared_categories | Which categories would you like to plan together? | multiple_choice: rent, utilities, groceries, other, shared_savings; select at least one | set_equality |
| 4 shared_budget_estimate | What monthly total do you expect for shared living expenses, before shared savings? | money | exact |
| 5 split_preference | How would you prefer to divide shared costs? | single_choice: equal, proportional, custom | exact |
| 6 monthly_shared_savings | How much would you like the two of you to save together each month? | money; household target, not your personal contribution | exact |
| 7 personal_spending | How should personal purchases be handled? | single_choice: independent, discuss_above_threshold | exact |
| 8 debt_expectation | How should existing personal debt affect your shared plan? | single_choice: individual_responsibility, discuss_support | exact |
| 9 emergency_preference | What should happen first when an unexpected shared cost appears? | single_choice: shared_reserve_first, pause_savings_first, discuss_each_event | exact |
| 10 emergency_fund_target | What shared emergency-fund balance would you like to aim for? | money; target balance, not the amount currently available | exact |
| 11 large_purchase_threshold | Above what purchase amount should you discuss a shared decision first? | money; one purchase, not monthly spending | exact |
| 12 transparency_preference | What level of financial detail would you feel comfortable discussing? | single_choice: shared_totals_only, voluntary_details, prefer_private | exact |
| 13 review_frequency | How often would you like to review the shared budget? | single_choice: monthly, quarterly, as_needed | exact |
| 14 comfortable_income_share | What percentage of your own take-home income could comfortably go toward shared costs? | slider, integer basis points | none |
| 15 discussion_note | Is there anything else you would like to prepare for your money conversation? | optional text, max 500 characters; author-only | none |

Titles/help text/options are seeded catalog data, not implemented in Phase 2.
Display friendly labels for enum values. All choices are preferences, not an
assessment of which partner is responsible, compatible, or correct.

For `exact`, compare normalized enum values or exact integer cents. For
`set_equality`, ignore selection order; disallow duplicate values. A monetary
preference mismatch produces a discussion summary without returning either
amount. Do not compare the partners' income levels as a disagreement. Optional
notes are never used as a conflict-detection input.

### Draft and submission behavior

Autosave an answer with the current revision. On a conflict, preserve unsaved
input in memory, refetch the owner questionnaire, and ask the user to review the
current state. Never overwrite an unseen newer answer. A/B may save concurrently
because their data/revisions are independent; parent locking serializes commits
for consistent agreement prerequisites.

Submission validates the entire questionnaire and records the user's explicit
sharing choices. A may finish before B joins. No raw responses become visible
to B upon completion. Submission is separate from agreement approval.

To change submitted answers, choose Edit my answers, explain that current numeric
snapshots will become stale, reopen, and then resubmit. Reopening clears both
consents. Historical shared agreement terms remain available; a fresh scenario
and new version are required before approving changed financial inputs.

## 3. Consent and comparison UX

Present two separate, initially unchecked permissions in plain English:

1. "Share a summary of where our planning preferences align or differ. My raw
   answers and private note stay private."
2. "Share my submitted monthly take-home income and personal-obligation total
   in our shared budget simulator."

Permit submission while either permission is withheld. Explain that comparison
requires the first permission from both people, while the joint simulator and
agreement workflow require the second permission from both people. There is
no coercive default or automatic approval. Users can change their own flags.

If a gate is closed, show what is required and link to the caller's privacy
controls. Do not reveal the counterpart's raw response or silently infer
permission from their transparency preference. A response already received or
downloaded cannot be recalled after consent withdrawal.

Comparison output groups neutral messages into Aligned preferences, Different
expectations, and Unresolved decisions. For example: "You have different
preferences for splitting shared expenses. Compare the available models
together." Each mismatch links to discussion/simulation rather than picking a
winner. No compatibility percentage or psychological claim appears.

## 4. Simulator flow

After both budget consents, the server supplies the two income/obligation totals.
Users enter a proposed five-category shared budget, a current shared emergency
reserve, and a split model. Keep savings target and currently available reserve
distinct. The proposal is hypothetical until both approve an agreement.

Show equal, proportional, and custom outcomes using the same engine. Display
both monthly contributions, burden relative to each income, remaining income,
and money available after personal obligations. Show N/A for a burden with zero
income. Show a shortfall clearly without hiding negative balances. Proportional
is explicitly unavailable when both incomes are zero; equal/custom can still
show the resulting deficit.

Stress-test presets change inputs only: rent +$300, selected income -20%,
unexpected cost $1,000, temporary income loss, and a changed monthly savings
target. Results recalculate; no preset result is stored in UI code. Show reserve
use and the uncovered one-off cost separately from monthly outflow.

Saving a scenario triggers a server recomputation using current consented
inputs. If data changed meanwhile, show a stale-data message and refetch. Only
an available baseline scenario can seed an agreement; a temporary stress test
does not become an agreement with one accidental click.

## 5. Agreement flow and concurrency

The builder collects shared category amounts from the selected baseline and
explicit personal spending/debt, large-purchase, emergency, and review rules.
The nine immutable items and household contribution summary are visible before
proposal. The same split model covers all categories in this MVP.

Draft creation, editing, proposal, and approval are separate commands. When the
current version changes, display its version number and require rereview.
Approval submits the exact version ID and expected server content hash. It
never sends a partner identity or an approval count.

Example: A approves version 2. B changes the purchase threshold, creating
version 3. Version 3 shows zero confirmations. A's version-2 confirmation is
historical and cannot count for version 3; both must approve version 3.

Two overlapping editors use expected-head checks: one succeeds and the other
receives STALE_VERSION, refetches, and reviews. If an approval races a new
version, the database lock ensures it either applies to the old head before the
edit, or fails as stale afterward. It never approves the new unseen content.

The approved document includes expenses, split model, A/B monthly contributions,
shared savings, reserve/emergency rule, personal purchase and debt rules,
discussion threshold, next review date, version, and both confirmations. It
excludes private notes and raw income/obligation fields. A historical approved
document remains approved as a historical record if a new draft is created;
the overview clearly distinguishes it from the current unapproved head.

PDF export is added only after the core flow is stable. It must state that it
is a personal planning document, and expose no anonymous Auth credentials or
invitation token.

## 6. Public jury demo without registration

Try a demo creates a fresh, expiring session for that judge through anonymous
Auth; it is not a public link to another couple's stored data. Use only fictional
values, prominently label Demo data, and do not request real finances.

The judge uses a normal browser profile as A and a private browser context (or
another device/profile) as B through the invite. Two private windows belonging
to the same private profile may share storage; do not claim they isolate users.
If A's identity opens its own invite, show guidance rather than changing identity.

Offer fixture prefills separately for each role. Prefills are editable drafts;
the judge still submits each questionnaire and independently approves with each
role's JWT. No server route generates both approvals for the caller, and the
frontend never holds both role credentials in one shared Auth store. Refreshing
one role retains that context's membership and persisted state.

An example fixture uses A income $5,000, personal obligations $600; B income
$3,000, obligations $300; household rent $2,200, utilities $300, groceries $500,
other $200, savings $0; shared costs total $3,200. These are invented demo
inputs, not market evidence. The expected equal/proportional calculations are
computed by the financial engine and independently tested later.

No email/password registration is required. Clearly explain that anonymous
browser access cannot be recovered after clearing the session. Do not present
automatic role switching or synthetic approvals as the secure two-person flow.

## 7. Failure, expiry, deletion, and return visits

| Situation | Required behavior |
| --- | --- |
| Invalid/expired invitation | Generic unavailable-invite message; reveal no session data; A can issue another before B joins |
| Already joined as A | Explain identity separation; do not sign A out automatically |
| Third participant | Deny join; database slot uniqueness is final authority |
| One questionnaire unfinished | Show safe partner completion status; never expose saved answers |
| Sharing withheld | Respect the gate and offer the caller's privacy controls |
| Browser reload | Restore own Auth session and refetch server state |
| Lost anonymous identity | Explain the limitation; no shared recovery secret or takeover path |
| Expired/revoked membership | Clear in-memory private data, show unavailable session, stop polling |
| Network error | Preserve unsaved draft in memory, show retry; do not assume a command failed after a lost response |
| Version/revision conflict | Refetch and rereview; never silently overwrite |
| Delete session | Explain that it deletes both partners' session data; explicit confirmation before the server command |

Either active partner can delete the whole session; the other loses access.
Self-revocation is also available but provides no recovery or seat recycling.
Retention/expiry and the deletion choice must be visible before users enter data.

A future Monthly Money Check-in reuses owner-only questionnaire edits, updated
scenarios, and a fresh agreement version with two new confirmations. Reminders,
account recovery, retention extension beyond the MVP's 30-day limit, history
charts, and subscription billing are separate future work. Do not market those
as implemented by the initial anonymous-session flow.
