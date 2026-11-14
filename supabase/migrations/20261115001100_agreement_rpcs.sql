begin;

create function fsm_private.valid_agreement_rules(p_rules jsonb,p_check_window boolean default true)
returns boolean language plpgsql stable set search_path='' as $$
declare d date; n numeric;
begin
 if p_rules is null or jsonb_typeof(p_rules)<>'object' or
  (select count(*) from jsonb_object_keys(p_rules))<>6 or not(p_rules ?& array['personalSpending','debtExpectation','largePurchaseThresholdCents','emergencyRule','reviewFrequency','nextReviewDate']) then return false; end if;
 if p_rules->>'personalSpending' not in ('independent','discuss_above_threshold') or
  p_rules->>'debtExpectation' not in ('individual_responsibility','discuss_support') or
  p_rules->>'emergencyRule' not in ('use_shared_reserve_then_discuss','pause_savings_then_discuss','discuss_before_spending') or
  p_rules->>'reviewFrequency' not in ('monthly','quarterly','as_needed') or
  jsonb_typeof(p_rules->'largePurchaseThresholdCents') is distinct from 'number' or
  jsonb_typeof(p_rules->'nextReviewDate') is distinct from 'string' then return false; end if;
 if exists(select 1 from jsonb_each(p_rules) where value='null'::jsonb) then return false; end if;
 n:=(p_rules->>'largePurchaseThresholdCents')::numeric;
 if n<0 or n>1000000000000 or trunc(n)<>n or (p_rules->>'nextReviewDate') !~ '^\d{4}-\d{2}-\d{2}$' then return false; end if;
 d:=(p_rules->>'nextReviewDate')::date;
 return to_char(d,'YYYY-MM-DD')=p_rules->>'nextReviewDate' and
  (not p_check_window or (d>(clock_timestamp() at time zone 'UTC')::date and d<=(clock_timestamp() at time zone 'UTC')::date+366));
exception when others then return false;
end; $$;

create function fsm_private.agreement_payload(p_version_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',v.id,'coupleId',v.couple_id,'versionNumber',v.version_number,'parentVersionId',v.parent_version_id,
  'createdByPartnerId',v.created_by_partner_id,'sourceScenarioId',v.source_scenario_id,
  'sourceRevisions',jsonb_build_object('A',v.source_revision_a,'B',v.source_revision_b),'schemaVersion',v.schema_version,
  'financialSummary',v.financial_summary,'contentHash',v.content_hash,'status',v.status,'createdAt',v.created_at,'proposedAt',v.proposed_at,'approvedAt',v.approved_at,
  'items',(select jsonb_agg(jsonb_build_object('id',i.id,'versionId',i.version_id,'coupleId',i.couple_id,'position',i.position,'key',i.item_key)||i.value order by i.position) from public.agreement_items i where i.version_id=v.id),
  'approvals',jsonb_build_object('state',case (select count(*) from public.approvals where version_id=v.id) when 0 then 'none' when 1 then 'one' else 'both' end,
   'A',(select jsonb_build_object('id',a.id,'versionId',a.version_id,'partnerId',a.partner_id,'partnerSlot',p.slot,'contentHash',a.content_hash,'approvedAt',a.approved_at) from public.approvals a join public.partners p on p.id=a.partner_id where a.version_id=v.id and p.slot='A'),
   'B',(select jsonb_build_object('id',a.id,'versionId',a.version_id,'partnerId',a.partner_id,'partnerSlot',p.slot,'contentHash',a.content_hash,'approvedAt',a.approved_at) from public.approvals a join public.partners p on p.id=a.partner_id where a.version_id=v.id and p.slot='B')))
 from public.agreement_versions v where v.id=p_version_id;
$$;

create function fsm_private.agreement_content(p_payload jsonb)
returns jsonb language sql immutable set search_path='' as $$
 select p_payload-'status'-'createdAt'-'proposedAt'-'approvedAt'-'approvals'-'contentHash'-'createdByPartnerId'-'_created';
$$;

create function fsm_private.agreement_source(p_couple_id uuid,p_scenario_id uuid)
returns public.financial_scenarios language plpgsql security definer set search_path='' as $$
declare s public.financial_scenarios%rowtype;
begin
 perform fsm_private.require_shared(p_couple_id,auth.uid(),'budget');
 select * into s from public.financial_scenarios where id=p_scenario_id and couple_id=p_couple_id;
 if not found then raise exception using errcode='P0001',message='NOT_FOUND'; end if;
 if not fsm_private.budget_snapshot_is_current(p_couple_id,s.source_revision_a,s.source_revision_b) then raise exception using errcode='P0001',message='INPUTS_CHANGED'; end if;
 if s.stress_test is not null or s.output_snapshot->'split'->>'status' is distinct from 'available' or s.input_snapshot->'oneOffSharedExpenseCents'<>'0'::jsonb then
  raise exception using errcode='P0001',message='SCENARIO_UNAVAILABLE'; end if;
 return s;
