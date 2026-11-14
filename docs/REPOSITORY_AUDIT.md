# Repository Audit and Integration Plan

## Scope and publication evidence

The owner authorized normal fast-forward publication of exactly Phase 6 commit
`1aaeb3a0d972c13111e4efabf6859eaa34dad3cb` to `backend/fsm-core`, provided the
repository was Private, the worktree clean, the history free of detected secrets,
and the remote contained no unknown commits. All gates passed before publication.
The push used the exact SHA/refspec with follow-tags disabled. Remote refs were
queried afterward and confirmed the target; no merge/rebase, force push or tag
publication occurred. Subsequent documentation/governance edits in this audit
are a separate local commit and must not be pushed without new approval.

GitHub metadata was read using the existing remote's credential manager, without
logging credentials. The configured GitHub connector previously returned 404 for
this repository, so the existing native Git authorization was used as fallback.
No Supabase operation, deployment, feature implementation or participant edit
was part of this audit.

## Remote snapshot

Repository: `anuarmariyam/FirstSharedMoney`, **Private**, default branch `main`.

| Branch | Verified remote tip | Latest commit / delivery |
| --- | --- | --- |
| main | 590a234d5194a884b1a506bb20f801397800755e | chore: complete phase 3 frontend foundation |
| backend/fsm-core | 1aaeb3a0d972c13111e4efabf6859eaa34dad3cb | feat: add versioned mutual agreements and authorized PDF export |
| frontend/fsm-ux | 9a640e58e067560bbecbc7baaf765db79fcae8cd | docs: define frontend and backend collaboration boundaries |
| feature/fsm-insights | 4c43ad580af43fdc1fa68829e3d2c8a3fe2bc6f3 | docs: assign fictional-data Qwen proof of concept |

PRs (open or closed): 0. Issues: 0. Registered Actions workflows: 0. Workflow
runs: 0. There is no automated CI result to call green. Protection/ruleset API
reads returned HTTP 403, so required-review/enforcement status is **unknown**.
The owner should check Settings and plan availability; this audit changed no
repository settings. Remote snapshots do not reveal another developer's unpushed
or uncommitted work and must not be used to discard it.

## Security audit

The pre-push audit inspected 217 blobs and 11 commits reachable from the approved
backend and all three other published branch tips. It checked known local key
values and full/decoded database credentials, credential patterns and historical
environment filenames, without printing values. **No findings** were detected.
No working `.env.local`, `.env.security.local`, Edge environment file, JWT,
database password, Supabase server secret or Groq key was found in that history.
Only environment examples are tracked; node_modules, dist, artifacts and CLI
caches remain ignored. Financial test fixtures are explicitly fictional.

This is a known-value/pattern audit, not proof against all obfuscation or an
independent penetration test. Repeat for new participant commits before release.
Do not treat Private visibility or CODEOWNERS as a replacement for secret/access
checks. The test-project URL/reference and fictional financial amounts are not
credentials. No repository visibility change was made.

## Member 2: frontend/fsm-ux

Comparison uses merge-base `590a234`, not a two-dot diff that could misattribute
the owner's entire backend implementation to the frontend contributor.

Published changes since that base are exactly:

- `.github/CODEOWNERS`
- `.github/pull_request_template.md`
- `AGENTS.md`
- `docs/COLLABORATION.md`

These are the original collaboration instructions, not new UI engineering work.
No additional landing/questionnaire/dashboard/chart/responsive/PDF implementation
commit is published. The audit cannot determine the state of local work elsewhere.

Completed in Git: branch/handoff governance and a PR template. Still requiring a
delivery: the P0/P1 tasks in TEAM_MEMBER_2_FRONTEND.md, especially readable financial
results, existing-route usability and agreement/PDF presentation. The existing
Phase 6 backend already provides the full workflow and server PDF; do not rebuild it.

A temporary-file text merge probe found actual add/add conflicts in
`.github/CODEOWNERS`, `AGENTS.md`, `docs/COLLABORATION.md`. The PR template is
identical and has no text conflict. No repository merge/index/branch rewrite was
performed. There is no new UI patch ready to merge now; merging the old branch
would mainly introduce stale governance. Preserve the latest owner-approved
rules during any later manual resolution, with no whole-src replacement.

After a new UI PR: inspect pure components/CSS independently; coordinate
AppLayout, QuestionField and page wrappers, and keep live containers/auth/hooks
owner-controlled. Run typecheck, lint, build and offline UI checks. The owner
then runs the appropriate live finance/questionnaire/agreement/browser/PDF
regressions against the approved test project under separate mutation permission.
No cloud tests belong in ordinary frontend PR CI.

## Member 3: feature/fsm-insights

Its tip `4c43ad5` is an ancestor of Phase 6. There are **zero incoming commits or
changed files** relative to that merge-base. The reverse diff consists of the
owner's Phase 6 changes, not Member 3's delivery. There is no published Insights
implementation, benchmark dataset, Qwen PoC or module test suite to assess yet.
The existing source-research seed and PoC brief were prepared by the owner.

Completed in Git: a compatible Phase 5 implementation/contract base and the
assignment. Not yet published: deterministic module, compatible benchmark gate,
source-attributed dataset, offline unit tests and fictional-data Qwen run evidence.
No text conflict exists for the current empty incoming change set. There is no
reason to merge this unchanged ancestor branch into backend now.

The existing FinancialInput/FinancialScenario/SimulationOutput contracts and
Financial Engine remain suitable. Phase 6 adds agreement/PDF code without
changing those financial types/algorithms. Review future isolated changes only
under `src/features/insights/`, `tests/insights/`, `docs/insights/`. Check provenance,
not_comparable cases, no duplicate allocation formulas, no raw-data capture and
no network calls from default unit tests. Validate a Qwen PoC separately using
fictional inputs and a confirmed free account; no main-app AI integration is
authorized. Any source/API/consent change requires owner review before coding.

