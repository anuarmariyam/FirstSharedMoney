begin;

create function fsm_private.owns_partner(p_partner_id uuid, p_couple_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.partners p join public.couples c on c.id = p.couple_id
    where p.id = p_partner_id and p.couple_id = p_couple_id and p.auth_user_id = (select auth.uid())
      and p.revoked_at is null and p.access_expires_at > clock_timestamp() and c.expires_at > clock_timestamp());
$$;

create function fsm_private.valid_answer(p_version smallint, p_code text, p_value jsonb)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare q public.questions%rowtype; v_number numeric; v_keys text[];
begin
  select * into q from public.questions where catalog_version = p_version and code = p_code;
  if not found or p_value is null or jsonb_typeof(p_value) <> 'object' or octet_length(p_value::text) > 4096 then return false; end if;
  if p_value->>'kind' is distinct from q.kind then return false; end if;
  select array_agg(key order by key) into v_keys from jsonb_object_keys(p_value) key;
  case q.kind
    when 'money' then
      if v_keys <> array['cents','kind'] or jsonb_typeof(p_value->'cents') <> 'number' then return false; end if;
      v_number := (p_value->>'cents')::numeric;
      return v_number = trunc(v_number) and v_number between (q.control->>'minCents')::numeric and (q.control->>'maxCents')::numeric;
    when 'slider' then
      if v_keys <> array['basisPoints','kind'] or jsonb_typeof(p_value->'basisPoints') <> 'number' then return false; end if;
      v_number := (p_value->>'basisPoints')::numeric;
      return v_number = trunc(v_number) and v_number between (q.control->>'minBasisPoints')::numeric and (q.control->>'maxBasisPoints')::numeric
        and mod(v_number - (q.control->>'minBasisPoints')::numeric, (q.control->>'stepBasisPoints')::numeric) = 0;
    when 'single_choice' then
      return v_keys = array['kind','value'] and jsonb_typeof(p_value->'value') = 'string'
        and exists (select 1 from jsonb_array_elements(q.control->'options') opt where opt->>'value' = p_value->>'value');
    when 'multiple_choice' then
      if v_keys <> array['kind','values'] or jsonb_typeof(p_value->'values') <> 'array' then return false; end if;
      return jsonb_array_length(p_value->'values') between 1 and jsonb_array_length(q.control->'options')
        and (select count(*) = count(distinct val) from jsonb_array_elements(p_value->'values') val)
        and not exists (select 1 from jsonb_array_elements(p_value->'values') val where jsonb_typeof(val) <> 'string'
          or not exists (select 1 from jsonb_array_elements(q.control->'options') opt where to_jsonb(opt->>'value') = val));
    when 'text' then
      return v_keys = array['kind','text'] and jsonb_typeof(p_value->'text') = 'string'
        and char_length(p_value->>'text') <= (q.control->>'maxLength')::integer;
    else return false;
  end case;
exception when numeric_value_out_of_range or invalid_text_representation or division_by_zero then return false;
end;
$$;

create function fsm_private.guard_answer()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if (new.id,new.couple_id,new.partner_id,new.catalog_version,new.question_code,new.created_at) is distinct from
       (old.id,old.couple_id,old.partner_id,old.catalog_version,old.question_code,old.created_at) then
      raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
    end if;
  end if;
  if not exists (select 1 from public.partners p join public.couples c on c.id = p.couple_id
    where p.id = new.partner_id and p.couple_id = new.couple_id and p.questionnaire_status = 'draft'
      and new.catalog_version = c.questionnaire_version)
    or not coalesce(fsm_private.valid_answer(new.catalog_version,new.question_code,new.value),false) then
    raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
create trigger answers_guard before insert or update on public.answers for each row execute function fsm_private.guard_answer();

