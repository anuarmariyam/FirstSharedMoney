# Supabase Preflight Record

Historical read-only setup record from 2026-11-14, before cloud-write approval.
The owner later authorized the four migrations, fsm-api deployment, and targeted
tests. All are now complete; see PHASE4A_VERIFICATION.md for current results.

## Confirmed target

- Existing project: FirstSharedMoney (FSM), reference lgboxbtxutgggvluhhqt.
- Frontend URL, security-test URL, project reference, Edge publishable key, and
  pooler username/host identify the same project. No key/password is recorded here.
- CLI account access works and the local checkout is linked to this project.
- CLI identifies its main branch as production. This is the owner's newly
  created FSM test project; no website deployment is involved.

## Read-only inventory and migration preview

The inventory ran through CLI db query --remote --read-only, using the Management
API's enforced read-only mode. Before the dry-run it reported:

- Application tables/views: none.
- Auth users: 0. Storage objects: 0.
- couples/partners tables and migration history: absent.
- pgcrypto: installed in extensions, matching the migrations' qualified calls.

db push --remote --dry-run --skip-vault completed successfully and listed exactly:

1. 20261114000100_session_tables.sql
2. 20261114000200_session_indexes.sql
3. 20261114000300_session_rls.sql
4. 20261114000400_session_rpcs.sql

No migration or seed was applied. The inventory SQL now emits one combined
result set because CLI JSON output retains only the final SQL statement's rows.

## Direct PostgreSQL test connection

The initial driver connection rejected an untrusted certificate chain. A public
Supabase root CA was downloaded using the URL template from the official
[Studio configuration](https://github.com/supabase/supabase/blob/master/apps/studio/hooks/custom-content/custom-content.json).
It is stored only in node_modules/.cache/certificates on D; its path is configured
in ignored .env.security.local. No OS trust store or system setting was changed.

CA SHA-256 fingerprint:
80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA

Certificate/hostname verification remains enabled. The next attempt passed TLS
but PostgreSQL rejected authentication with SQLSTATE 28P01. A local check then
confirmed that the password portion still contains a template placeholder.
The owner subsequently replaced it locally. A new connection successfully
authenticated with verified TLS. A READ ONLY transaction confirmed the same
empty application/Auth/Storage inventory and was rolled back. The frontend URL,
security-test URL, local CLI link, and database target all match the existing
project reference. No password or full connection URL was printed.

## Next steps identified at preflight (subsequently completed)

1. Completed: owner corrected the database password locally.
2. Completed: verified-TLS connection and READ ONLY check succeeded.
3. Pending: explicit confirmation for the four cloud migrations, fsm-api deployment,
   and targeted test fixture creation/cleanup in this test project.
4. Only after approval, apply migrations and configure/deploy the single function.
5. Run real security/live tests and final checks. RLS is not verified by this
   read-only preflight or by the previously passing unit/UI tests.
