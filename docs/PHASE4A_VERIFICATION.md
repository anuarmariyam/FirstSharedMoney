# Phase 4A Verification

Status: completed against the explicitly approved FSM test project on 2026-11-14.
Project reference: lgboxbtxutgggvluhhqt. This is not a production website release.

## Applied database changes

All four migrations were applied once, in order, using Supabase CLI 3.1.0:

1. 20261114000100_session_tables.sql
2. 20261114000200_session_indexes.sql
3. 20261114000300_session_rls.sql
4. 20261114000400_session_rpcs.sql

The migration history was read back. couples, partners, and the private
session_invitations table exist with RLS enabled. All seven requested secondary
indexes and eight primary/unique constraint indexes exist. couples_member_read
and partners_owner_read exist; invitation storage has no browser read policy.
The session_catalog.sql assertions passed for authenticated/anon RPC execution
and direct table privileges. Real-user tests subsequently verified enforcement.

## Deployed Edge Function

fsm-api is ACTIVE, version 1, with verify_jwt=true. Deployment used --use-api,
without Docker, and targeted only this function in the approved project.
The function uses the publishable key and each verified caller's JWT; no
service_role runtime credential is used.

Configured origins are exactly:

- http://127.0.0.1:5173
- http://localhost:5173
- http://127.0.0.1:5175

No wildcard origin or authentication/RLS/TLS bypass was introduced.

## Executed checks

| Command | Result |
| --- | --- |
| npm.cmd run test:security | 15 real Supabase security checks passed; 0 failed. |
| npm.cmd run test:live | 1 real browser integration test passed; 0 failed. |
| npm.cmd run typecheck | Passed. |
| npm.cmd run lint | Passed. |
| npm.cmd run build | Passed. |
| npm.cmd run test:backend | 12 unit tests passed; 0 failed. These use transport mocks. |
| npm.cmd run test:ui | 27 offline UI tests passed; 0 failed. |

The 15 real security checks covered independent A/B/C Auth identities; creation
and stored invitation hash/lifetime; safe create retries; A taking B's slot;
forged identities/direct writes; A-only rotation; invalid/revoked invitations;
B join/idempotent retry; third-seat/replay denial; real PostgREST RLS isolation;
API-key-only denial; actual Edge JWT/object/body checks; database-backed expiry;
concurrent redemption; and expired membership with an otherwise valid JWT.

The live test used three empty browser contexts. A created a real session, B
joined with a different Auth user, both retained their identities after reload,
C could not reuse the invitation, and A could not become B. It ran without mocks,
automatic retries, traces, video, or screenshots containing live credentials.

## Cleanup and scope

Both cloud suites cleaned up only records belonging to users they created.
A final independent READ ONLY transaction confirmed:

| Table | Rows after tests |
| --- | --- |
| auth.users | 0 |
| public.couples | 0 |
| public.partners | 0 |
| fsm_private.session_invitations | 0 |

Database TLS verification remained enabled with the official Supabase CA stored
under the ignored project cache on D. Passwords, JWTs, invitation tokens, and
local environment contents were not logged or committed.

No application-source fix was needed: the migrations and both live suites passed
on their first execution after owner authorization. Only delivery documentation
and ignored test configuration changed locally. The frontend/fsm-ux and main
branch tips were not changed, and no Git push or merge was performed.

Phase 4B has not started. Questionnaire persistence, conflict/financial engines,
agreement versioning/approval, deletion endpoints, cleanup scheduling, CAPTCHA
UI, and production release remain outside this verified session-management slice.
