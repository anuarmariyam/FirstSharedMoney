# FirstSharedMoney (FSM)

**Two people. Different money habits. One shared plan.**

A web planning product for couples beginning their first shared financial life.
The current delivery is **Phase 3: UI Foundation & Core User Flow**.

## What works locally

- Responsive landing page, session entry screens, and a guided demo workspace.
- Client-side routes and browser back/forward navigation using React Router.
- All 15 specified questionnaire prompts, progress, Previous/Next navigation,
  exact currency input validation, single/multiple choices, slider, optional
  note, and a separate sharing-preferences screen.
- Editable in-memory questionnaire drafts and an explicit fictional-data prefill.
- Labeled static comparison examples with expandable discussion prompts.
- Equal/proportional/custom fixture views, a visual baseline comparison, editable
  simulator inputs, and stress-test control explanations.
- Editable agreement rules and a clearly unapproved draft document preview.
- Mobile navigation, visible focus styles, labels, keyboard access, and loading,
  unavailable-feature, validation-error, and empty states.

## What is not connected

There is **no Supabase connection, authentication, cloud database, invitation
redemption, server autosave, comparison engine, simulation engine, server
versioning, independent approval, payment, PDF export, or deployment**.

The demo is a frontend preview, not the future authenticated two-browser jury
demo. Use fictional information only. All local form state is held in memory
and resets on refresh. Sharing checkboxes record preview choices only.

Financial results are hand-authored fictional fixtures, not live calculations
and not results derived from the visitor's questionnaire. Editing simulator
inputs hides the primary sample result; the separately labeled baseline chart
continues to illustrate the original fixture. Stress controls explain the
future transformation without pretending to calculate it.

Live create/join/propose/approve actions are disabled with visible explanations.
No successful server response, user identity, or approval is fabricated.
An incoming invitation URL fragment is removed without attempting redemption.

## Run locally

Use Node.js satisfying the installed Vite engine range. Initialization used
Node.js 24.11.1 and npm 11.6.2. Run from the existing project directory:

```powershell
Set-Location D:\FirstSharedMoney
npm.cmd ci
npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Open http://127.0.0.1:5173/. Stop the server with Ctrl+C.
The .cmd suffix avoids PowerShell script-policy restrictions.

Project dependencies are in D:\FirstSharedMoney\node_modules.
The configured user npm cache is D:\npm-cache. When writes must stay strictly
inside the checkout, use a command-scoped cache without changing that setting:

```powershell
npm.cmd --cache .\node_modules\.cache\npm run build
```

## Routes

| Route                                 | Screen                                                           |
| ------------------------------------- | ---------------------------------------------------------------- |
| /                                     | Landing                                                          |
| /create                               | Live-session creation layout, currently unconnected              |
| /join                                 | Invitation handling layout and explicitly labeled error examples |
| /sessions/demo                        | Fictional workspace overview                                     |
| /sessions/demo/questionnaire?step=1   | Sequential 15-question form                                      |
| /sessions/demo/questionnaire/consent  | Separate preview sharing choices                                 |
| /sessions/demo/questionnaire/complete | Local completion, never server submission                        |
| /sessions/demo/differences            | Fictional comparison examples                                    |
| /sessions/demo/simulator              | Financial UI and labeled static fixtures                         |
| /sessions/demo/agreement              | Local agreement rules                                            |
| /sessions/demo/agreement/preview      | Unapproved draft document                                        |

Unknown session IDs show a not-connected state. Unknown pages show a 404 view.

## Frontend structure and integration

- src/components: shared UI, workspace layout, icons, and workflow presentation.
- src/features/questionnaire: typed catalog, form fields, and input validation.
- src/features/comparison: explicitly fictional editorial examples.
- src/features/simulator: static financial fixtures and summary presentation.
- src/features/agreement: local rule validation.
- src/app and src/hooks: in-memory preview state, separated from server identity.
- src/services/fsm-client.ts: generic typed client port using the Phase 2 API
  contract; its current implementation fails explicitly as not connected.
- src/types: unchanged Phase 2 domain, API, and engine contracts.
- src/pages: route composition and interaction state.
- tests/ui: browser interaction and responsive verification.

Phase 4 can add an authenticated client adapter and session-aware hooks while
reusing form controls, the catalog, validation, layouts, and document rendering.
Replace fixtures with validated API DTOs only when their engine/access checks
exist. The local demo provider is not an authentication or authorization layer.
Do not connect real data by simply toggling the client's connection flag.

Runtime additions: React Router for route history and lazy page composition.
Tailwind CSS and its Vite plugin provide the styling foundation. Playwright is a
development dependency for browser verification, using installed Microsoft Edge.
No chart library is needed for the small static comparisons.

## Checks

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd run test:ui
```

Strict typechecking includes the frontend, tooling, and browser tests in separate
TypeScript projects. The build output is dist/. Browser verification uses the
installed Edge channel; no browser binary download is required on this machine.
For another machine, install Edge or deliberately change the test channel.

The browser suite covers route navigation, all questionnaire steps, invalid and
exact money input, consent defaults/guards, memory reset on refresh, simulator
fixture boundaries, agreement validation, disabled live actions, fragment
removal, keyboard access, and horizontal overflow at desktop (1440), tablet
(834), and mobile (390) widths. Browser console errors fail the tests.

Screenshots are generated under artifacts/screenshots/. Test output is under
artifacts/test-results/. Both are ignored by Git. These tests verify the UI;
they do not prove RLS, server transactionality, independent approvals, or financial
engine correctness, which remain later work.

## Design documentation

- [Architecture, security, and API](docs/ARCHITECTURE.md)
- [Database schema and transaction design](docs/DATABASE_SCHEMA.md)
- [User journey and questionnaire specification](docs/USER_FLOW.md)
- [MVP scope and delivery gates](docs/MVP_SCOPE.md)

No cloud project is connected, no remote repository is configured, and no code
has been published as part of Phase 3.
