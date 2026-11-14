# FirstSharedMoney collaboration rules

Read docs/COLLABORATION.md before editing. Code, UI copy, and documentation are
English; explanations to the project owner are Russian.

## Branches and ownership

- main contains the accepted Phase 3 baseline. Do not put unfinished backend
  work or frontend redesign into main. Use reviewable pull requests.
- backend/fsm-core belongs to the backend owner. Phases 4A, 4B, 5 and 6 are verified.
  Phase 6 has no AI. Further development/cloud scope requires owner approval.
- frontend/fsm-ux starts from the stable main baseline and belongs to the UI/UX
  developer. Improve presentation, navigation, accessibility, responsive styles,
  and visualization of supplied results.
- feature/fsm-insights is prepared from the Phase 5 handoff (descendant of
  3063cd4), not old main. Member 3 owns only new src/features/insights/,
  tests/insights/ and docs/insights/ files, including a fictional-data Qwen/Groq
  PoC under tests/insights/qwen-poc/. Keep engines, auth, API and UI unchanged.
- Read docs/TEAM_MEMBER_2_FRONTEND.md or docs/TEAM_MEMBER_3_INSIGHTS.md for the
  exact contributor boundary. The current owner task implements Phase 6 agreement
  and PDF backend/integration only, with no AI or contributor-branch changes.
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

Never discard another contributor's changes. No automatic merge, reset, force
push, or remote publication. Git push requires the owner's explicit approval.
The prior handoff publication completed at 4c43ad5. Phase 6 does not authorize
another push, merge, tag/release or production deployment. The separately approved
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