Future module acceptance requires its explicit Node unit commands, strict test
typecheck with TypeScript 7 `--ignoreConfig`, app typecheck/lint/build and the
recorded integration contract. Relevant owner-run live checks follow integration.
No participant branch was advanced, rebased or changed by this audit.

## Test and build state

The unchanged Phase 6 commit has recorded evidence for **143 distinct passing
cases**: backend 44, offline UI 27, real security 68 (session 15, questionnaire 16,
finance 18, agreement 19), and real browser integration 4. App typecheck, explicit
strict new-test typecheck, lint and production build passed. See PHASE6.md for
actual runs, corrected failures and cleanup. None of those 143 cases was rerun
for this documentation-only audit. Documentation checks are not new runtime proof.

Configuration review: npm scripts explicitly separate offline unit/UI checks
from credentialed/mutating security/live commands. `ui-test` Vite mode blanks
Supabase settings; Playwright's 27 offline cases use Microsoft Edge on port 5174.
`live-test` uses the guarded test environment on 5175 with traces/screenshots/video
off. Build has the known nonblocking 503.14 kB entry advisory. The PDF library is
server-only; no Qwen SDK is imported into the main app.

`npm run typecheck` covers src and Vite tooling, not every test/Edge entry file.
Node's TypeScript stripping is not static test typechecking. Keep the explicit
strict test-source check from PHASE6.md when changing those files. Linux CI and
any proposed workflow have not been executed and must not be reported as passing.

## Minimal CI proposal — not installed

There is no `.github/workflows/` file. Subject to owner approval, a first workflow
could use the draft below: read-only token, ordinary pull_request, no secrets,
no Supabase login or deployment, and the explicit offline backend allowlist.
The current official [checkout](https://github.com/actions/checkout) and
[setup-node](https://github.com/actions/setup-node) examples use v7; resolve and
pin reviewed release SHAs when implementing. Node 24.11.1 matches the verified
local toolchain. This is a design example inside Markdown, not an active workflow.

```yaml
name: Offline checks
on:
  pull_request:
    branches: [main, backend/fsm-core]
permissions:
  contents: read
jobs:
  verify:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    env:
      VITE_SUPABASE_URL: ''
      VITE_SUPABASE_PUBLISHABLE_KEY: ''
      FSM_ALLOW_TEST_DATABASE_MUTATIONS: '0'
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
      - uses: actions/setup-node@v7
        with:
          node-version: '24.11.1'
          package-manager-cache: false
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run test:backend
      - run: npm run build
```

The final workflow should add the explicit strict test-source check rather than
mistake runtime stripping for tsc. Optional offline UI CI needs a separately
reviewed browser/runner setup compatible with the current `msedge` channel and
Windows-oriented test server command. Do not claim the Linux draft executes the
existing UI suite. Do not change Playwright configs during this audit.

Never add test:security, test:questionnaire, test:finance, test:agreement,
test:live, CLI deployment or PoC real-network commands to ordinary PR workflows.
Do not use pull_request_target for running contributor code, inject credentials,
upload sensitive live traces, or broaden permissions. Review new test imports
before adding Insights tests to the explicit offline job. GitHub Settings,
workflow/CI creation and associated costs/quota require the owner's confirmation.
The event/permission proposal follows the official
[workflow syntax reference](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax).

## Proposed issues and integration order — none created

| Priority / suggested issue | Owner | Acceptance and dependency |
| --- | --- | --- |
| P0 Preserve verified Phase 1-6 and add offline CI | Owner | Review workflow proposal/plan access; install only after approval; preserve all privacy/cent/version/PDF assertions. |
| P0 Deliver and review frontend P0 PR | Member 2 + owner | Small presentation diff to backend/fsm-core; preserve typed outputs, consent/errors and explicit approvals; resolve governance conflicts manually. |
| P0 Recheck complete browser flow and final PDF | Owner | After actual integration, explicit test-project permission; independent A/B/C, refresh, revisions/withdrawal and actual downloaded PDF amounts; no fake fixture success. |
| P0 Production readiness and approved website deployment | Owner | Decide fictional-only hackathon backend vs real-user lifecycle, production configuration, exact origins/Auth settings and secrets; verify deletion/retention gaps before collecting real user finances; no deployment in this audit. |
| P0 Public submission URL and release evidence | Owner | After deployment approval/checks, test HTTPS, refresh/deep links, registration-free jury access and truthful Demo/live boundaries; obtain separate approval for any repository visibility change. |
| P1 Financial visualization and responsive refinement | Member 2 | Render existing engine DTOs; readable burdens/shortfalls/savings and accessible charts at desktop/tablet/mobile; no new financial formulas. |
| P1 Deterministic Smart Insights | Member 3 | Isolated offline module with sourced applicability/not_comparable and tests; owner reviews before a UI adapter. |
| P1 Verify fictional-data Qwen PoC | Member 3 + owner | Actual free-account model/limits, validated factual outputs/fallback and sanitized evidence; no real finances, key in frontend or main-app integration. |
| P2 More benchmarks and richer AI explanation proposal | Member 3 | Verified population/category/period matching; external-AI consent/payload design remains a separate approval. |
| P2 Additional visual polish | Member 2 | Only after tested core/browser/PDF and delivery readiness. |

Next steps: publish the local audit/docs commit only after approval; obtain small
participant PRs; approve/install minimal offline CI; integrate and run relevant
end-to-end/PDF regressions; then separately approve production configuration,
website deployment and public submission verification. No issues, workflows,
merge, new cloud operation or website deployment were created during this audit.
