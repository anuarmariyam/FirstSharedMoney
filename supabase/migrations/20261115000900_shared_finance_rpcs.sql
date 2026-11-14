begin;

-- Actor IDs in these helpers are accepted only from server-only RPCs, or auth.uid().
create function fsm_private.require_shared(p_couple_id uuid,p_actor uuid,p_gate text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_partner uuid;
begin
  if p_gate not in ('budget','comparison') or p_actor is null then raise exception using errcode='P0001',message='NOT_FOUND'; end if;
  select p.id into v_partner from public.partners p join public.couples c on c.id=p.couple_id
    where c.id=p_couple_id and p.auth_user_id=p_actor and p.revoked_at is null
      and p.access_expires_at>clock_timestamp() and c.expires_at>clock_timestamp();
  if not found then raise exception using errcode='P0001',message='NOT_FOUND'; end if;
  perform 1 from public.couples where id=p_couple_id for update;
  select p.id into v_partner from public.partners p join public.couples c on c.id=p.couple_id
    where c.id=p_couple_id and p.auth_user_id=p_actor and p.revoked_at is null
      and p.access_expires_at>clock_timestamp() and c.expires_at>clock_timestamp();
  if not found then raise exception using errcode='P0001',message='NOT_FOUND'; end if;
  if (select count(*) from public.partners where couple_id=p_couple_id and revoked_at is null
    and access_expires_at>clock_timestamp() and questionnaire_status='submitted') <> 2 then
    raise exception using errcode='P0001',message='QUESTIONNAIRES_INCOMPLETE';
  end if;
  if exists(select 1 from public.partners where couple_id=p_couple_id and
    (case when p_gate='budget' then budget_consent_at else comparison_consent_at end) is null) then
    raise exception using errcode='P0001',message='CONSENT_REQUIRED';
  end if;
  return v_partner;
end;
$$;

create function fsm_private.budget_snapshot_is_current(p_couple_id uuid,p_a integer,p_b integer)
returns boolean language sql stable security definer set search_path='' as $$
  select fsm_private.is_active_member(p_couple_id) and
    (select count(*) from public.partners p where p.couple_id=p_couple_id and p.revoked_at is null
      and p.access_expires_at>clock_timestamp() and p.questionnaire_status='submitted' and p.budget_consent_at is not null
      and p.questionnaire_revision=case when p.slot='A' then p_a else p_b end)=2;
$$;

create function fsm_private.financial_inputs(p_couple_id uuid)
returns jsonb language sql security definer set search_path='' as $$
  select jsonb_build_object('currency','USD',
    'sourceRevisions',jsonb_object_agg(p.slot,to_jsonb(p.questionnaire_revision)),
    'partners',jsonb_object_agg(p.slot,jsonb_build_object(
      'monthlyNetIncomeCents',(select a.value->'cents' from public.answers a where a.partner_id=p.id and a.question_code='monthly_income' and a.catalog_version=1),
      'monthlyPersonalObligationsCents',(select a.value->'cents' from public.answers a where a.partner_id=p.id and a.question_code='personal_obligations' and a.catalog_version=1))),
    'sharedExpenses',jsonb_build_object('rent',0,'utilities',0,'groceries',0,'other',0,'shared_savings',0),
    'sharedEmergencyFundCents',0,'oneOffSharedExpenseCents',0)
    from public.partners p where p.couple_id=p_couple_id;
$$;

create function public.fsm_internal_financial_inputs(p_couple_id uuid,p_verified_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform fsm_private.require_shared(p_couple_id,p_verified_actor_user_id,'budget');
  return fsm_private.financial_inputs(p_couple_id);
end;
$$;

create function public.fsm_internal_comparison_inputs(p_couple_id uuid,p_verified_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform fsm_private.require_shared(p_couple_id,p_verified_actor_user_id,'comparison');
  return (select jsonb_object_agg(p.slot,jsonb_build_object('catalogVersion',1,'revision',p.questionnaire_revision,
    'questions',(select jsonb_agg(q.control || jsonb_build_object('code',q.code,'catalogVersion',q.catalog_version,'title',q.title,'helpText',q.help_text,
      'category',q.category,'required',q.is_required,'position',q.position,'comparisonRule',q.comparison_rule) order by q.position)
      from public.questions q where q.catalog_version=1 and q.comparison_rule<>'none'),
    'answers',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'coupleId',a.couple_id,'partnerId',a.partner_id,'catalogVersion',a.catalog_version,
      'questionCode',a.question_code,'value',a.value,'updatedAt',a.updated_at) order by q.position)
      from public.answers a join public.questions q on q.catalog_version=a.catalog_version and q.code=a.question_code
      where a.partner_id=p.id and q.comparison_rule<>'none'),'[]'::jsonb))) from public.partners p where p.couple_id=p_couple_id);
