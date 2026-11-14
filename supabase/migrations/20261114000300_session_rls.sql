begin;

-- Revoke the global default, not just a schema-specific additive grant.
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema fsm_private revoke all on tables from anon, authenticated;

create function fsm_private.is_active_member(p_couple_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.partners p join public.couples c on c.id = p.couple_id
    where p.couple_id = p_couple_id and p.auth_user_id = (select auth.uid())
      and p.revoked_at is null and p.access_expires_at > clock_timestamp()
      and c.expires_at > clock_timestamp()
  );
$$;

revoke all on function fsm_private.is_active_member(uuid) from public, anon, authenticated;
grant usage on schema fsm_private to authenticated;
grant execute on function fsm_private.is_active_member(uuid) to authenticated;

grant select (id, mode, currency, questionnaire_version, current_agreement_version_id, created_at, expires_at)
  on public.couples to authenticated;
grant select on public.partners to authenticated;
create policy couples_member_read on public.couples for select to authenticated
  using (fsm_private.is_active_member(id));
create policy partners_owner_read on public.partners for select to authenticated
  using (auth_user_id = (select auth.uid()) and fsm_private.is_active_member(couple_id));

-- No invitation policies or browser table writes. All mutations use guarded RPCs.
revoke all on fsm_private.session_invitations from public, anon, authenticated;
commit;
