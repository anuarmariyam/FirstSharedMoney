# Team Member 3: US Research, Benchmarks and Smart Insights

## Assignment and baseline

Build one isolated, deterministic TypeScript module for interpreting **planned**
shared spending, not bank transactions. Use official US references as descriptive
context, not a normal, optimal or fair budget. Do not rebuild Conflict Detection,
Financial Simulation, authentication, persistence or agreement approval.

Repository: https://github.com/anuarmariyam/FirstSharedMoney (Private at review).
Your branch is `feature/fsm-insights`, based on the reviewed Phase 5 milestone
`3063cd4` plus the owner's handoff documentation commit. Do not branch from the
old `main` at `590a234`: it lacks the runtime engines and live integration.
`domain.ts` and `engines.ts` already match main, but type declarations alone are
not the implemented engines. No branch publication has been authorized yet.

Phase 5 already provides:

- `src/engines/financial.ts`: `financialEngine.calculate` / `.simulate`, exact
  cents and BigInt intermediate arithmetic, input/model validators.
- `src/engines/conflict.ts`: neutral derived comparison; raw answers stay private.
- `src/types/domain.ts`: `FinancialInput`, `FinancialScenario`, `SimulationOutput`,
  `SplitCalculation`, `SplitModel`, `Cents`, `SignedCents`, `SharedExpenseCategory`.
- `src/types/engines.ts`: the pure `FinancialSimulationEngine` interface.
- `src/types/api.ts`: consent/revision-gated API contracts, owned by the backend.
- `docs/PHASE5.md`: implementation and historical 111/111 verification evidence.

## Checkout after the owner publishes the prepared branches

The owner will tell you when `origin/feature/fsm-insights` exists. Until then read
this brief and research official sources; do not create an incompatible branch.
From your own parent folder on D:

```powershell
git clone https://github.com/anuarmariyam/FirstSharedMoney.git
Set-Location FirstSharedMoney
git fetch origin
git switch --track origin/feature/fsm-insights
git merge-base --is-ancestor 3063cd4 HEAD
npm.cmd ci --cache D:\npm-cache
```

The ancestry command must succeed. For an existing clone, save your work before
switching; never reset, force-push or copy another developer's entire checkout.
You need GitHub collaborator access, not Supabase credentials. Do not request or
copy `.env*`, a database URL, JWT, secret key or the owner's browser storage.
Keep new files/caches on D. All fixtures are fictional. Your module must work
offline with local, source-attributed benchmark snapshots and no API keys.

## Priorities and timebox

| Priority | Deliverable | Suggested ceiling / acceptance |
| --- | --- | --- |
| P0 — Must Have | Existing-engine-based explanations, strict `not_comparable` behavior, source inventory and unit tests. | Roughly 2-3 hours; useful without any statistical comparison. No network call on the analysis path. |
| P1 — High Value | One carefully matched official grocery or housing reference, versioned provenance, a comparison test. | Roughly 1-2 more hours, only after P0 is reviewed. Leave unsupported categories unavailable. |
| P2 — Optional | Additional defensible references or an LLM explanation design note. | Stop if it delays end-to-end agreement/PDF work. No LLM integration or training in this assignment. |

A correct unavailable benchmark is a valid delivery. Do not spend the hackathon
building a scraper, demographic questionnaire, national dataset pipeline, price
forecasting system or model. The core product must not depend on this module.

## Official source inventory, checked 2026-11-15

These are source pointers and a small verified research seed, not an imported
benchmark dataset. Record each actual extraction, release date and row before
shipping a number. URLs labelled current are mutable; pin the report period.

### BLS Consumer Expenditure Surveys

