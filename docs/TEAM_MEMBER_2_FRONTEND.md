# Team Member 2: Frontend Engineering, UI/UX, Visualization and PDF Presentation

## Assignment and starting point

You own presentation on `frontend/fsm-ux` in the private repository
https://github.com/anuarmariyam/FirstSharedMoney. Use VS Code, Git and optionally
ChatGPT; Codex is not required. Improve the existing React/TypeScript application.
Do not scaffold a replacement application or implement another financial engine.
All shipped copy must use natural American English. Use fictional data only.

Reviewed baseline: backend Phase 5 commit `3063cd4`, documented in `docs/PHASE5.md`.
It already implements real comparison, Equal/Proportional/Custom calculation,
five stress tests, server-authoritative scenario persistence and independent
consents. The agreement backend and approved-document export are still future work.

At this review, remote `main` is `590a234` (Phase 3), and remote
`frontend/fsm-ux` is `9a640e5` (Phase 3 plus collaboration instructions). There are
no new frontend implementation commits or open PRs on GitHub. These are review
observations, not a claim about unpushed work on your computer. Never discard it.
The backend branch is not published yet; its publication needs owner approval.

`src/types/domain.ts` and `src/types/engines.ts` are byte-identical between main
and Phase 5. You can already build typed presentation components on your branch.
`src/types/api.ts` in Phase 5 additionally exposes `getFinancialInputs`; live hooks,
services and runtime engines also differ. Do not replace them with Phase 3 files.

## Checkout without credentials

From a chosen parent folder on D, clone once:

```powershell
git clone https://github.com/anuarmariyam/FirstSharedMoney.git
Set-Location FirstSharedMoney
git switch --track origin/frontend/fsm-ux
npm.cmd ci --cache D:\npm-cache
npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

For an existing clone, save your own changes first, then use `git fetch origin`
and `git switch frontend/fsm-ux`. Do not use reset, clean, force push or overwrite
another checkout. An owner invitation to the private repository is required.
Open `http://127.0.0.1:5173/`; Demo is under `/sessions/demo`.
Do not obtain or copy the owner's `.env*`, database connection, CLI credentials,
browser Auth storage or certificates. Unconfigured Demo works without Supabase.

After the owner publishes backend, inspect it without changing your branch:

```powershell
git fetch origin
git show origin/backend/fsm-core:src/types/api.ts
git show origin/backend/fsm-core:src/features/simulator/LiveSimulatorPage.tsx
git diff origin/main...origin/backend/fsm-core -- src/pages/SimulatorPage.tsx
```

Until then the owner can send these source files for read-only reference, never
environment files. Do not paste the whole backend into your branch. The owner
will integrate your presentation components into live containers during review.

## P0: Must Have, first delivery

### 1. Audit and improve the existing journey

Work in small groups; aim for roughly 3-5 focused hours, not a new design system.
If time runs short, prioritize questionnaire usability and financial clarity.