end;
$$;

create function fsm_private.scenario_payload(p_row public.financial_scenarios)
returns jsonb language sql immutable set search_path='' as $$
  select jsonb_build_object('id',(p_row).id,'coupleId',(p_row).couple_id,'createdByPartnerId',(p_row).created_by_partner_id,
    'input',(p_row).input_snapshot,'model',(p_row).split_model,'stressTest',(p_row).stress_test,'output',(p_row).output_snapshot,'createdAt',(p_row).created_at);
$$;

create function public.fsm_internal_store_scenario(p_couple_id uuid,p_verified_actor_user_id uuid,p_request_id uuid,p_input jsonb,p_model jsonb,p_stress_test jsonb,p_output jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_partner uuid; v_fresh jsonb; v_expected jsonb; v_fingerprint text; v_row public.financial_scenarios%rowtype; v_value jsonb; v_sum numeric:=0;
begin
  v_partner := fsm_private.require_shared(p_couple_id,p_verified_actor_user_id,'budget');
  v_fresh := fsm_private.financial_inputs(p_couple_id);
  if p_input->'sourceRevisions' is distinct from v_fresh->'sourceRevisions' then raise exception using errcode='P0001',message='INPUTS_CHANGED'; end if;
  v_expected := v_fresh || jsonb_build_object('sharedExpenses',p_input->'sharedExpenses','sharedEmergencyFundCents',p_input->'sharedEmergencyFundCents');
  if p_input is distinct from v_expected or p_request_id is null or jsonb_typeof(p_model) is distinct from 'object'
    or jsonb_typeof(p_output) is distinct from 'object' or jsonb_typeof(p_input->'sharedExpenses') is distinct from 'object'
    or (select count(*) from jsonb_object_keys(p_input->'sharedExpenses'))<>5
    or not (p_input->'sharedExpenses' ?& array['rent','utilities','groceries','other','shared_savings'])
    or p_model->>'kind' is null or p_model->>'kind' not in ('equal','proportional','custom') then raise exception using errcode='P0001',message='INVALID_INPUT'; end if;
  if p_model->>'kind'='custom' then
    if (select count(*) from jsonb_object_keys(p_model))<>2 or jsonb_typeof(p_model->'partnerAShareBasisPoints') is distinct from 'number'
      or (p_model->>'partnerAShareBasisPoints')::numeric not between 0 and 10000
      or trunc((p_model->>'partnerAShareBasisPoints')::numeric)<>(p_model->>'partnerAShareBasisPoints')::numeric then
      raise exception using errcode='P0001',message='INVALID_INPUT'; end if;
  elsif (select count(*) from jsonb_object_keys(p_model))<>1 then raise exception using errcode='P0001',message='INVALID_INPUT'; end if;
  for v_value in select value from jsonb_each(p_input->'sharedExpenses') union all select p_input->'sharedEmergencyFundCents' loop
    if jsonb_typeof(v_value) is distinct from 'number' or (v_value::text)::numeric<0 or (v_value::text)::numeric>1000000000000
      or trunc((v_value::text)::numeric)<>(v_value::text)::numeric then raise exception using errcode='P0001',message='INVALID_INPUT'; end if;
  end loop;
  select sum((value::text)::numeric) into v_sum from jsonb_each(p_input->'sharedExpenses');
  if v_sum>1000000000000 then raise exception using errcode='P0001',message='INVALID_INPUT'; end if;
  -- Only the trusted Edge calculation can reach this RPC; client outputs are never accepted.
  if (select count(*) from jsonb_object_keys(p_output))<>3 or not (p_output ?& array['effectiveInput','reserveUsedCents','split'])
    or jsonb_typeof(p_output->'effectiveInput') is distinct from 'object' or jsonb_typeof(p_output->'reserveUsedCents') is distinct from 'number'
    or p_output->'effectiveInput'->'sourceRevisions' is distinct from p_input->'sourceRevisions'
    or p_output->'split'->'model' is distinct from p_model or p_output->'split'->>'status' is null
    or p_output->'split'->>'status' not in ('available','unavailable') or octet_length(p_output::text)>32768 then
    raise exception using errcode='P0001',message='INVALID_INPUT'; end if;
  if p_output->'split'->>'status'='available' then
    if (p_output->'split'->'allocations'->'A'->>'monthlyContributionCents')::numeric + (p_output->'split'->'allocations'->'B'->>'monthlyContributionCents')::numeric
      is distinct from (p_output->'split'->>'monthlySharedTotalCents')::numeric
      or (p_output->'split'->'allocations'->'A'->>'oneOffContributionCents')::numeric + (p_output->'split'->'allocations'->'B'->>'oneOffContributionCents')::numeric
      is distinct from (p_output->'split'->>'oneOffSharedTotalCents')::numeric then raise exception using errcode='P0001',message='INVALID_INPUT'; end if;
  end if;
  v_fingerprint := encode(extensions.digest(jsonb_build_object('input',p_input,'model',p_model,'stressTest',p_stress_test)::text,'sha256'),'hex');
  select * into v_row from public.financial_scenarios where couple_id=p_couple_id and created_by_partner_id=v_partner and client_request_id=p_request_id;
  if found then
    if v_row.request_fingerprint<>v_fingerprint then raise exception using errcode='P0001',message='REQUEST_ID_REUSED'; end if;
    return fsm_private.scenario_payload(v_row) || jsonb_build_object('_created',false);
  end if;
  if (select count(*) from public.financial_scenarios where couple_id=p_couple_id and created_at>clock_timestamp()-interval '1 minute')>=30 then
    raise exception using errcode='P0001',message='RATE_LIMITED';
  end if;
  insert into public.financial_scenarios(couple_id,created_by_partner_id,client_request_id,request_fingerprint,source_revision_a,source_revision_b,input_snapshot,split_model,stress_test,output_snapshot)
    values(p_couple_id,v_partner,p_request_id,v_fingerprint,(p_input->'sourceRevisions'->>'A')::integer,(p_input->'sourceRevisions'->>'B')::integer,p_input,p_model,p_stress_test,p_output) returning * into v_row;
  return fsm_private.scenario_payload(v_row) || jsonb_build_object('_created',true);
exception when numeric_value_out_of_range or invalid_text_representation then raise exception using errcode='P0001',message='INVALID_INPUT';
end;
$$;

create function public.fsm_get_scenario(p_couple_id uuid,p_scenario_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_row public.financial_scenarios%rowtype; v_fresh jsonb;
begin
  perform fsm_private.require_shared(p_couple_id,auth.uid(),'budget');
  select * into v_row from public.financial_scenarios where id=p_scenario_id and couple_id=p_couple_id;
  if not found then raise exception using errcode='P0001',message='NOT_FOUND'; end if;
  v_fresh := fsm_private.financial_inputs(p_couple_id);
  if v_row.input_snapshot->'sourceRevisions' is distinct from v_fresh->'sourceRevisions' then raise exception using errcode='P0001',message='INPUTS_CHANGED'; end if;
  return fsm_private.scenario_payload(v_row);
end;
$$;

create function fsm_private.scenario_immutable()
returns trigger language plpgsql set search_path='' as $$
begin raise exception using errcode='P0001',message='INVALID_STATE'; end;
$$;
create trigger financial_scenarios_immutable before update on public.financial_scenarios for each row execute function fsm_private.scenario_immutable();

revoke all on function fsm_private.require_shared(uuid,uuid,text),fsm_private.budget_snapshot_is_current(uuid,integer,integer),
  fsm_private.financial_inputs(uuid),fsm_private.scenario_payload(public.financial_scenarios),fsm_private.scenario_immutable() from public,anon,authenticated;
grant execute on function fsm_private.budget_snapshot_is_current(uuid,integer,integer) to authenticated;
grant select on public.financial_scenarios to authenticated;
create policy financial_scenarios_current_read on public.financial_scenarios for select to authenticated
  using (fsm_private.budget_snapshot_is_current(couple_id,source_revision_a,source_revision_b));
revoke all on function public.fsm_internal_financial_inputs(uuid,uuid),public.fsm_internal_comparison_inputs(uuid,uuid),
  public.fsm_internal_store_scenario(uuid,uuid,uuid,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.fsm_internal_financial_inputs(uuid,uuid),public.fsm_internal_comparison_inputs(uuid,uuid),
  public.fsm_internal_store_scenario(uuid,uuid,uuid,jsonb,jsonb,jsonb,jsonb) to service_role;
revoke all on function public.fsm_get_scenario(uuid,uuid) from public,anon,authenticated;
grant execute on function public.fsm_get_scenario(uuid,uuid) to authenticated;

commit;
