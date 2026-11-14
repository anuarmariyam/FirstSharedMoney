begin;
create index couples_expiry_idx on public.couples(expires_at);
create index couples_creator_time_idx on public.couples(created_by_auth_user_id, created_at desc);
create index partners_active_identity_idx on public.partners(auth_user_id, couple_id) where revoked_at is null;
create unique index invitations_one_outstanding_idx on fsm_private.session_invitations(couple_id)
  where consumed_at is null and revoked_at is null;
create index invitations_couple_time_idx on fsm_private.session_invitations(couple_id, created_at desc);
create index invitations_creator_idx on fsm_private.session_invitations(created_by_partner_id, couple_id);
create index invitations_consumer_idx on fsm_private.session_invitations(consumed_by_partner_id, couple_id)
  where consumed_by_partner_id is not null;
commit;