- [2025 annual release](https://www.bls.gov/news.release/cesan.nr0.htm): released
  **2026-10-29**, reference year **2025**. Annual USD per consumer unit; national
  observed expenditure estimates, not recommendations. The release notes missing
  2025 interview collection and weighting adjustments; retain that limitation.
- [Published table index](https://www.bls.gov/cex/tables.htm): 2025 tables by consumer
  unit size, housing tenure and other demographics. Means, shares and uncertainty
  measures are different columns; select the correct one. Geographic two-year
  and cross-tabulated tables have their own periods, often 2023-2024.
- [Size of consumer unit, 2025 XLSX](https://www.bls.gov/cex/tables/calendar-year/mean-item-share-average-standard-error/cu-size-2025.xlsx): select the two-person column only when appropriate.
- [Housing tenure, 2025 XLSX](https://www.bls.gov/cex/tables/calendar-year/mean-item-share-average-standard-error/cu-housing-tenure-2025.xlsx): renter/owner populations differ.
- [Two-person units by age, 2023-2024 XLSX](https://www.bls.gov/cex/tables/cross-tab/mean/cu-size-by-age-2-persons-2023-2024.xlsx): use the published cross-tab, not an invented join of unrelated averages.

The XLSX links were resolved from the official index; spreadsheet values have
not been extracted in this assignment. Housing is broader than FSM rent; food
at home differs from all food; utilities/fuels/public services may not match a
mixed utilities entry. A consumer unit's expenses can include personal costs
absent from this app. Do not match BLS **before-tax income** bins against FSM
**take-home income**, or divide a household statistic by two automatically.

### USDA Monthly Cost of Food Reports

- [Official canonical index](https://www.fna.usda.gov/research/cnpp/usda-food-plans/cost-food-monthly-reports);
  [USDA-hosted delivery copy successfully read](https://fns-prod.azureedge.us/research/cnpp/usda-food-plans/cost-food-monthly-reports).
  The old `fns.usda.gov`/canonical page returned 403 in this environment; the
  delivery copy and linked PDFs were accessible. The index was updated
  **2026-11-13** and lists **October 2026** reports. This is an index update date,
  not proof of an exact PDF issue day.
- [October 2026 Thrifty PDF](https://fns-prod.azureedge.us/sites/default/files/resource-files/CostofFoodOct2026Thrifty.pdf):
  issued **November 2026** (exact day not stated). Weekly/monthly USD by age-sex
  group, US average, with separate Alaska/Hawaii information in other reports.
  Prepared-at-home meals/snacks; not actual observed household spending.
- [October 2026 three-level PDF](https://fns-prod.azureedge.us/sites/default/files/resource-files/CostofFoodOct2026LowModLib.pdf):
  issued **November 2026**. Low/Moderate/Liberal weekly and monthly costs.
  A verified example row is **Female 19-50, Moderate-Cost monthly $337.00**;
  **Male 19-50, Moderate-Cost monthly $398.90**. These are individual entries
  based on four-person households, not a quoted two-person total or a target.

The PDFs' footnotes apply household-size adjustments: sum the appropriate member
entries, then add 10% for two people. Published monthly amounts are already
derived using 4.333 weeks and rounded to ten cents; use the monthly column.
Do not infer sex, age group or food coverage from names or the product's audience.
The three-level PDF uses 19-50 where Thrifty uses 20-50; preserve each report's
own age bands, not the index's simplified labels. National references are not
city prices. Without suitable voluntarily supplied context return `not_comparable`.

### Census ACS, optional housing context

- [2025 release schedule](https://www.census.gov/programs-surveys/acs/news/data-releases/2025/release-schedule.html):
  updated **2026-10-29**, lists 2025 ACS 1-year release **2026-10-29**; one-year
  geography generally requires population 65,000+. The five-year release is
  listed TBD at review. Do not assume a newer five-year dataset is available.
- [2025 ACS 1-year B25064 variable dictionary](https://api.census.gov/data/2025/acs/acs1/groups/B25064.html):
  `B25064_001E` median gross rent, USD; `B25064_001M` margin of error.
  Fetch a chosen geography's estimate and MOE together only after defining the
  matching population/period. No actual area estimate is imported by this brief.
- [Official gross-rent definition](https://www.census.gov/quickfacts/fact/note/US/HSG860224):
  monthly contract rent plus specified renter-paid utilities/fuels; median,
  not mean. This definition page describes a five-year QuickFacts product;
  do not mislabel that product as the one-year B25064 dataset.
- [ACS comparison guidance](https://www.census.gov/programs-surveys/acs/guidance/comparing-acs-data.html):
  use consistent period types and account for sampling uncertainty; do not
  treat differences between unrelated cohorts or periods as precise evidence.

FSM currently has no verified locality, tenure, household composition or utility
coverage questionnaire. Therefore matched ACS/USDA comparisons are unavailable
by default. Do not add demographic fields to shared UI or API yourself.

## Research deliverables and comparability gate

Use `docs/insights/SOURCES.md` for a compact source register and extraction notes.
If a source supports P1, place a small reviewed snapshot in
`src/features/insights/data/us-benchmarks.ts`, with typed readonly records. No
unverified numeric filler. For each record store:

- Stable ID; agency; canonical URL plus exact download URL; table/row/column/page.
- `referencePeriod`, `publishedAt` or `publishedMonth` (never invented day),
  `retrievedAt`, units, monthly/annual period, currency and mean/median/plan type.
- Geography/population/household/tenure/age-band scope; category inclusions and
  exclusions; uncertainty/rounding; raw source value and explicit transformation.
- Method/version, limitations and reviewed status. Keep a checksum if a file was
  downloaded. Do not commit large source archives or scrape during runtime.

Match definitions, household coverage, geography and time basis **before** a
numeric comparison. A missing field is unknown, not a guessed US average household.
The comparison categories are FSM `rent`, `groceries`, `utilities`, `other`:

| Category | Default behavior / possible P1 match |
| --- | --- |
| Housing (`rent`) | `not_comparable` against BLS total housing or ACS gross rent unless rent/utility coverage, renter cohort and geography are actually established. Never add utilities twice. |
| Groceries | Candidate USDA food-at-home plan only if coverage and household profiles are compatible. Mixed toiletries, dining out or unknown coverage means unavailable. |
| Utilities | No comparison until the same service basket and inclusion in rent are confirmed; otherwise `definition_mismatch`. |
| Other shared costs | Aggregate with unknown contents: `unsupported_category` unless the owner supplies an explicit defensible mapping. |

`shared_savings` is not consumer spending; never include it in an expense
benchmark. Category shares may use the engine's monthly allocation total
(including savings), but label that denominator explicitly. Do not compare
that share with BLS consumption shares or actual historical spending.
Annual-to-monthly normalization belongs only in the benchmark adapter, with a
documented integer/rational rounding policy; it is not a second allocation engine.
Do not run inflation adjustments without an approved matching official series.

## Isolated implementation boundary

Only create files that are used. Proposed allowlist:

| New path | Purpose |
| --- | --- |
| `src/features/insights/types.ts` | Local input/output/provenance/comparability types; import existing domain types. |
| `src/features/insights/benchmarks.ts` | Pure matching/normalization with explanatory unavailable results. |
| `src/features/insights/insights.ts` | Pure deterministic explanations of already calculated results. |
| `src/features/insights/data/us-benchmarks.ts` | P1 only: small verified static dataset. |
| `tests/insights/benchmarks.test.ts` | Matching, provenance and normalization tests. |
| `tests/insights/insights.test.ts` | Explanations, zero/negative/unavailable/determinism tests. |
| `tests/insights/fixtures/` | Fictional JSON fixtures generated by the existing engine. |
| `docs/insights/SOURCES.md`, `docs/insights/INTEGRATION.md` | Source register and short integration/readme notes. |

Do not edit `supabase/`, authentication, `src/app/`, `src/hooks/`, `src/services/`,
`src/types/`, `src/lib/`, `src/engines/`, agreement code, shared pages, CSS,
Member 2's presentation files, existing tests, package/lockfiles or tooling.
No root export/barrel change is required: the future owner adapter can import
your function directly. Any existing-interface change must be proposed to the
owner before implementation. A local type does not amend a backend API contract.

## Proposed module interface, not an existing exported API

Implement this in your new directory; do not add it to `src/types/`:

```ts
import type {
  Cents, SignedCents, FinancialScenario, SimulationOutput,
} from '../../types/domain.ts'

export type BenchmarkCategory = 'rent' | 'groceries' | 'utilities' | 'other'
export type UnavailableReason =
  | 'missing_source' | 'missing_context' | 'definition_mismatch'
  | 'population_mismatch' | 'period_mismatch' | 'unsupported_category'

export interface BenchmarkContext {
  readonly householdSize: number | null
  readonly region: string | null
  readonly plannedMonth: string | null
  readonly rentDefinition: 'contract_rent' | 'gross_rent' | 'unknown'
  readonly groceriesDefinition: 'food_at_home_only' | 'mixed' | 'unknown'
  readonly utilitiesDefinition: 'specified_services' | 'mixed' | 'unknown'
}
// Add the complete typed provenance/profile requirements locally before P1.
// Do not accept arbitrary numeric references without their matching metadata.
export interface BenchmarkRecord {
  readonly id: string
  readonly category: BenchmarkCategory
  readonly monthlyCents: Cents
  readonly sourceUrl: string
  readonly referencePeriod: string
  readonly populationDefinition: string
  readonly limitations: readonly string[]
}
export type BenchmarkResult =
  | { readonly status: 'not_comparable'; readonly category: BenchmarkCategory
      readonly reason: UnavailableReason; readonly explanation: string }
  | { readonly status: 'comparable'; readonly category: BenchmarkCategory
      readonly sourceId: string; readonly plannedCents: Cents
      readonly referenceCents: Cents; readonly differenceCents: SignedCents
      readonly interpretation: 'descriptive_context'
      readonly limitations: readonly string[] }

export interface InsightsInput {
  readonly scenario: FinancialScenario
  readonly baseline: SimulationOutput | null
  readonly alternatives: readonly SimulationOutput[]
  readonly context: BenchmarkContext
  readonly benchmarks: readonly BenchmarkRecord[]
}
export interface InsightsOutput {
  readonly basis: 'planned_expenses'
  readonly largestCostCategories: readonly BenchmarkCategory[]
  readonly discussionCodes: readonly string[]
  readonly benchmarks: readonly BenchmarkResult[]
}
export function analyzePlannedBudget(input: InsightsInput): InsightsOutput
```

This skeleton is the proposed P0 boundary; the P1 metadata gate must not rely on
free-text equality for population matching. Define local structured scope fields
and document them before implementing a positive match. No `any`, unsafe casts
of unvalidated JSON, or edits to shared domain contracts. Reuse existing validators
for financial inputs; validate your own context and public source records.

The owner supplies an authorized `FinancialScenario` from the existing service.
Use `scenario.output.effectiveInput` for the selected stressed state and
`scenario.output.split` for allocations/warnings. The baseline is a separately
supplied call to `financialEngine.simulate(scenario.input, scenario.model, null)`;
alternative models must use that same validated input and stress through the
existing engine. Call it in tests or an owner adapter, not a replacement formula.
If inputs/revisions/stress do not match, omit the cross-model insight explicitly.

P0 logic: rank planned cost categories (exclude savings from cost ranking; tie
order rent/utilities/groceries/other); use existing `income_shortfall`, `zero_income`,
`reserve_exhausted` warnings; identify neutral discussion prompts for the largest
cost, any deficit and modeled trade-offs. Compare supplied result fields, never
recalculate split weights, income burdens, obligations, savings or reserve use.
Own descriptive category ratios/benchmark deltas are permitted here, with clear
denominators and exact arithmetic; no new financial-engine outputs are created.
Do not describe a model as fair, a reference as a limit, or an unmodeled change
as guaranteed savings. An alternative is a question to explore, not a decision.

## Example JSON input and output

Fictional baseline; amounts are integer USD cents, source revisions are examples,
no statistics or confirmations are invented. Values below are the existing
proportional-engine output for 500000/300000 income and 320000 shared allocation.
The repeated effective input is intentional: it is part of `SimulationOutput`.

```json
{
  "scenario": {
    "id": "11111111-1111-4111-8111-111111111111",
    "coupleId": "22222222-2222-4222-8222-222222222222",
    "createdByPartnerId": "33333333-3333-4333-8333-333333333333",
    "createdAt": "2026-11-15T00:00:00.000Z",
    "input": {
      "currency": "USD", "sourceRevisions": {"A": 1, "B": 2},
      "partners": {
        "A": {"monthlyNetIncomeCents": 500000, "monthlyPersonalObligationsCents": 60000},
        "B": {"monthlyNetIncomeCents": 300000, "monthlyPersonalObligationsCents": 30000}
      },
      "sharedExpenses": {"rent": 220000, "utilities": 30000, "groceries": 50000, "other": 20000, "shared_savings": 0},
      "sharedEmergencyFundCents": 60000, "oneOffSharedExpenseCents": 0
    },
    "model": {"kind": "proportional"}, "stressTest": null,
    "output": {
      "effectiveInput": {
        "currency": "USD", "sourceRevisions": {"A": 1, "B": 2},
        "partners": {
          "A": {"monthlyNetIncomeCents": 500000, "monthlyPersonalObligationsCents": 60000},
          "B": {"monthlyNetIncomeCents": 300000, "monthlyPersonalObligationsCents": 30000}
        },
        "sharedExpenses": {"rent": 220000, "utilities": 30000, "groceries": 50000, "other": 20000, "shared_savings": 0},
        "sharedEmergencyFundCents": 60000, "oneOffSharedExpenseCents": 0
      },
      "reserveUsedCents": 0,
      "split": {
        "status": "available", "model": {"kind": "proportional"},
        "monthlySharedTotalCents": 320000, "oneOffSharedTotalCents": 0,
        "allocations": {
          "A": {"monthlyContributionCents": 200000, "oneOffContributionCents": 0, "totalContributionCents": 200000, "incomeBurdenPercent": "40.00", "incomeAfterSharedCostsCents": 300000, "availableAfterObligationsCents": 240000},
          "B": {"monthlyContributionCents": 120000, "oneOffContributionCents": 0, "totalContributionCents": 120000, "incomeBurdenPercent": "40.00", "incomeAfterSharedCostsCents": 180000, "availableAfterObligationsCents": 150000}
        },
        "warnings": []
      }
    }
  },
  "baseline": null, "alternatives": [], "benchmarks": [],
  "context": {
    "householdSize": null, "region": null, "plannedMonth": null,
    "rentDefinition": "unknown", "groceriesDefinition": "unknown", "utilitiesDefinition": "unknown"
  }
}
```

Example output contract, using a deterministic missing-source gate before other
comparability checks. Categories are positive-cost categories in descending order:

```json
{
  "basis": "planned_expenses",
  "largestCostCategories": ["rent", "groceries", "utilities", "other"],
  "discussionCodes": ["discuss_largest_planned_cost"],
  "benchmarks": [
    {"status": "not_comparable", "category": "rent", "reason": "missing_source", "explanation": "No verified reference was supplied for this category."},
    {"status": "not_comparable", "category": "groceries", "reason": "missing_source", "explanation": "No verified reference was supplied for this category."},
    {"status": "not_comparable", "category": "utilities", "reason": "missing_source", "explanation": "No verified reference was supplied for this category."},
    {"status": "not_comparable", "category": "other", "reason": "missing_source", "explanation": "No verified reference was supplied for this category."}
  ]
}
```

Reproduce the financial fixture via the real engine in tests; do not maintain
another set of expected split formulas. The module is not implemented by this
brief. The JSON is a specification example, not an API endpoint or a saved record.

## Tests and acceptance

Use Node's existing `node:test` / `assert`, not a new test framework. Tests must
cover deterministic nonmutating analysis; zero total (no NaN), equal largest-cost
ties, savings exclusion from expense benchmarks, zero/negative balances,
unavailable proportional result, all existing warning codes, matching and stale
alternative inputs, missing context/source, currency/unit/period mismatch,
housing-vs-gross-rent mismatch, mixed groceries, before-tax vs take-home mismatch,
cohort mismatch, benchmark rounding and provenance. A positive-match test needs
a fully sourced compatible record, not a fabricated national average.

```powershell
node --test tests/insights/benchmarks.test.ts tests/insights/insights.test.ts
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
git diff --check
git status --short
```

`npm run typecheck` includes `src`, while the current Node config includes only
`vite.config.ts`; new test files need their own explicit strict typecheck, too:

```powershell
.\node_modules\.bin\tsc.cmd --noEmit --strict --skipLibCheck --target ES2023 --module ESNext --moduleResolution bundler --allowImportingTsExtensions --types node tests/insights/benchmarks.test.ts tests/insights/insights.test.ts
```

Do not edit root tooling just to add a test script. Submit its proposed addition
to the owner for integration. No UI/live/security tests that write cloud data
are needed for this offline module; integration and fresh consent checks belong
to the owner. Explicitly report any test you could not run.

Deliver: new module and unit tests; small verified source dataset if P1 succeeds;
source register; fictional input/output JSON; limitations; exact commands/results;
and `docs/insights/INTEGRATION.md` documenting imports and which engine outputs
the caller must supply. No changes outside the allowlist.

## Privacy, optional LLM and integration handoff

This module does not grant consent. The existing server gates authorize shared
data; the caller must clear insights when the source request loses permission
or revision validity. Do not fetch raw questionnaires, retain private data in
localStorage/analytics, or treat an arbitrary client boolean as authorization.

P2 design only: an LLM could explain already verified results or offer neutral
questions. It must not calculate amounts/statistics, select a fair split, change
an agreement or invent evidence. Any later external transmission requires an
explicit consent/payload design reviewed by the owner; prefer minimal derived
data without income, notes, identifiers or obligations. Keys stay server-side.
No LLM SDK, API key, network call or ML/DL training is part of this assignment.

After publication, open PR head `feature/fsm-insights` to base `backend/fsm-core`.
Include source snapshot dates, unavailable cases and tests; ask the owner to
review. Do not merge or target the old main. Do not copy module output into shared
pages. The owner reviews the pure adapter and authorization boundary; Member 2
can then render the approved DTO through a separate coordinated UI patch.
Keep API/schema changes as proposals and leave security/financial logic untouched.
