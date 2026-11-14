# FirstSharedMoney: MVP Scope and Delivery Gates

Status: Phase 2 architecture accepted; Phase 3 frontend preview implemented.
Backend work and publication still need separate authorization. No market-size,
conversion, willingness-to-pay, LTV, CAC, or
retention figures are asserted as validated facts.

## 1. Product outcome

FirstSharedMoney helps US adults aged 25-45 beginning shared life turn different
financial expectations into a mutually approved, revisable First Money Agreement.
The result is a concrete plan, not a compatibility score or banking dashboard.

Tagline: **Two people. Different money habits. One shared plan.**

Differentiator: a guided two-person decision workflow connecting independent
questionnaires, explicit sharing, deterministic scenarios, and version-bound
independent confirmations. Do not claim to be the first couples-finance service.

## 2. Delivery boundaries

| Priority | Included work |
| --- | --- |
| Core | Separate anonymous identities, expiring invite, hard two-seat limit |
| Core | Fifteen-question catalog, owner-only drafts, submission and validation |
| Core | Separate comparison/budget consents and revocation |
| Core | Deterministic neutral comparison; no private answer endpoint |
| Core | Equal, proportional, custom splits and all five stress-test types |
| Core | Immutable version creation, server proposal/approval, concurrency checks |
| Core | Shared final document with two independent confirmations |
| Core | Persistence across reload, session deletion/expiry, clear error states |
| Core | Fresh fictional demo per judge, no email/password registration |
| Later if core passes | PDF export and a basic guided check-in reusing new versions |
| Future | Account linking/recovery, recurring reminders, extended retention, billing |

Not included: bank connections, payments, custody, automated advice, legal
contracts, transaction categorization, credit scoring, ML training, AI assistants,
native mobile apps, per-category split models, offline financial data caching,
or custom long-lived bearer-token authentication. No Docker/local PostgreSQL,
Python ML libraries, .NET, Redis, or extra backend server is needed for this MVP.

## 3. Technical decisions proposed

| Decision | Recommendation and consequence |
| --- | --- |
| Identity | Supabase anonymous Auth; separate browser-bound A/B users; no automatic recovery |
| Invite | 256-bit one-use token in URL fragment; digest-only storage; 24-hour maximum |
| Membership | Standard session 30 days; demo two hours; revocation immediately checked in SQL |
| Privacy | Raw answers owner-only; two independent explicit sharing consents |
| Deletion | Either active partner can delete all session data after confirmation |
| Database | Eight requested tables plus private session_invitations; no cloud connection in Phase 2 |
| API | One routed Edge Function plus narrowly scoped transactional database RPCs |
| Financial inputs | USD, take-home monthly income, separate personal obligations, integer cents |
| Financial precision | BigInt intermediates, bounded JSON numeric cents, no early percentage rounding |
| Agreement | Nine frozen items; one model for the household; new version for every edit |
| Concurrency | Parent-row locks + expected revisions/head + content hash + unique approvals |
| Synchronization | Visibility-aware polling; no Realtime for the initial release |
| Demo | Separate real anonymous identities with fictional editable data, never automatic dual approval |

TypeScript brands express validated-domain expectations but do not validate
network input. Add runtime schemas only when the first implementation needs them.
SQL constraints and RPC authorization are mandatory even with frontend validation.

## 4. Phased implementation plan

| Phase | Deliverable and validation |
| --- | --- |
| 0, complete | Audited environment and npm cache on D |
| 1, complete | Working Vite starter, local Git, typecheck/build, local HTTP startup check |
| 2, complete | Four design documents, strict data/API/engine types, strict compiler settings |
| 3, current | Local responsive frontend, navigation, complete questionnaire form, fictional comparison/simulation fixtures, local agreement draft; no live backend |
| 4 | Questionnaire UI/catalog and authenticated owner persistence; implement the required database boundary before collecting real input |
| 5 | Pure comparison/financial modules with critical arithmetic tests; server scenario recomputation |
| 6 | Transactional immutable versions and two-party approvals with security/concurrency tests |
| 7 | End-to-end flow, adversarial access tests, persistence and production build |
| 8 | Supabase/Vercel integration and publication only after explicit user approval |
| 9 | Update README to final implemented behavior, setup, architecture and tested limitations |
| 10 | User-approved public GitHub, public production demo, pitch PDF of at most ten slides |