| Screen / actual route | Existing files | Required result / acceptance |
| --- | --- | --- |
| Landing `/` | `src/pages/LandingPage.tsx`, `src/components/PlanPreview.tsx` | Two clear actions, `Create Our Money Plan` and `Try Demo`; concise value and how-it-works; no fabricated statistics, testimonials or working-payment claims. |
| Create/join `/create`, `/join`, session root | `src/pages/SessionPage.tsx`; backend containers in `src/features/session/` | Clear invitation/waiting/error states; keep independent identity guidance. Containers are read-only until a coordinated presentation patch is agreed. |
| Questionnaire `/sessions/:coupleId/questionnaire?step=1`, `/questionnaire/consent` | `src/pages/QuestionnairePage.tsx`, `src/features/questionnaire/QuestionField.tsx`; live container `src/features/questionnaire/LiveQuestionnairePage.tsx` | Readable progress, Previous/Continue, field errors, save/network/stale states and two separate opt-in consent controls. Preserve all 15 prompts, validation and question types. |
| Differences `/sessions/:coupleId/differences` | `src/pages/DifferencesPage.tsx` | Distinguishable Aligned Preferences / Different Expectations / Unresolved Decisions, neutral discussion prompts, no compatibility score or private values. |
| Simulator `/sessions/:coupleId/simulator` | `src/pages/SimulatorPage.tsx`, `src/features/simulator/FinancialSummary.tsx`; live container `src/features/simulator/LiveSimulatorPage.tsx` | Clear total, contributions, remaining balances and warnings; handle zero-income unavailable results. Keep save/retry/consent errors visible. |
| Agreement `/sessions/demo/agreement` | `src/pages/AgreementPage.tsx`, `src/components/AgreementStatus.tsx` | Improve the existing local draft and lifecycle presentation. Approved/proposed are not actual local states. |
| Agreement preview `/sessions/demo/agreement/preview` | `src/pages/AgreementDocumentPage.tsx` | Readable, visibly unapproved sample document with printable presentation. No fake signatures or enabled confirmed-export action. |
| Navigation, all viewports | `src/components/AppLayout.tsx`, `src/App.css`, `src/index.css` | Visible active location, usable mobile menu, keyboard focus, short actions and no horizontal overflow. Preserve route guards and Outlet context. |

Live agreement routes are currently blocked by `AppLayout`. Do not unblock them
to make a screenshot or claim that the workflow is connected. `/sessions/demo`
remains a separate fictional, in-memory path, including its static simulator.

Audit copy such as `Frontend preview` in AppLayout, `Local fixture`/`Fixture` in
Demo, and obsolete Phase 4A explanations. Replace them with concise `Demo`,
`Sample Data`, `Not connected yet` or a correct current limitation. Keep material
privacy, saving, access, stale-version and unapproved-status explanations.
Do not remove alerts to simplify a screen. Remove decorative button arrows where
they add no meaning; preserve useful navigation icons and accessible labels.
Use the current light cream/lavender palette, existing CSS classes and typography.

### 2. Typed financial presentation

Start with the existing `src/features/simulator/FinancialSummary.tsx`. Create only
components actually used, preferably under new `src/components/financial/`:
`BudgetBreakdown.tsx`, `ContributionComparison.tsx`, `ScenarioComparison.tsx`.
Add a colocated CSS file only if necessary. Prefer accessible SVG/CSS to a new
chart dependency. A chart must have a text/table equivalent and not rely on color.

Suggested local props (new presentation types, not API changes):

```ts
import type {
  FinancialInput, SimulationOutput, SplitCalculation, SplitModel,
} from '../../types/domain'

type AvailableSplit = Extract<SplitCalculation, { status: 'available' }>
interface BudgetBreakdownProps {
  readonly expenses: FinancialInput['sharedExpenses']
  readonly monthlyTotalCents: AvailableSplit['monthlySharedTotalCents']
}
interface ModelResult {
  readonly model: SplitModel
  readonly output: SimulationOutput
}
interface ScenarioComparisonProps {
  readonly before: SimulationOutput | null
  readonly after: SimulationOutput
}
```

The owner supplies calculated props. The Phase 5 live container already has
`calculation.models`, `calculation.input` and the saved `current.output`.
Do not introduce a second calculation implementation. If before/after data is
not supplied, render only the available result or request an owner adapter.
Do not subtract financial amounts or infer a baseline in JSX. Financial model
selection, request IDs, debouncing, revision checks and saving stay in containers.

