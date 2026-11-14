# Three-Developer Workflow

## Baseline and branch purpose

Stable main remains Phase 3 commit 590a234. The reviewed stable backend milestone
is Phase 5 commit 3063cd4, with historical 111/111 passing cases and cloud evidence
in PHASE5.md. The current review reran only the 13 targeted engine/contract cases;
it did not repeat mutating cloud tests. This handoff changes documentation only.

| Branch | Owner | Contents |
| --- | --- | --- |
| main | Project owner | Accepted Phase 3 only; remains at 590a234 until an approved change. |
| backend/fsm-core | Project owner / backend developer | Phase 5 milestone 3063cd4 plus handoff/Qwen brief; normal publication now authorized. |
| frontend/fsm-ux | Member 2 | Remote 9a640e5: stable main plus old collaboration instructions; no new UI commits observed. |
| feature/fsm-insights | Member 3 | Same updated handoff base, descendant of 3063cd4; normal publication now authorized. Never start it from old main. |

The repository remote is https://github.com/anuarmariyam/FirstSharedMoney.git.
main and frontend/fsm-ux were pushed earlier with explicit owner approval. The
owner now separately authorized normal push of backend/fsm-core and
feature/fsm-insights after updating the Qwen assignment and auditing secrets.
Check remote refs to confirm actual publication. No --all, --tags, main/frontend
push, force push, merge, rebase or website deployment is authorized.
Do not force-push or merge either work branch automatically.

## Responsibility boundaries

| Area | Responsibility / rule |
| --- | --- |
| Presentation components, styles, assets, responsive layout, accessibility | Frontend developer. |
| Navigation labels, buttons, ordinary copy | Frontend developer; preserve financial meaning and truthful status labels. |
| Charts and comparison visuals | Frontend developer renders typed results; no new financial formulas. |
| supabase/, migrations, RLS, Edge Functions, seed/test SQL | Backend owner only. |
| src/types/, src/services/, src/lib/, src/engines/ | Backend owner; existing engines must not be duplicated or rewritten. |
| src/app/, src/hooks/ including AuthProvider, useQuestionnaire and useSharedResource | Backend owner; preserve identity, saving, revisions and consent gates. |
| New src/features/insights/, tests/insights/, docs/insights/ | Member 3's isolated planned-spending interpretation, public-source research and fictional-data Qwen/Groq PoC; no API/UI/auth/engine changes. |
| Questionnaire catalog/validation, agreement validation, financial/demo result fixtures | Backend owner; UI may present these values without changing their semantics. |
| App.tsx, AppLayout.tsx, SessionPage.tsx, questionnaire/simulator/agreement pages, QuestionField.tsx | Shared: coordinate targeted presentation edits first. Backend owns data flow/auth. |
| LiveSessionPage, SessionEntryPage, LiveQuestionnairePage, LiveSimulatorPage | Read-only to frontend/Insights contributors; backend integrates their pure presentation components. |
| package.json/lockfile, Vite/TypeScript/Playwright config, architecture docs | Shared; coordinate before modifying. |

Detailed independent briefs: [Member 2](TEAM_MEMBER_2_FRONTEND.md) and
[Member 3](TEAM_MEMBER_3_INSIGHTS.md). Agreement presentation is frontend work;
server approval/access and confirmed-version export remain backend work after
separately approved Phase 6. Insights/AI must not delay that core workflow.

No whole-src copy, mass reformat, or automatic conflict resolution across these
branches. App.tsx, AppLayout.tsx, SessionPage.tsx, LandingPage.tsx, and UI tests
already differ in backend/fsm-core; keep UI changes focused so those differences
can be reconciled manually during review.

## First frontend checkout

main and frontend/fsm-ux already exist remotely. The owner must grant the second
developer collaborator access. Run from that developer's own parent directory;
do not clone inside the owner's checkout. Preserve any existing unpushed work.

```powershell
git clone https://github.com/anuarmariyam/FirstSharedMoney.git
Set-Location FirstSharedMoney
git switch --track origin/frontend/fsm-ux
npm.cmd ci --cache D:\npm-cache
npm.cmd run dev
```

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

The backend base already contains CODEOWNERS locally; its published copy can
route backend-targeted PR reviews after authorization. main currently has none.
After an explicitly approved documentation PR places these rules on main,
configure available repository rules to require PRs and owner review and prevent
force pushes. Read-only protection/ruleset API calls returned 403 during this
review: enforcement is UNKNOWN, not confirmed enabled or absent. The owner must
check the repository Settings UI and plan support. This task changes no settings.
See the official [CODEOWNERS documentation](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners).

Owner review is still required operationally until repository rules are active.
A private repository does not make checked-in secrets safe to share.

## Current backend boundary