create function fsm_private.immutable_question_catalog()
returns trigger language plpgsql set search_path = '' as $$
begin raise exception using errcode = 'P0001', message = 'INVALID_STATE'; end;
$$;
create trigger questions_immutable before update or delete on public.questions for each row execute function fsm_private.immutable_question_catalog();

create function fsm_private.questionnaire_payload(p_couple_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_partner uuid := fsm_private.require_member(p_couple_id); v_result jsonb;
begin
  select jsonb_build_object('partnerId',p.id,'catalogVersion',c.questionnaire_version,'revision',p.questionnaire_revision,
    'status',p.questionnaire_status,'submittedAt',p.submitted_at,
    'consent',jsonb_build_object('comparison',p.comparison_consent_at is not null,'budget',p.budget_consent_at is not null),
    'questions',(select jsonb_agg(q.control || jsonb_build_object('code',q.code,'catalogVersion',q.catalog_version,'title',q.title,
      'helpText',q.help_text,'category',q.category,'required',q.is_required,'position',q.position,'comparisonRule',q.comparison_rule)
      order by q.position) from public.questions q where q.catalog_version = c.questionnaire_version),
    'answers',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'coupleId',a.couple_id,'partnerId',a.partner_id,
      'catalogVersion',a.catalog_version,'questionCode',a.question_code,'value',a.value,'updatedAt',a.updated_at)
      order by q.position) from public.answers a join public.questions q on q.catalog_version=a.catalog_version and q.code=a.question_code
      where a.partner_id=p.id and a.couple_id=c.id),'[]'::jsonb)) into v_result
    from public.partners p join public.couples c on c.id=p.couple_id where p.id=v_partner;
  return v_result;
end;
$$;