| Display | Authoritative existing field / rule |
| --- | --- |
| Shared monthly allocation | Available `output.split.monthlySharedTotalCents`; includes savings once. |
| A/B monthly contribution | `output.split.allocations.A/B.monthlyContributionCents`. |
| Category breakdown / donut | `output.effectiveInput.sharedExpenses` for the selected scenario; five categories including separately labeled savings. Do not add savings a second time. |
| Shared savings | `output.effectiveInput.sharedExpenses.shared_savings`; there is no independently rounded per-partner savings DTO. Do not invent one. |
| Model comparison | Supplied `SimulationOutput[]` from the existing engine; same input and stress selection across models. |
| Burden | `allocations.A/B.incomeBurdenPercent`, already a display percentage string; null means `N/A`. It includes modeled one-off contribution, so do not label it monthly-only when a one-off cost exists. |
| Remaining income | `incomeAfterSharedCostsCents`, `availableAfterObligationsCents`; allow negative currency values and visible shortfalls. |
| Emergency scenario | `reserveUsedCents`, `effectiveInput.sharedEmergencyFundCents`, `split.oneOffSharedTotalCents`; funded reserve is not another income deduction. |
| Unavailable proportional | `split.status === 'unavailable'`, `reason === 'zero_total_income'`; never render invented A/B amounts. |

Use existing `formatMoney` from `src/lib/money.ts` unchanged. Zero is formatted
as `$0`; nonzero fractional cents are shown as dollars with cents. Chart geometry
may normalize already calculated values for drawing; it must never produce
contributions, affordability percentages, remaining balances or saved outputs.
Treat display rounding as presentation, not an accounting allocation.

P0 acceptance: monthly total and A/B amounts are easy to find; all three models
have clear labels; zero/unavailable/negative states render; errors survive; no
raw questionnaire answers are requested by charts or comparison cards.

## P1: High Value, after P0

Allow roughly 1-2 additional hours. Add a compact expense donut with legend and
accessible table; improve before/after stress comparison using supplied outputs;
finish agreement document layout and print pagination. Prefer these to animations.

For agreement presentation, create a pure component under
`src/features/agreement/presentation/AgreementDocument.tsx` only when used.
It may accept `AgreementVersion` for future integration and an explicitly labeled
sample presentation model for the current Demo. Do not cast the local
`AgreementDraftInputs` to an approved `AgreementVersion`.

| Section | Existing future contract |
| --- | --- |
| Budget/model/contributions | `AgreementVersion.financialSummary`, `items` money entries. |
| Shared savings | Item with `key: 'shared_savings'`; do not infer an independent goal not present in the DTO. |
| Spending/debt/purchase rules | Discriminated `items` for `personal_spending`, `large_purchase`. |
| Emergency and next review | `items` with `key: 'emergency'` / `'review'`. |
| Version and status | `versionNumber`, `status`, `contentHash` when supplied. No invented version for Demo. |
| Partner confirmations | `approvals.A/B` and their version/hash/timestamp only from the server. Missing means pending. |

Show USD, dates, version/status and readable multi-page rows. Keep a short note
that the document is a personal planning tool, not a legal contract or professional
financial advice. In `src/App.css`, scope `@media print` to the agreement document;
hide navigation, avoid clipped amounts and unwanted page breaks. A browser print
preview may demonstrate the **unapproved sample**, never an approved PDF export.
Do not install jsPDF or wire export/auth/endpoints. The backend owner will fetch
and authorize the confirmed immutable version after separately approved Phase 6,
then connect the actual export. Until then the confirmed-export button is disabled.

## P2: Optional

Small visual polish, empty-state refinements or reduced-motion transitions only
after the tested P0/P1 handoff. No redesign, payment integration, AI, new routes,
financial formulas, banking integrations or approval workflow implementation.

## Exact ownership and edit rules