end; $$;

create function public.fsm_get_agreement(p_couple_id uuid,p_version_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v uuid;
begin
 perform fsm_private.require_member(p_couple_id);
 if p_version_id is null then select current_agreement_version_id into v from public.couples where id=p_couple_id;
 else select id into v from public.agreement_versions where id=p_version_id and couple_id=p_couple_id;
  if not found then raise exception using errcode='P0001',message='NOT_FOUND'; end if;
 end if;
 return fsm_private.agreement_payload(v);
end; $$;

create function public.fsm_create_agreement(p_couple_id uuid,p_request_id uuid,p_expected_head_version_id uuid,p_source_scenario_id uuid,p_rules jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; head uuid; s public.financial_scenarios%rowtype; v public.agreement_versions%rowtype; fingerprint text;
 vid uuid:=gen_random_uuid(); number integer; summary jsonb; items jsonb; payload jsonb; hash text;
begin
 actor:=fsm_private.require_shared(p_couple_id,auth.uid(),'budget');
 if p_request_id is null or not fsm_private.valid_agreement_rules(p_rules) then raise exception using errcode='P0001',message='INVALID_INPUT'; end if;
 fingerprint:=encode(extensions.digest(jsonb_build_object('head',p_expected_head_version_id,'scenario',p_source_scenario_id,'rules',p_rules)::text,'sha256'),'hex');
 select * into v from public.agreement_versions where couple_id=p_couple_id and created_by_partner_id=actor and client_request_id=p_request_id;
 if found then
  if v.request_fingerprint<>fingerprint then raise exception using errcode='P0001',message='REQUEST_ID_REUSED'; end if;
  return fsm_private.agreement_payload(v.id)||jsonb_build_object('_created',false);
 end if;
 select current_agreement_version_id into head from public.couples where id=p_couple_id;
 if head is distinct from p_expected_head_version_id then raise exception using errcode='P0001',message='STALE_VERSION'; end if;
 s:=fsm_private.agreement_source(p_couple_id,p_source_scenario_id);
 if (select count(*) from public.agreement_versions where couple_id=p_couple_id and created_at>clock_timestamp()-interval '1 minute')>=20 then raise exception using errcode='P0001',message='RATE_LIMITED'; end if;
 number:=coalesce((select version_number from public.agreement_versions where id=head),0)+1;
 summary:=jsonb_build_object('currency','USD','splitModel',s.split_model,'monthlySharedTotalCents',s.output_snapshot->'split'->'monthlySharedTotalCents',
  'monthlyContributionsCents',jsonb_build_object('A',s.output_snapshot->'split'->'allocations'->'A'->'monthlyContributionCents','B',s.output_snapshot->'split'->'allocations'->'B'->'monthlyContributionCents'),
  'sharedEmergencyFundCents',s.input_snapshot->'sharedEmergencyFundCents');
 select jsonb_agg(jsonb_build_object('id',gen_random_uuid(),'versionId',vid,'coupleId',p_couple_id,'position',pos,'key',key)||value order by pos) into items from (
  select (ord-1)::integer pos,key,jsonb_build_object('monthlyCents',s.input_snapshot->'sharedExpenses'->key) value from unnest(array['rent','utilities','groceries','other','shared_savings']) with ordinality t(key,ord)
  union all select 5,'personal_spending',jsonb_build_object('rule',p_rules->'personalSpending','debtExpectation',p_rules->'debtExpectation')
  union all select 6,'large_purchase',jsonb_build_object('thresholdCents',p_rules->'largePurchaseThresholdCents')
  union all select 7,'emergency',jsonb_build_object('rule',p_rules->'emergencyRule')
  union all select 8,'review',jsonb_build_object('frequency',p_rules->'reviewFrequency','nextReviewDate',p_rules->'nextReviewDate')) q;
 payload:=jsonb_build_object('id',vid,'coupleId',p_couple_id,'versionNumber',number,'parentVersionId',head,'sourceScenarioId',s.id,
  'sourceRevisions',jsonb_build_object('A',s.source_revision_a,'B',s.source_revision_b),'schemaVersion',1,'financialSummary',summary,'items',items);
 hash:=encode(extensions.digest(payload::text,'sha256'),'hex');
 insert into public.agreement_versions(id,couple_id,version_number,parent_version_id,created_by_partner_id,client_request_id,request_fingerprint,source_scenario_id,source_revision_a,source_revision_b,financial_summary,content_hash)
  values(vid,p_couple_id,number,head,actor,p_request_id,fingerprint,s.id,s.source_revision_a,s.source_revision_b,summary,hash);
 insert into public.agreement_items(id,couple_id,version_id,item_key,position,value)
  select (j->>'id')::uuid,p_couple_id,vid,j->>'key',(j->>'position')::smallint,j-'id'-'coupleId'-'versionId'-'key'-'position' from jsonb_array_elements(items) j;
 update public.couples set current_agreement_version_id=vid where id=p_couple_id;
 return fsm_private.agreement_payload(vid)||jsonb_build_object('_created',true);
end; $$;

create function fsm_private.current_agreement(p_couple_id uuid,p_version_id uuid,p_expected_hash text)
returns public.agreement_versions language plpgsql security definer set search_path='' as $$
declare v public.agreement_versions%rowtype; head uuid;
begin
 perform fsm_private.require_shared(p_couple_id,auth.uid(),'budget');
 select current_agreement_version_id into head from public.couples where id=p_couple_id;
 if head is distinct from p_version_id or p_version_id is null then raise exception using errcode='P0001',message='STALE_VERSION'; end if;
 select * into v from public.agreement_versions where id=p_version_id and couple_id=p_couple_id for update;
 if p_expected_hash is null or v.content_hash is distinct from p_expected_hash then raise exception using errcode='P0001',message='STALE_VERSION'; end if;
 perform fsm_private.agreement_source(p_couple_id,v.source_scenario_id);
 return v;
end; $$;

create function public.fsm_propose_agreement(p_couple_id uuid,p_version_id uuid,p_expected_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.agreement_versions%rowtype;
begin
 v:=fsm_private.current_agreement(p_couple_id,p_version_id,p_expected_hash);
 if v.status='draft' then update public.agreement_versions set status='proposed',proposed_at=clock_timestamp() where id=v.id; end if;
 return fsm_private.agreement_payload(v.id);
end; $$;

create function public.fsm_approve_agreement(p_couple_id uuid,p_version_id uuid,p_expected_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.agreement_versions%rowtype; actor uuid; n integer;
begin
 v:=fsm_private.current_agreement(p_couple_id,p_version_id,p_expected_hash);
 actor:=fsm_private.require_member(p_couple_id);
 if v.status='draft' then raise exception using errcode='P0001',message='INVALID_STATE'; end if;
 if exists(select 1 from public.approvals where version_id=v.id and partner_id=actor) then return fsm_private.agreement_payload(v.id); end if;
 insert into public.approvals(couple_id,version_id,partner_id,content_hash) values(p_couple_id,v.id,actor,v.content_hash);
 select count(*) into n from public.approvals where version_id=v.id;
 update public.agreement_versions set status=case when n=2 then 'approved' else 'under_review' end,
  approved_at=case when n=2 then (select max(approved_at) from public.approvals where version_id=v.id) else null end where id=v.id;
 return fsm_private.agreement_payload(v.id);
end; $$;

create function public.fsm_export_agreement(p_couple_id uuid,p_version_id uuid,p_expected_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.agreement_versions%rowtype;
begin
 v:=fsm_private.current_agreement(p_couple_id,p_version_id,p_expected_hash);
 if v.status<>'approved' or (select count(*) from public.approvals where version_id=v.id)<>2 then raise exception using errcode='P0001',message='INVALID_STATE'; end if;
 return fsm_private.agreement_payload(v.id);
end; $$;

create function fsm_private.guard_agreement_mutation()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' then
  if exists(select 1 from public.couples where id=old.couple_id) then raise exception using errcode='P0001',message='INVALID_STATE'; end if;
  return old;
 end if;
 if tg_table_name='agreement_versions' and tg_op='UPDATE' then
  if (to_jsonb(new)-'status'-'proposed_at'-'approved_at') is distinct from (to_jsonb(old)-'status'-'proposed_at'-'approved_at') or
   not ((old.status='draft' and new.status='proposed') or (old.status='proposed' and new.status='under_review') or (old.status='under_review' and new.status='approved')) then
   raise exception using errcode='P0001',message='INVALID_STATE'; end if;
  if old.proposed_at is not null and new.proposed_at is distinct from old.proposed_at then raise exception using errcode='P0001',message='INVALID_STATE'; end if;
  perform fsm_private.current_agreement(new.couple_id,new.id,new.content_hash);
  return new;
 end if;
 raise exception using errcode='P0001',message='INVALID_STATE';
end; $$;
create trigger agreement_versions_immutable before update or delete on public.agreement_versions for each row execute function fsm_private.guard_agreement_mutation();
create trigger agreement_items_immutable before update or delete on public.agreement_items for each row execute function fsm_private.guard_agreement_mutation();
create trigger approvals_immutable before update or delete on public.approvals for each row execute function fsm_private.guard_agreement_mutation();

create function fsm_private.guard_approval_insert()
returns trigger language plpgsql security definer set search_path='' as $$
declare v public.agreement_versions%rowtype;
begin
 v:=fsm_private.current_agreement(new.couple_id,new.version_id,new.content_hash);
 if new.partner_id is distinct from fsm_private.require_member(new.couple_id) or v.status not in ('proposed','under_review') then raise exception using errcode='P0001',message='INVALID_STATE'; end if;
 new.approved_at:=clock_timestamp(); return new;
end; $$;
create trigger approvals_checked before insert on public.approvals for each row execute function fsm_private.guard_approval_insert();

create function fsm_private.check_agreement_integrity()
returns trigger language plpgsql security definer set search_path='' as $$
declare vid uuid; v public.agreement_versions%rowtype; payload jsonb; n integer; s public.financial_scenarios%rowtype; costs numeric;
begin
 if tg_table_name='agreement_versions' then vid:=new.id; else vid:=new.version_id; end if;
 select * into v from public.agreement_versions where id=vid;
 if not found then return null; end if;
 payload:=fsm_private.agreement_payload(vid);
 select count(*) into n from public.approvals where version_id=vid;
 if (select count(*) from public.agreement_items where version_id=vid)<>9 or
  n<>(case v.status when 'draft' then 0 when 'proposed' then 0 when 'under_review' then 1 else 2 end) or
  v.content_hash<>encode(extensions.digest(fsm_private.agreement_content(payload)::text,'sha256'),'hex') then
  raise exception using errcode='P0001',message='INVALID_STATE'; end if;
 select * into s from public.financial_scenarios where id=v.source_scenario_id and couple_id=v.couple_id;
 if s.stress_test is not null or s.output_snapshot->'split'->>'status' is distinct from 'available' or
  v.source_revision_a<>s.source_revision_a or v.source_revision_b<>s.source_revision_b or
  v.financial_summary is distinct from jsonb_build_object('currency','USD','splitModel',s.split_model,'monthlySharedTotalCents',s.output_snapshot->'split'->'monthlySharedTotalCents',
   'monthlyContributionsCents',jsonb_build_object('A',s.output_snapshot->'split'->'allocations'->'A'->'monthlyContributionCents','B',s.output_snapshot->'split'->'allocations'->'B'->'monthlyContributionCents'),
   'sharedEmergencyFundCents',s.input_snapshot->'sharedEmergencyFundCents') then raise exception using errcode='P0001',message='INVALID_STATE'; end if;
 if exists(select 1 from public.agreement_items i where i.version_id=vid and i.position<5 and i.value is distinct from jsonb_build_object('monthlyCents',s.input_snapshot->'sharedExpenses'->i.item_key)) then raise exception using errcode='P0001',message='INVALID_STATE'; end if;
 select sum((value->>'monthlyCents')::numeric) into costs from public.agreement_items where version_id=vid and position<5;
 if costs is distinct from (v.financial_summary->>'monthlySharedTotalCents')::numeric or
  (v.financial_summary->'monthlyContributionsCents'->>'A')::numeric+(v.financial_summary->'monthlyContributionsCents'->>'B')::numeric is distinct from costs then raise exception using errcode='P0001',message='INVALID_STATE'; end if;
 if v.parent_version_id is not null and not exists(select 1 from public.agreement_versions where id=v.parent_version_id and couple_id=v.couple_id and version_number=v.version_number-1) then raise exception using errcode='P0001',message='INVALID_STATE'; end if;
 return null;
end; $$;
create constraint trigger agreement_integrity after insert or update on public.agreement_versions deferrable initially deferred for each row execute function fsm_private.check_agreement_integrity();
create constraint trigger approval_integrity after insert on public.approvals deferrable initially deferred for each row execute function fsm_private.check_agreement_integrity();

revoke all on function fsm_private.valid_agreement_rules(jsonb,boolean),fsm_private.agreement_payload(uuid),fsm_private.agreement_content(jsonb),
 fsm_private.agreement_source(uuid,uuid),fsm_private.current_agreement(uuid,uuid,text),fsm_private.guard_agreement_mutation(),fsm_private.guard_approval_insert(),fsm_private.check_agreement_integrity() from public,anon,authenticated;
revoke all on function public.fsm_get_agreement(uuid,uuid),public.fsm_create_agreement(uuid,uuid,uuid,uuid,jsonb),public.fsm_propose_agreement(uuid,uuid,text),
 public.fsm_approve_agreement(uuid,uuid,text),public.fsm_export_agreement(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.fsm_get_agreement(uuid,uuid),public.fsm_create_agreement(uuid,uuid,uuid,uuid,jsonb),public.fsm_propose_agreement(uuid,uuid,text),
 public.fsm_approve_agreement(uuid,uuid,text),public.fsm_export_agreement(uuid,uuid,text) to authenticated;
commit;
