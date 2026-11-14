begin;

create table public.financial_scenarios (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  created_by_partner_id uuid not null,
  client_request_id uuid not null,
  request_fingerprint text not null check (request_fingerprint ~ '^[a-f0-9]{64}$'),
  source_revision_a integer not null check (source_revision_a >= 0),
  source_revision_b integer not null check (source_revision_b >= 0),
  engine_version text not null default 'fsm-finance-v1' check (engine_version = 'fsm-finance-v1'),
  input_snapshot jsonb not null check (jsonb_typeof(input_snapshot) = 'object' and octet_length(input_snapshot::text) <= 16384),
  split_model jsonb not null check (jsonb_typeof(split_model) = 'object'),
  stress_test jsonb check (stress_test is null or jsonb_typeof(stress_test) = 'object'),
  output_snapshot jsonb not null check (jsonb_typeof(output_snapshot) = 'object' and octet_length(output_snapshot::text) <= 32768),
  created_at timestamptz not null default clock_timestamp(),
  foreign key (created_by_partner_id, couple_id) references public.partners(id, couple_id) on delete cascade,
  unique(id,couple_id),
  unique(couple_id,created_by_partner_id,client_request_id),
  check (input_snapshot->'sourceRevisions' = jsonb_build_object('A',source_revision_a,'B',source_revision_b)),
  check (input_snapshot->>'currency' = 'USD' and input_snapshot->'oneOffSharedExpenseCents' = '0'::jsonb)
);
create index financial_scenarios_couple_time_idx on public.financial_scenarios(couple_id,created_at desc);
create index financial_scenarios_creator_idx on public.financial_scenarios(created_by_partner_id,couple_id);
alter table public.financial_scenarios enable row level security;
revoke all on public.financial_scenarios from public,anon,authenticated;

commit;