| Permission | Paths |
| --- | --- |
| Presentation edits allowed, preserve exports/props | `src/App.css`, `src/index.css`, `src/assets/`, `src/components/ui.tsx`, `src/components/Icon.tsx`, `src/components/PlanPreview.tsx`, `src/components/AgreementStatus.tsx`, `src/features/simulator/FinancialSummary.tsx`. |
| New presentation files allowed | `src/components/financial/`, `src/features/comparison/presentation/`, `src/features/agreement/presentation/`; create only used components. |
| Allowed with focused presentation-only diff and owner coordination | `src/pages/LandingPage.tsx`, `src/pages/AgreementPage.tsx`, `src/pages/AgreementDocumentPage.tsx`; preserve links, local draft semantics and validation calls. |
| Shared integration: coordinate before editing | `src/App.tsx`, `src/components/AppLayout.tsx`, `src/pages/SessionPage.tsx`, `src/pages/QuestionnairePage.tsx`, `src/pages/DifferencesPage.tsx`, `src/pages/SimulatorPage.tsx`, `src/features/questionnaire/QuestionField.tsx`. Backend already changed these files. |
| Backend containers: read-only; owner integrates presentation | `src/features/session/LiveSessionPage.tsx`, `src/features/session/SessionEntryPage.tsx`, `src/features/questionnaire/LiveQuestionnairePage.tsx`, `src/features/simulator/LiveSimulatorPage.tsx`. |
| Forbidden without explicit owner agreement | `supabase/`, `scripts/`, `src/engines/`, `src/types/`, `src/services/`, `src/lib/`, `src/app/`, `src/hooks/`; catalogs, answer adapters and validation under `src/features/questionnaire/`; `src/features/agreement/validation.ts`; `src/features/comparison/demo-results.ts`, `src/features/simulator/demo-fixtures.ts`; `tests/backend/`, `tests/live/`, environment files. |
| Tooling and governance: propose first | `package.json`, lockfile, Vite/TypeScript/Playwright configs, `.github/`, `AGENTS.md`, shared architecture docs. No new dependency by default. |
| UI tests | Add narrowly scoped cases or agreed accessible-name updates in `tests/ui/frontend.spec.ts`; preserve privacy/demo assertions, never delete checks to get green. |

Member 3 owns only the proposed Insights module. Do not edit its directory or
integrate it into shared pages until the owner approves the integration adapter.

## Verification and handoff

Run from your clone:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd run test:ui
git diff --check
git status --short
```

The existing offline suite runs nine cases at desktop 1440x1000, tablet 834x1112
and mobile 390x844. It uses Microsoft Edge; check browser availability first.
Keep test artifacts on D, outside Git. No full live/security test or cloud mutation
is authorized by this frontend assignment; the owner reruns relevant live tests
after integration, especially `tests/live/finance.spec.ts` and questionnaire flows.

Check manually: landing CTAs, browser Back/Forward, menu focus and Escape, all 15
questions and consent screen, long/invalid money inputs, aligned/different/missing
results, 0 and negative balances, saved/loading/error/withheld states, agreement
draft and print preview. Use the supplied typed fixtures for visual states; do not
make fake server responses or new production calculators. Existing Demo simulator
is static and must stay truthfully labeled.

Deliver screenshots of landing, questionnaire+consent, differences, simulator and
agreement preview at all three viewports, plus one mobile navigation and a print
preview. Use only sample data. Share compressed screenshots through the PR or a
separate attachment; do not commit generated artifacts or financial/Auth traces.

PR content: short problem/result description, P0/P1 list, base commit, changed paths,
screenshots, commands/results and any skipped checks. Keep CSS/presentation and
shared integration patches separate. No whole-file reformatting, vendored backend,
new credentials or unrelated lockfile edits. Request owner review; never merge it.

Branch publication by the owner is pending. After the owner publishes backend,
use PR base **backend/fsm-core**, head **frontend/fsm-ux** for integration review;
do not target main for a UI-only release. Existing branches share Phase 3 history,
so a review can isolate your changes without copying backend into your branch.
Three known add/add governance conflicts are `.github/CODEOWNERS`, `AGENTS.md`,
and `docs/COLLABORATION.md`; the owner resolves these manually, keeping current
three-member rules. The identical PR template does not currently conflict.
If you already have local work, coordinate its publication rather than rebasing,
merging or force-pushing automatically. No remote operation is executed by this brief.

Done means the agreed presentation scope passes checks, keeps real safety states,
uses the existing DTOs without new money logic, and is reviewable by the owner.
