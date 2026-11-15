# FirstSharedMoney collaboration rules

Read docs/COLLABORATION.md before editing. Code, UI copy, and documentation are
English; explanations to the project owner are Russian.

## Branches and ownership

- main is the owner-approved integrated release baseline after the authorized
  fast-forward promotion. Preserve the full Phase 6 and consumer UI history.
  Further work uses reviewed changes, not whole-folder replacement.
- backend/fsm-core belongs to the backend owner. Phases 1-6 are complete in the
  verified test-project scope (143 checks at Phase 6). No production website or
  main-app AI/Qwen integration exists. Further feature/cloud scope needs approval.
- frontend/fsm-ux starts from the stable main baseline and belongs to the UI/UX
  developer. Improve presentation, navigation, accessibility, responsive styles,
  and visualization of supplied results.
- feature/fsm-insights is prepared from the Phase 5 handoff (descendant of
  3063cd4), not old main. Member 3 owns only new src/features/insights/,
  tests/insights/ and docs/insights/ files, including a fictional-data Qwen/Groq
  PoC under tests/insights/qwen-poc/. Keep engines, auth, API and UI unchanged.
- Read docs/TEAM_MEMBER_2_FRONTEND.md or docs/TEAM_MEMBER_3_INSIGHTS.md for the
  exact contributor boundary. The current owner task audits GitHub and updates
  documentation only; it adds no features, cloud changes or contributor-branch edits.
- On frontend/fsm-ux, do not change supabase/, scripts/, src/types/, src/services/,
  src/lib/, authentication/session hooks, questionnaire catalogs/validation,
  agreement validation, demo calculation/result fixtures, or financial/conflict/
  agreement engines without prior coordination with the backend owner.
- Frontend work must not implement authentication, persistence, authorization,
  approval rules, or financial calculations. Render the existing typed data and
  keep demo data visibly labeled Demo or Sample Data.
- App.tsx, AppLayout.tsx, SessionPage.tsx, and questionnaire/simulator/agreement
  pages and QuestionField.tsx are shared integration files: coordinate edits.
  Do not replace whole files or folders to resolve cross-branch differences.
- Live session/questionnaire/simulator containers are backend-owned integration;
  frontend contributors supply pure presentation components. PDF layout does
  not authorize server approval logic or export of a confirmed version.
- Coordinate dependency, lockfile, tooling, API-contract, and architecture changes.

## Preservation and release

Current owner approval supersedes older publication restrictions below: normal
fast-forward promotion integration -> backend/fsm-core -> main and ordinary push
of backend/main are authorized after clean-tree/test/secret checks. Existing Hobby
Vercel publication is authorized, but requires local account login. Do not change
repository visibility. Exact-origin Supabase CORS secrets or Edge deployment still
require a separate explicit approval. Never deploy the unapproved local Insights
endpoint while adjusting CORS. No real-user external AI processing is authorized.


Never discard another contributor's changes. No automatic merge, reset, force
push, or remote publication. Git push requires the owner's explicit approval.
The prior handoff publication completed at 4c43ad5. The owner separately approved
and completed the normal fast-forward push of exactly 1aaeb3a to backend/fsm-core
after a clean-tree/private-repository/history audit. A subsequent audit/docs commit
must remain local until another explicit approval. No merge, tags, release,
workflow/issue creation or deployment is authorized. The separately approved
test-only migrations/fsm-api v4 and fixture cleanup completed. Do not modify the frontend or
Insights branch. Preserve the contributors' presentation and isolated module boundaries.
Never commit local .env files, credentials, build output, test artifacts, or
Supabase CLI caches. Only blank environment examples belong in Git.

The owner authorized Phase 4A's four migrations, single fsm-api deployment, and
test-owned fixture creation/cleanup only in lgboxbtxutgggvluhhqt. These completed
successfully; see docs/PHASE4A_VERIFICATION.md. Additional cloud work must remain
within explicit owner authorization. The owner separately approved Phase 4B's
three migrations, fsm-api update, and test-owned fixture creation/cleanup in that
same project; these passed. See docs/PHASE4B_VERIFICATION.md.
The owner separately approved Phase 5's two migrations, fsm-api v3 deployment,
and test-owned fixture creation/cleanup after dry-run; these passed. See
docs/PHASE5.md. The owner separately approved the two Phase 6 migrations,
fsm-api update and test-owned fixture creation/cleanup after dry-run; these
passed. See docs/PHASE6.md. Do not infer authorization for further cloud changes.
Never disable JWT verification, RLS, or TLS verification.
Member 3's P1 AI PoC uses fictional fixtures and a server/local-only Groq key.
Never use VITE_GROQ_API_KEY, send real-user finances to AI, or upgrade to paid
services without approval. This does not authorize an AI feature in fsm-api.
Do not collect real financial data before security verification is complete.

Do not move active VS Code/Codex storage or alter system PATH/TEMP/TMP. Keep
project dependencies and new project caches on D where possible.