create function fsm_private.lock_questionnaire(p_couple_id uuid, p_expected_revision integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_partner uuid; v_revision integer;
begin
  perform fsm_private.require_member(p_couple_id);
  perform 1 from public.couples where id=p_couple_id for update;
  v_partner := fsm_private.require_member(p_couple_id);
  select questionnaire_revision into v_revision from public.partners where id=v_partner for update;
  if p_expected_revision is null or p_expected_revision < 0 then raise exception using errcode='P0001',message='INVALID_INPUT'; end if;
  if p_expected_revision <> v_revision then raise exception using errcode='P0001',message='STALE_REVISION'; end if;
  if v_revision = 2147483647 then raise exception using errcode='P0001',message='INVALID_STATE'; end if;
  return v_partner;
end;
$$;

create function public.fsm_get_questionnaire(p_couple_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin return fsm_private.questionnaire_payload(p_couple_id); end;
$$;

create function public.fsm_save_answer(p_couple_id uuid, p_question_code text, p_value jsonb, p_expected_revision integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_partner uuid := fsm_private.lock_questionnaire(p_couple_id,p_expected_revision); v_version smallint;
begin
  if not exists (select 1 from public.partners where id=v_partner and questionnaire_status='draft') then
    raise exception using errcode='P0001',message='INVALID_STATE';
  end if;
  select questionnaire_version into v_version from public.couples where id=p_couple_id;
  if not coalesce(fsm_private.valid_answer(v_version,p_question_code,p_value),false) then raise exception using errcode='P0001',message='INVALID_INPUT'; end if;
  insert into public.answers(couple_id,partner_id,catalog_version,question_code,value)
    values(p_couple_id,v_partner,v_version,p_question_code,p_value)
    on conflict(partner_id,catalog_version,question_code) do update set value=excluded.value;
  update public.partners set questionnaire_revision=questionnaire_revision+1 where id=v_partner;
  return fsm_private.questionnaire_payload(p_couple_id);
end;
$$;

create function public.fsm_submit_questionnaire(p_couple_id uuid, p_expected_revision integer, p_comparison boolean, p_budget boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_partner uuid := fsm_private.lock_questionnaire(p_couple_id,p_expected_revision); v_now timestamptz := clock_timestamp();
begin
  if p_comparison is null or p_budget is null then raise exception using errcode='P0001',message='INVALID_INPUT'; end if;
  if not exists(select 1 from public.partners where id=v_partner and questionnaire_status='draft') then raise exception using errcode='P0001',message='INVALID_STATE'; end if;
  if exists (select 1 from public.questions q where q.catalog_version=1 and q.is_required and not exists
    (select 1 from public.answers a where a.partner_id=v_partner and a.catalog_version=q.catalog_version and a.question_code=q.code
      and fsm_private.valid_answer(a.catalog_version,a.question_code,a.value))) then
    raise exception using errcode='P0001',message='QUESTIONNAIRES_INCOMPLETE';
  end if;
  update public.partners set questionnaire_status='submitted',submitted_at=v_now,questionnaire_revision=questionnaire_revision+1,
    comparison_consent_at=case when p_comparison then v_now end,budget_consent_at=case when p_budget then v_now end where id=v_partner;
  return fsm_private.questionnaire_payload(p_couple_id);
end;
$$;

create function public.fsm_reopen_questionnaire(p_couple_id uuid, p_expected_revision integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_partner uuid := fsm_private.lock_questionnaire(p_couple_id,p_expected_revision);
begin
  if not exists(select 1 from public.partners where id=v_partner and questionnaire_status='submitted') then raise exception using errcode='P0001',message='INVALID_STATE'; end if;
  update public.partners set questionnaire_status='draft',submitted_at=null,comparison_consent_at=null,budget_consent_at=null,
    questionnaire_revision=questionnaire_revision+1 where id=v_partner;
  return fsm_private.questionnaire_payload(p_couple_id);
end;
$$;

create function public.fsm_update_privacy(p_couple_id uuid, p_expected_revision integer, p_comparison boolean, p_budget boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_partner uuid := fsm_private.lock_questionnaire(p_couple_id,p_expected_revision); v_now timestamptz := clock_timestamp();
begin
  if p_comparison is null or p_budget is null then raise exception using errcode='P0001',message='INVALID_INPUT'; end if;
  if not exists(select 1 from public.partners where id=v_partner and questionnaire_status='submitted') then raise exception using errcode='P0001',message='INVALID_STATE'; end if;
  update public.partners set comparison_consent_at=case when p_comparison then coalesce(comparison_consent_at,v_now) end,
    budget_consent_at=case when p_budget then coalesce(budget_consent_at,v_now) end,
    questionnaire_revision=questionnaire_revision+1 where id=v_partner;
  return fsm_private.questionnaire_payload(p_couple_id);
end;
$$;

revoke all on all functions in schema fsm_private from public,anon,authenticated;
grant execute on function fsm_private.is_active_member(uuid), fsm_private.owns_partner(uuid,uuid) to authenticated;
grant select on public.questions,public.answers to authenticated;
create policy questions_catalog_read on public.questions for select to authenticated using (true);
create policy answers_owner_read on public.answers for select to authenticated using (fsm_private.owns_partner(partner_id,couple_id));

revoke all on function public.fsm_get_questionnaire(uuid) from public,anon,authenticated;
revoke all on function public.fsm_save_answer(uuid,text,jsonb,integer) from public,anon,authenticated;
revoke all on function public.fsm_submit_questionnaire(uuid,integer,boolean,boolean) from public,anon,authenticated;
revoke all on function public.fsm_reopen_questionnaire(uuid,integer) from public,anon,authenticated;
revoke all on function public.fsm_update_privacy(uuid,integer,boolean,boolean) from public,anon,authenticated;
grant execute on function public.fsm_get_questionnaire(uuid), public.fsm_save_answer(uuid,text,jsonb,integer),
  public.fsm_submit_questionnaire(uuid,integer,boolean,boolean), public.fsm_reopen_questionnaire(uuid,integer),
  public.fsm_update_privacy(uuid,integer,boolean,boolean) to authenticated;

commit;