Database migrations and Edge implementations are source work to stage locally
in future phases. Applying them to a real Supabase project, remote pushes, and
deployment remain separately gated by the user's instructions. Never require
a deployed database simply to inspect these Phase 2 design contracts.

## 5. Critical verification before publication

The following are future test requirements, not completed Phase 2 checks:

| Area | Required evidence |
| --- | --- |
| Session lifecycle | Creation, distinct B join, expiry/revocation, concurrent joins, third-user rejection |
| Access control | A/B/C JWT tests against Edge, Data API and public RPCs; private B answers unavailable to A |
| Sharing | Both flags required for the appropriate feature; withdrawal and changed revisions block old sensitive snapshots |
| Draft persistence | Independent autosave, reload recovery in same browser, expected-revision conflicts |
| Arithmetic | $5,000/$3,000 and $3,200 example; odd-cent conservation; zero/one-zero income; 0/100% custom; invalid/overflow input |
| Stress tests | Recalculation for every type, reserve use without double-counting, source input immutability |
| Agreement | Immutable complete content, unique same-version confirmations, no approval for another partner |
| Concurrency | Concurrent editing/approval, stale hash/head, altered questionnaire, same request ID/different payload |
| Deletion | Cascade removes all scoped data and invite access, while preserving the global question catalog |
| Demo | New isolated fictional session, both browser roles, refresh and full path to an approved document |
| Build and delivery | Strict typecheck, production build, real deployed URL only after integration checks |

Use Vitest when the engines are implemented; add Playwright if time permits for
the real two-context journey. An HTTP startup check does not prove privacy,
transactionality, browser interaction, or calculation correctness. Never claim
these features work until the corresponding checks run.

## 6. Time budget and fallback

A nominal 24-hour allocation is a planning hypothesis: 2 hours design/setup,
4 hours UI/questionnaire, 4 hours identity/database security, 4 hours comparison
and simulation, 4 hours agreement workflow, 4 hours verification/deployment, and
2 hours presentation. Adjust to actual remaining time rather than treating this
as measured delivery performance.

Cut PDF, reminders, subscription work, Realtime, per-category splits, and account
linking first. Do not cut privacy checks, transactional approval correctness, or
independent identities to create an appearance of completion. If the cloud
security boundary cannot be verified, stop real-data collection and explicitly
scope any fallback as a fictional local demonstration. Such a fallback does not
meet the full server-verified product requirement; disclose that limitation.

## 7. Business hypotheses and submission

Proposed free features: questionnaires, derived comparison, basic simulation.
Proposed paid package: $9.99 one-time per couple for advanced scenarios, the
agreement builder/export, and first review. A possible later subscription is
$3.99/month for check-ins and revisable plans. These are unvalidated pricing
hypotheses; no fake checkout, fake purchase confirmation, or unsupported demand
statistics should be implemented.

The hackathon demo should let judges test the complete core without paying.
Explain the intended paid boundary separately from the accessible demonstration.
Long-term ARR, retention, LTV/CAC, and market size need cited research or explicit
scenario assumptions before appearing in a pitch.

Submission requires all three: public repository, public production link with
registration-free demo entry, and a pitch PDF of no more than ten slides. None
is published or generated as a submission artifact during Phase 2.

## 8. Phase 2 acceptance and next approval

Phase 2 is accepted when design documents and all requested domain models are
present, strict typecheck/build still pass, and Git status shows only expected
local source changes. The database design must be described as unexecuted.

Before Phase 3, confirm the recommended identity/recovery limitation, sharing
consents, session/invitation lifetimes, deletion permissions, two-context demo,
household split/rounding semantics, and immutable-version workflow. Approving
the design does not authorize cloud connection, publication, or deployment.