The existing Supabase test project is linked. After read-only setup, the owner
explicitly authorized Phase 4A migrations, fsm-api, and targeted security/live
tests in lgboxbtxutgggvluhhqt. Phase 4B's three additional migrations, fsm-api
update, and questionnaire tests were separately approved and verified with
test-data cleanup; see PHASE4A_VERIFICATION.md and PHASE4B_VERIFICATION.md.
Phase 5's two migrations, fsm-api v3 and test-owned fixture cleanup were separately
approved and verified; see PHASE5.md. Current authorization adds a documentation
update, normal push of the two named branches, and a Member 3 assignment for a
fictional-data-only Qwen PoC. No Phase 6, further cloud mutation, website deployment,
real-user AI analysis or automatic merge is authorized.

## Review snapshot and synchronization plan

The read-only GitHub review confirms Private visibility, default branch main,
and no open PRs. Git fetch changed no local branch. The GitHub connector returned
404 for this repository; read-only metadata was obtained using the existing Git
credential manager without logging credentials. New frontend work may still be
unpushed on a contributor's machine; ask them to preserve it and share its PR.

History scan covered 176 blobs and 8 commits reachable from backend, remote main
and remote frontend: no known local credential values or credential patterns
were found. Local environment, certificates/caches, dependencies and artifacts
remain ignored. This is a pattern/known-value audit, not a guarantee against
every possible obfuscated secret. Repeat it for any new commits before publication.

The current Phase 5 review found no blocking calculation or privacy regression.
BigInt largest-remainder allocation conserves monthly and one-off cents separately;
zero-income proportional is explicitly unavailable; stress transforms do not
mutate answers or double-count reserves. Raw answers stay owner-only. Shared
comparison and numeric results have independent server consent/revision gates.
Known nonblocking issues: obsolete technical/demo copy for Member 2 to simplify,
an existing 501.79 kB build entry advisory, and future agreement/export not yet built.

### Backend publication and member 3 base

Keep milestone/phase5 as a local immutable tag of 3063cd4; its publication is not
authorized. The owner approved normal publication of backend/fsm-core and
feature/fsm-insights with the updated Qwen brief. Preserve all existing history
and independently verify the exact remote tips after push. No branch publication
merges anything into main. Only these two branch pushes are in scope:

```powershell
git push --set-upstream origin backend/fsm-core
git push --set-upstream origin feature/fsm-insights
```

The owner's existing checkout stays on backend/fsm-core. Use `git fetch origin`
and `git switch backend/fsm-core` only from a saved/clean worktree; do not pull,
merge or overwrite a contributor's changes as part of setup.

The handoff commit is documentation-only and descends from 3063cd4. Create the
local Insights branch from that handoff tip without checking it out; it receives
the real engines and these instructions, not a hand-copied contract snapshot.
After its authorized publication, Member 3 runs:

```powershell
git clone https://github.com/anuarmariyam/FirstSharedMoney.git
Set-Location FirstSharedMoney
git fetch origin
git switch --track origin/feature/fsm-insights
git merge-base --is-ancestor 3063cd4 HEAD
npm.cmd ci --cache D:\npm-cache
```

Member 2 stays on frontend/fsm-ux. Existing domain.ts/engines.ts are identical to
main; Phase 5 adds getFinancialInputs in api.ts and actual runtime implementations.
After backend publication, inspect it with git show or git diff; do not copy all
backend files or merge it into the frontend branch automatically. Send new pure
components using existing domain types, then let the owner wire the live props.
Future shared-contract changes need an owner proposal, a reviewed contract diff
and an exact agreed commit/version before either participant adopts them.

### Pull requests and conflicts

- Member 2: frontend/fsm-ux -> backend/fsm-core, after backend publication and owner coordination.
- Member 3: feature/fsm-insights -> backend/fsm-core, isolated directory allowlist.
- Backend owner: a later reviewed backend/fsm-core -> main release only after
  integrations, relevant regressions and explicit release approval.

The owner reviews all integration PRs; no automatic merge, force push, rebase of
shared history or whole-directory replacement. A draft PR is appropriate for
early review. Keep CSS/pure components separate from container changes; annotate
the baseline and test results, keep diffs small and avoid global formatting.

A three-file merge probe against current remote frontend found add/add text
conflicts in .github/CODEOWNERS, AGENTS.md and docs/COLLABORATION.md. The PR
template is identical. No UI implementation overlap is present in that remote
branch today. This is conflict analysis only: no merge commit, index update or
branch rewrite occurred. Future edits to AppLayout, landing, questionnaire,
Differences/Simulator pages and QuestionField are likely integration hotspots.
Preserve the three-member policy and backend safety behavior when manually
resolving a later approved integration; do not take an entire old file as a fix.
