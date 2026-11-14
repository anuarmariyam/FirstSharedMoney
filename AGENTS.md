# FirstSharedMoney collaboration rules

Read docs/COLLABORATION.md before editing. Code, UI copy, and documentation are
English; explanations to the project owner are Russian.

## Branches and ownership

- main contains the accepted Phase 3 baseline. Do not put unfinished backend
  work or frontend redesign into main. Use reviewable pull requests.
- backend/fsm-core belongs to the backend owner. Phase 4A is the current scope;
  Phase 4B is not authorized.
- frontend/fsm-ux starts from the stable main baseline and belongs to the UI/UX
  developer. Improve presentation, navigation, accessibility, responsive styles,
  and visualization of supplied results.
- On frontend/fsm-ux, do not change supabase/, scripts/, src/types/, src/services/,
  src/lib/, authentication/session hooks, questionnaire catalogs/validation,
  agreement validation, demo calculation/result fixtures, or financial/conflict/
  agreement engines without prior coordination with the backend owner.
- Frontend work must not implement authentication, persistence, authorization,
  approval rules, or financial calculations. Render the existing typed data and
  keep demo data visibly labeled Demo or Sample Data.
- App.tsx, AppLayout.tsx, SessionPage.tsx, and questionnaire/simulator/agreement
  pages are shared integration files: coordinate behavioral/routing changes.
  Do not replace whole files or folders to resolve cross-branch differences.
- Coordinate dependency, lockfile, tooling, API-contract, and architecture changes.

## Preservation and release

Never discard another contributor's changes. No automatic merge, reset, force
push, or remote publication. Git push requires the owner's explicit approval.
Never commit local .env files, credentials, build output, test artifacts, or
Supabase CLI caches. Only blank environment examples belong in Git.

The owner authorized Phase 4A's four migrations, single fsm-api deployment, and
test-owned fixture creation/cleanup only in lgboxbtxutgggvluhhqt. These completed
successfully; see docs/PHASE4A_VERIFICATION.md. Additional cloud work must remain
within explicit owner authorization; Phase 4B is not authorized.
Never disable JWT verification, RLS, or TLS verification.
Do not collect real financial data before security verification is complete.

Do not move active VS Code/Codex storage or alter system PATH/TEMP/TMP. Keep
project dependencies and new project caches on D where possible.
