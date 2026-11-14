-- Intentionally no fixed Auth users, credentials, live couples, or invitations.
-- The cloud security suite creates real anonymous users and ephemeral fixtures,
-- then removes only records it created. Do not seed reusable access tokens.
select 'FSM Phase 4A: test fixtures are created by the security suite.' as seed_policy;
