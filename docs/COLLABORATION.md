# Two-Developer Workflow

## Baseline and branch purpose

Stable Phase 3 is commit 590a234 on main. It was previously verified with
typecheck, lint, production build, and 27 UI checks. Branch separation adds no
application behavior and does not claim that Supabase security has passed.

| Branch | Owner | Contents |
| --- | --- | --- |
| main | Project owner | Accepted Phase 3 only; remains at 590a234 until an approved change. |
| backend/fsm-core | Project owner / backend developer | Phase 4A snapshot 9a9ddeb, plus collaboration instructions. |
| frontend/fsm-ux | Second developer | Starts at stable main; initially adds only collaboration instructions. |

The repository remote is https://github.com/anuarmariyam/FirstSharedMoney.git.
main and frontend/fsm-ux were pushed with explicit owner approval. The backend
branch remains local; no additional push is authorized by Phase 4A completion.
Do not use git push --all: backend work has separate publication authorization.
Do not force-push or merge either work branch automatically.

## Responsibility boundaries

| Area | Responsibility / rule |
| --- | --- |
| Presentation components, styles, assets, responsive layout, accessibility | Frontend developer. |
| Navigation labels, buttons, ordinary copy | Frontend developer; preserve financial meaning and truthful status labels. |
| Charts and comparison visuals | Frontend developer renders typed results; no new financial formulas. |
| supabase/, migrations, RLS, Edge Functions, seed/test SQL | Backend owner only. |
| src/types/, src/services/, src/lib/, future engine modules | Backend owner; contract and calculation changes require coordination. |
| AuthProvider, auth-context, useBrowserAuth, useLiveSession | Backend owner; do not replace real identities with UI state. |
| Questionnaire catalog/validation, agreement validation, financial/demo result fixtures | Backend owner; UI may present these values without changing their semantics. |
| App.tsx, AppLayout.tsx, SessionPage.tsx, questionnaire/simulator/agreement pages | Shared: frontend owns presentation, backend owns data flow/auth. Coordinate behavior/routing changes. |
| package.json/lockfile, Vite/TypeScript/Playwright config, architecture docs | Shared; coordinate before modifying. |

No whole-src copy, mass reformat, or automatic conflict resolution across these
branches. App.tsx, AppLayout.tsx, SessionPage.tsx, LandingPage.tsx, and UI tests
already differ in backend/fsm-core; keep UI changes focused so those differences
can be reconciled manually during review.

## First frontend checkout

The owner must first approve publication of main and frontend/fsm-ux, and add
the second developer as a repository collaborator. Until then these commands
describe the future handoff; the remote branches may not exist yet.

```powershell
git clone https://github.com/anuarmariyam/FirstSharedMoney.git
Set-Location FirstSharedMoney
git switch --track origin/frontend/fsm-ux
npm.cmd ci
npm.cmd run dev
```

Run these from the second developer's chosen parent directory on D. Clone only
once; do not clone inside the owner's existing FirstSharedMoney checkout.
The Phase 3 UI and Demo need no Supabase credentials. Never copy the owner's
.env.local, .env.security.local, Edge environment file, certificate cache, Auth
storage, or CLI credentials to the second developer.

Before requesting review, run the branch's typecheck, lint, build, and test:ui
scripts. Report skipped checks honestly. Keep screenshots free of real data.
No cloud testing or live financial data is part of the frontend handoff.

## Review controls

.github/CODEOWNERS names the repository owner for backend-sensitive paths.
This is a review definition, not a write-access control. GitHub evaluates the
CODEOWNERS file on a pull request's base branch. Because main is deliberately
unchanged, this new file does not yet enforce reviews for PRs targeting main.

After an explicitly approved documentation PR places these rules on main,
configure available repository rules to require pull requests and owner review,
and prevent force pushes to main. Account/plan availability and actual repository
settings must be checked; no protection has been enabled by this local work.
See the official [CODEOWNERS documentation](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners).

Owner review is still required operationally until repository rules are active.
A private repository does not make checked-in secrets safe to share.

## Current backend boundary

The existing Supabase test project is linked. After read-only setup, the owner
explicitly authorized Phase 4A migrations, fsm-api, and targeted security/live
tests in lgboxbtxutgggvluhhqt. Phase 4B's three additional migrations, fsm-api
update, and questionnaire tests were separately approved and verified with
test-data cleanup; see PHASE4A_VERIFICATION.md and PHASE4B_VERIFICATION.md.
This authorization does not cover another project, Phase 5, production website
deployment, or an additional Git push/merge.
