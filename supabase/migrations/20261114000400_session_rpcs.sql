begin;

create function fsm_private.require_actor()
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null or not exists (select 1 from auth.users where id = v_actor) then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;
  return v_actor;
end;
$$;

create function fsm_private.normalized_name(p_name text, p_slot text)
returns text language plpgsql immutable set search_path = '' as $$
declare v_name text := nullif(btrim(p_name), '');
begin
  if v_name is null then return 'Partner ' || p_slot; end if;
  if char_length(v_name) > 40 or v_name ~ '[[:cntrl:]]' then
    raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
  end if;
  return v_name;
end;
$$;

create function fsm_private.require_member(p_couple_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_partner uuid;
begin
  perform fsm_private.require_actor();
  select p.id into v_partner from public.partners p join public.couples c on c.id = p.couple_id
  where c.id = p_couple_id and p.auth_user_id = auth.uid() and p.revoked_at is null
    and c.expires_at > clock_timestamp() and p.access_expires_at > clock_timestamp();
  if v_partner is null then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  return v_partner;
end;
$$;

create function fsm_private.session_payload(p_couple_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_partner uuid; v_result jsonb;
begin
  v_partner := fsm_private.require_member(p_couple_id);
  select jsonb_build_object(
    'id', c.id, 'mode', c.mode, 'currency', c.currency,
    'questionnaireVersion', c.questionnaire_version, 'viewerPartnerId', v_partner,
    'createdAt', c.created_at, 'expiresAt', c.expires_at,
    'currentAgreementVersionId', c.current_agreement_version_id,
    'stage', case when (select count(*) from public.partners p where p.couple_id = c.id) < 2
      then 'waiting_for_partner'
      when (select count(*) from public.partners p where p.couple_id = c.id
        and p.questionnaire_status = 'submitted' and p.budget_consent_at is not null
        and p.revoked_at is null and p.access_expires_at > clock_timestamp()) = 2
      then 'ready_for_shared_planning' else 'questionnaires_in_progress' end,
    'partners', (select jsonb_agg(jsonb_build_object(
      'id', p.id, 'coupleId', p.couple_id, 'slot', p.slot, 'displayName', p.display_name,
      'questionnaireStatus', p.questionnaire_status, 'joinedAt', p.joined_at
    ) order by p.slot) from public.partners p where p.couple_id = c.id)
  ) into v_result from public.couples c where c.id = p_couple_id and c.expires_at > clock_timestamp();
  if v_result is null then raise exception using errcode = 'P0001', message = 'NOT_FOUND'; end if;
  return v_result;
end;
$$;

create function fsm_private.mint_invitation(p_couple_id uuid, p_partner_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_token text; v_now timestamptz := clock_timestamp(); v_expiry timestamptz;
begin
  select least(c.expires_at, v_now + interval '24 hours') into v_expiry
    from public.couples c join public.partners p on p.couple_id = c.id
    where c.id = p_couple_id and p.id = p_partner_id and p.slot = 'A'
      and p.auth_user_id = auth.uid() and p.revoked_at is null
      and p.access_expires_at > v_now and c.expires_at > v_now;
  if v_expiry is null then raise exception using errcode = 'P0001', message = 'NOT_FOUND'; end if;
  v_token := rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
  insert into fsm_private.session_invitations(couple_id, created_by_partner_id, token_hash, created_at, expires_at)
    values (p_couple_id, p_partner_id, encode(extensions.digest(v_token, 'sha256'), 'hex'), v_now, v_expiry);
  return jsonb_build_object('token', v_token, 'expiresAt', v_expiry);
end;
$$;

create function fsm_private.guard_partner()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_expiry timestamptz;
begin
  if tg_op = 'UPDATE' then
    if (new.id, new.couple_id, new.auth_user_id, new.slot, new.joined_at) is distinct from
      (old.id, old.couple_id, old.auth_user_id, old.slot, old.joined_at) then
      raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
    end if;
  end if;
  select expires_at into v_expiry from public.couples where id = new.couple_id;
  if v_expiry is null or new.access_expires_at > v_expiry then
    raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
  end if;
  return new;
end;
$$;
create trigger partners_guard before insert or update on public.partners
  for each row execute function fsm_private.guard_partner();

create function fsm_private.guard_couple_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_owner uuid;
begin
  if tg_table_name = 'couples' then v_id := new.id;
  elsif tg_op = 'DELETE' then v_id := old.couple_id;
  else v_id := new.couple_id; end if;
  select created_by_auth_user_id into v_owner from public.couples where id = v_id;
  if found and not exists (select 1 from public.partners
    where couple_id = v_id and slot = 'A' and auth_user_id = v_owner) then
    raise exception using errcode = 'P0001', message = 'INVALID_STATE';
  end if;
  return null;
end;
$$;
create constraint trigger couple_requires_owner after insert or update on public.couples
  deferrable initially deferred for each row execute function fsm_private.guard_couple_owner();
create constraint trigger partner_requires_owner after insert or update or delete on public.partners
  deferrable initially deferred for each row execute function fsm_private.guard_couple_owner();

create function fsm_private.guard_invitation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.couples c join public.partners p on p.couple_id = c.id
    where c.id = new.couple_id and p.id = new.created_by_partner_id and p.slot = 'A'
      and new.expires_at <= c.expires_at) then
    raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
  end if;
  if new.consumed_by_partner_id is not null and not exists (
    select 1 from public.partners where id = new.consumed_by_partner_id
      and couple_id = new.couple_id and slot = 'B'
  ) then raise exception using errcode = 'P0001', message = 'INVALID_INPUT'; end if;
  return new;
end;
$$;
create trigger invitations_guard before insert or update on fsm_private.session_invitations
  for each row execute function fsm_private.guard_invitation();

create function public.fsm_get_session(p_couple_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin return fsm_private.session_payload(p_couple_id); end;
$$;

create function public.fsm_create_session(p_request_id uuid, p_display_name text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := fsm_private.require_actor();
  v_name text := fsm_private.normalized_name(p_display_name, 'A');
  v_fingerprint text; v_couple public.couples%rowtype;
  v_partner uuid; v_invite jsonb; v_now timestamptz;
begin
  if p_request_id is null then raise exception using errcode = 'P0001', message = 'INVALID_INPUT'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_actor::text, 781543));
  v_fingerprint := encode(extensions.digest(jsonb_build_object('mode', 'standard', 'displayName', v_name)::text, 'sha256'), 'hex');
  select * into v_couple from public.couples where created_by_auth_user_id = v_actor and creation_request_id = p_request_id;
  if found then
    if v_couple.creation_request_fingerprint <> v_fingerprint then
      raise exception using errcode = 'P0001', message = 'REQUEST_ID_REUSED';
    end if;
    return jsonb_build_object('session', fsm_private.session_payload(v_couple.id), 'invitation', null);
  end if;
  if (select count(*) from public.couples where created_by_auth_user_id = v_actor
    and created_at > clock_timestamp() - interval '1 hour') >= 5 then
    raise exception using errcode = 'P0001', message = 'RATE_LIMITED';
  end if;
  v_now := clock_timestamp();
  insert into public.couples(created_by_auth_user_id, creation_request_id, creation_request_fingerprint, created_at, expires_at)
    values(v_actor, p_request_id, v_fingerprint, v_now, v_now + interval '30 days') returning * into v_couple;
  insert into public.partners(couple_id, auth_user_id, slot, display_name, access_expires_at)
    values(v_couple.id, v_actor, 'A', v_name, v_couple.expires_at) returning id into v_partner;
  v_invite := fsm_private.mint_invitation(v_couple.id, v_partner);
  return jsonb_build_object('session', fsm_private.session_payload(v_couple.id), 'invitation', v_invite);
end;
$$;

create function public.fsm_rotate_invitation(p_couple_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_partner uuid; v_slot text;
begin
  perform fsm_private.require_member(p_couple_id);
  perform 1 from public.couples where id = p_couple_id for update;
  -- Evaluate the real clock again after a potentially blocking lock.
  v_partner := fsm_private.require_member(p_couple_id);
  select slot into v_slot from public.partners where id = v_partner;
  if v_slot <> 'A' then raise exception using errcode = 'P0001', message = 'FORBIDDEN'; end if;
  if exists (select 1 from public.partners where couple_id = p_couple_id and slot = 'B') then
    raise exception using errcode = 'P0001', message = 'SESSION_FULL';
  end if;
  update fsm_private.session_invitations set revoked_at = clock_timestamp()
    where couple_id = p_couple_id and consumed_at is null and revoked_at is null;
  return fsm_private.mint_invitation(p_couple_id, v_partner);
end;
$$;

create function public.fsm_redeem_invitation(p_token text, p_display_name text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := fsm_private.require_actor(); v_name text := fsm_private.normalized_name(p_display_name, 'B');
  v_hash text; v_couple uuid; v_invite fsm_private.session_invitations%rowtype;
  v_partner uuid; v_existing public.partners%rowtype; v_expiry timestamptz; v_now timestamptz;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then
    raise exception using errcode = 'P0001', message = 'INVALID_INVITATION';
  end if;
  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');
  select couple_id into v_couple from fsm_private.session_invitations where token_hash = v_hash;
  if v_couple is null then raise exception using errcode = 'P0001', message = 'INVALID_INVITATION'; end if;
  select expires_at into v_expiry from public.couples where id = v_couple for update;
  if not found then raise exception using errcode = 'P0001', message = 'INVALID_INVITATION'; end if;
  select * into v_invite from fsm_private.session_invitations where token_hash = v_hash for update;
  v_now := clock_timestamp();
  if not found or v_invite.revoked_at is not null or v_invite.expires_at <= v_now or v_expiry <= v_now
    or not exists (select 1 from public.partners where couple_id = v_couple and slot = 'A'
      and revoked_at is null and access_expires_at > v_now) then
    raise exception using errcode = 'P0001', message = 'INVALID_INVITATION';
  end if;
  select * into v_existing from public.partners where couple_id = v_couple and auth_user_id = v_actor;
  if found then
    if v_existing.slot = 'A' then raise exception using errcode = 'P0001', message = 'IDENTITY_ALREADY_JOINED'; end if;
    if v_invite.consumed_by_partner_id = v_existing.id and v_existing.revoked_at is null and v_existing.access_expires_at > v_now then
      return jsonb_build_object('session', fsm_private.session_payload(v_couple), 'partner',
        jsonb_build_object('id', v_existing.id, 'coupleId', v_couple, 'slot', 'B', 'displayName', v_existing.display_name,
          'questionnaireStatus', v_existing.questionnaire_status, 'joinedAt', v_existing.joined_at));
    end if;
    raise exception using errcode = 'P0001', message = 'INVALID_INVITATION';
  end if;
  if v_invite.consumed_at is not null or exists (select 1 from public.partners where couple_id = v_couple and slot = 'B') then
    raise exception using errcode = 'P0001', message = 'INVALID_INVITATION';
  end if;
  insert into public.partners(couple_id, auth_user_id, slot, display_name, access_expires_at)
    values(v_couple, v_actor, 'B', v_name, v_expiry) returning id into v_partner;
  update fsm_private.session_invitations set consumed_at = clock_timestamp(), consumed_by_partner_id = v_partner where id = v_invite.id;
  return jsonb_build_object('session', fsm_private.session_payload(v_couple), 'partner',
    (select jsonb_build_object('id', p.id, 'coupleId', p.couple_id, 'slot', p.slot, 'displayName', p.display_name,
      'questionnaireStatus', p.questionnaire_status, 'joinedAt', p.joined_at) from public.partners p where p.id = v_partner));
end;
$$;

-- Explicit grants remain necessary even if project defaults were changed.
revoke all on all functions in schema fsm_private from public, anon, authenticated;
grant execute on function fsm_private.is_active_member(uuid) to authenticated;
revoke all on function public.fsm_get_session(uuid) from public, anon, authenticated;
revoke all on function public.fsm_create_session(uuid, text) from public, anon, authenticated;
revoke all on function public.fsm_rotate_invitation(uuid) from public, anon, authenticated;
revoke all on function public.fsm_redeem_invitation(text, text) from public, anon, authenticated;
grant execute on function public.fsm_get_session(uuid) to authenticated;
grant execute on function public.fsm_create_session(uuid, text) to authenticated;
grant execute on function public.fsm_rotate_invitation(uuid) to authenticated;
grant execute on function public.fsm_redeem_invitation(text, text) to authenticated;

commit;
