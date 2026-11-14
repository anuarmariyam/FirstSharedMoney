# Supabase Test Project Setup

The existing FSM test project is configured and verified. The owner approved the
four migrations, single fsm-api deployment, and targeted security/live tests;
all completed successfully. See PHASE4A_VERIFICATION.md for results. The commands
below are a setup reference, not instructions to recreate the project, overwrite
configured environment files, or repeat applied migrations unnecessarily.
Do not send database passwords, personal access tokens,
server secrets, or service_role keys through chat.

## 1. Create a separate test project

Use the existing FSM project in the [Supabase Dashboard](https://supabase.com/dashboard).
Do not create another project. Confirm that it is dedicated to testing and
contains no valuable records before approving cloud changes.
Save its database password privately. Record the actual project reference,
Project URL, and publishable API key from the project's connection/API settings.
The checked-in environment templates intentionally contain no invented values.

In Authentication / Sign In / Providers, enable anonymous sign-ins and allow
new users. A Supabase anonymous identity requires no email/password form, but
browser-session loss has no automatic recovery in this MVP. See
[Anonymous Sign-Ins](https://supabase.com/docs/guides/auth/auth-anonymous).

Use this project only for controlled testing. The automated Auth clients do
not solve CAPTCHA challenges; if CAPTCHA is required, those tests will fail
rather than bypass it. Public release still needs CAPTCHA integration and
appropriate Auth/request-rate controls. No public release is authorized here.

Keep fsm_private out of the Data API's exposed schemas. The config.toml file
describes intended settings; pushing SQL migrations does not automatically
configure hosted Auth settings or API exposure.

## 2. Apply migrations to the acknowledged test project

From PowerShell in D:\FirstSharedMoney, use the official CLI through npx. Do not
run supabase start: no Docker or local PostgreSQL is needed for these cloud steps.

```powershell
Set-Location D:\FirstSharedMoney
$env:NPM_CONFIG_CACHE = 'D:\FirstSharedMoney\node_modules\.cache\npm'
$env:TEMP = 'D:\FirstSharedMoney\node_modules\.cache\cli-tmp'
$env:TMP = $env:TEMP
New-Item -ItemType Directory -Force -Path $env:TEMP | Out-Null
$projectRef = Read-Host 'Actual disposable Supabase project reference'
npx.cmd --yes supabase@3.1.0 login
npx.cmd --yes supabase@3.1.0 link --project-ref $projectRef
npx.cmd --yes supabase@3.1.0 db query --remote --read-only --file supabase/tests/pre_migration_inventory.sql
npx.cmd --yes supabase@3.1.0 db push --remote --dry-run --skip-vault
```

CLI 3.1.0 defaults database commands to local; --remote is required here.
Review the linked project, inventory, and four migration filenames. If existing
application objects or valuable Auth/Storage records are present, stop for review.
Obtain the user's one confirmation for the first migration application and the
single test Edge Function deployment before running either mutation. Then apply:

```powershell
npx.cmd --yes supabase@3.1.0 db push --remote --skip-vault
```

The CLI may prompt for your database password. Enter it locally, never in a
committed file or a command-line password flag. These commands are for you to
execute after creating the project; Codex has not linked or modified any account.

| Migration                          | Scope                                                                                |
| ---------------------------------- | ------------------------------------------------------------------------------------ |
| 20261114000100_session_tables.sql  | couples, partners, private invitations; constraints; closed initial access           |
| 20261114000200_session_indexes.sql | Membership, token, expiry, and quota indexes                                         |
| 20261114000300_session_rls.sql     | Helper, owner/member SELECT policies, column grants, no browser writes               |
| 20261114000400_session_rpcs.sql    | Transactional session/invitation RPCs, integrity triggers, explicit execution grants |

Do not manually paste the same migrations and later push them with the CLI
without reconciling migration history. If you choose SQL Editor instead of the
CLI, execute the four files in order and record that separate application path.
No application seed is needed: seed.sql deliberately inserts no users or tokens.

## 3. Configure and deploy only the test Edge Function

Copy supabase/functions/.env.example to the ignored
supabase/functions/.env.local. Fill in the actual publishable key. Set exact
origins for the local app and isolated live browser test:

```text
FSM_SUPABASE_PUBLISHABLE_KEY=<actual publishable key entered locally>
FSM_ALLOWED_ORIGINS=http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:5175
```

SUPABASE_URL is supplied by the hosted runtime. Phase 4A needs no elevated
server key: the Edge Function verifies the user and forwards that user's JWT to
the guarded RPCs. Set the values and deploy this single function:

```powershell
npx.cmd --yes supabase@3.1.0 secrets set --env-file supabase/functions/.env.local --remote=$projectRef
npx.cmd --yes supabase@3.1.0 functions deploy fsm-api --remote=$projectRef --use-api
```

Keep verify_jwt enabled. Do not use --no-verify-jwt to work around an error.
Deployment via --use-api does not require Docker; see the official
[Edge quickstart](https://supabase.com/docs/guides/functions/quickstart).
The function's deno.json pins the same SDK release as the frontend.

This test-function deployment is separate from publishing the website. Only
fsm-api was deployed in this phase; no Vercel site was published.

## 4. Connect the local frontend

Copy root .env.example to root .env.local and enter only the actual values:

```text
VITE_SUPABASE_URL=<actual HTTPS project URL entered locally>
VITE_SUPABASE_PUBLISHABLE_KEY=<actual publishable key entered locally>
```

Restart Vite with npm.cmd run dev. Open http://127.0.0.1:5173/create. Create A,
copy the invitation, and open it in a different browser profile/device for B.
Two private windows of the same private profile may share storage. Never clear
A's existing identity to fill B. Refresh each session page to exercise restore.

The new session page must show actual server-loaded membership. The remaining
financial features stay disconnected for live sessions. The /sessions/demo
workspace remains an explicitly fictional in-memory preview.

## 5. Run real security tests

Copy tests/security.env.example to ignored root .env.security.local. Enter the
actual project URL, publishable key, reference, and database connection URL from
the Dashboard Connect dialog. Set FSM_ALLOW_TEST_DATABASE_MUTATIONS=1 only for
the disposable test project. This enables targeted test fixture creation and
cleanup; it does not authorize arbitrary production changes.

For IPv4-only connections, use the exact Session pooler connection from Connect.
The test guard checks that the host/username correspond to the same project.
TLS certificate verification remains enabled. If a project CA is necessary,
download its certificate and set FSM_TEST_DATABASE_CA_FILE to that local file;
never disable verification. See [database connection and TLS guidance](https://supabase.com/docs/guides/database/connecting-to-postgres).

```powershell
npm.cmd run test:security
npm.cmd run test:live
```

The security suite uses real anonymous A/B/C JWTs, direct PostgREST/RPC calls,
the deployed Edge API, concurrent joins, and privileged test-only clock fixtures.
The browser test uses three new contexts and verifies identity persistence after
reload. The suites delete only couples owned by their newly created anonymous
users and then unreferenced test Auth users. They never truncate tables.
Missing project settings cause an explicit nonzero preflight failure, not a
passing or silently skipped cloud test. Trace/video/screenshot capture is disabled
for live tests so credential-bearing responses are not deliberately archived.

Optionally execute supabase/tests/session_catalog.sql in SQL Editor to inspect
RLS/grant configuration. It is a read-only catalog check, not proof of row access
isolation. Only a successful real-user security suite can support that claim.

## 6. Common setup failures

| Symptom                            | Check                                                                                  |
| ---------------------------------- | -------------------------------------------------------------------------------------- |
| Create/Join remain disabled        | Both root public configuration values must be set; restart Vite                        |
| Anonymous sign-in fails            | Hosted anonymous-sign-in settings, Auth limits, CAPTCHA requirements                   |
| Auth succeeds, API returns 404/500 | Apply all migrations; deploy fsm-api; check Edge configuration                         |
| Browser CORS rejection             | Exact frontend origin must be in FSM_ALLOWED_ORIGINS                                   |
| Valid user rejected with 401       | Verify project/key pairing and hosted JWT configuration; do not disable authentication |
| RLS/helper permission error        | Confirm all four migrations completed in order, under the expected administrative role |
| Direct DB connection times out     | Use the actual Session pooler host if the network is IPv4-only                         |
| TLS verification fails             | Configure the correct project CA certificate; do not turn verification off             |
| Lost invitation after refresh      | Generate a replacement from A; the server cannot recover a raw token                   |

After setup, provide only the project URL/reference and test results, or configure
the local ignored files directly. Secret values are not needed in chat.
