begin;

create table public.agreement_versions (
 id uuid primary key default gen_random_uuid(),
 couple_id uuid not null references public.couples(id) on delete cascade,
 version_number integer not null check(version_number>=1),
 parent_version_id uuid,
 created_by_partner_id uuid not null,
 client_request_id uuid not null,
 request_fingerprint text not null check(request_fingerprint ~ '^[a-f0-9]{64}$'),
 source_scenario_id uuid not null,
 source_revision_a integer not null check(source_revision_a>=0),
 source_revision_b integer not null check(source_revision_b>=0),
 schema_version smallint not null default 1 check(schema_version=1),
 financial_summary jsonb not null check(jsonb_typeof(financial_summary)='object' and octet_length(financial_summary::text)<=8192),
 content_hash text not null check(content_hash ~ '^[a-f0-9]{64}$'),
 status text not null default 'draft' check(status in ('draft','proposed','under_review','approved')),
 created_at timestamptz not null default clock_timestamp(),
 proposed_at timestamptz,
 approved_at timestamptz,
 unique(id,couple_id), unique(id,couple_id,content_hash), unique(couple_id,version_number),
 unique(couple_id,created_by_partner_id,client_request_id),
 foreign key(created_by_partner_id,couple_id) references public.partners(id,couple_id) on delete cascade,
 foreign key(source_scenario_id,couple_id) references public.financial_scenarios(id,couple_id) deferrable initially deferred,
 foreign key(parent_version_id,couple_id) references public.agreement_versions(id,couple_id) deferrable initially deferred,
 check((status='draft' and proposed_at is null and approved_at is null) or
       (status in ('proposed','under_review') and proposed_at is not null and approved_at is null) or
       (status='approved' and proposed_at is not null and approved_at is not null)),
 check(proposed_at is null or proposed_at>=created_at),
 check(approved_at is null or approved_at>=proposed_at)
);
create table public.agreement_items (
 id uuid primary key default gen_random_uuid(),
 couple_id uuid not null references public.couples(id) on delete cascade,
 version_id uuid not null,
 item_key text not null,
 position smallint not null check(position between 0 and 8),
 value jsonb not null check(jsonb_typeof(value)='object' and octet_length(value::text)<=4096),
 foreign key(version_id,couple_id) references public.agreement_versions(id,couple_id) on delete cascade,
 unique(version_id,item_key), unique(version_id,position),
 check(item_key=(array['rent','utilities','groceries','other','shared_savings','personal_spending','large_purchase','emergency','review'])[position+1])
);
create table public.approvals (
 id uuid primary key default gen_random_uuid(),
 couple_id uuid not null references public.couples(id) on delete cascade,
 version_id uuid not null,
 partner_id uuid not null,
 content_hash text not null,
 approved_at timestamptz not null default clock_timestamp(),
 foreign key(version_id,couple_id,content_hash) references public.agreement_versions(id,couple_id,content_hash) on delete cascade,
 foreign key(partner_id,couple_id) references public.partners(id,couple_id) on delete cascade,
 unique(version_id,partner_id)
);
-- Replace only the temporary Phase 4A guard, preserving every existing session.
alter table public.couples drop constraint phase_4a_has_no_agreement;
alter table public.couples add constraint couples_current_agreement_fk
 foreign key(current_agreement_version_id,id) references public.agreement_versions(id,couple_id) deferrable initially deferred;

create index agreement_versions_couple_time_idx on public.agreement_versions(couple_id,created_at desc);
create index agreement_versions_scenario_idx on public.agreement_versions(source_scenario_id,couple_id);
create index agreement_versions_creator_idx on public.agreement_versions(created_by_partner_id,couple_id);
create index agreement_versions_parent_idx on public.agreement_versions(parent_version_id,couple_id) where parent_version_id is not null;
create index agreement_items_couple_idx on public.agreement_items(couple_id);
create index approvals_couple_idx on public.approvals(couple_id);
create index approvals_partner_idx on public.approvals(partner_id,couple_id);
alter table public.agreement_versions enable row level security;
alter table public.agreement_items enable row level security;
alter table public.approvals enable row level security;
revoke all on public.agreement_versions,public.agreement_items,public.approvals from public,anon,authenticated;
grant select on public.agreement_versions,public.agreement_items,public.approvals to authenticated;
create policy agreement_versions_member_read on public.agreement_versions for select to authenticated using(fsm_private.is_active_member(couple_id));
create policy agreement_items_member_read on public.agreement_items for select to authenticated using(fsm_private.is_active_member(couple_id));
create policy approvals_member_read on public.approvals for select to authenticated using(fsm_private.is_active_member(couple_id));
commit;
