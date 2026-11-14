begin;

create table public.questions (
  catalog_version smallint not null check (catalog_version = 1),
  code text not null,
  category text not null check (category in ('income_obligations','shared_expenses','expense_split','savings','personal_spending','debt','emergency','large_purchase','transparency','reviews')),
  kind text not null check (kind in ('money','single_choice','multiple_choice','slider','text')),
  title text not null check (char_length(title) between 1 and 200),
  help_text text not null check (char_length(help_text) <= 500),
  is_required boolean not null,
  position smallint not null check (position between 1 and 15),
  comparison_rule text not null check (comparison_rule in ('exact','set_equality','none')),
  control jsonb not null check (jsonb_typeof(control) = 'object' and octet_length(control::text) <= 8192 and control->>'kind' = kind),
  primary key (catalog_version, code),
  unique (catalog_version, position)
);

create table public.answers (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  partner_id uuid not null,
  catalog_version smallint not null,
  question_code text not null,
  value jsonb not null check (jsonb_typeof(value) = 'object' and octet_length(value::text) <= 4096),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  foreign key (partner_id, couple_id) references public.partners(id, couple_id) on delete cascade,
  foreign key (catalog_version, question_code) references public.questions(catalog_version, code) on delete restrict,
  unique (partner_id, catalog_version, question_code),
  check (updated_at >= created_at)
);

create index answers_couple_idx on public.answers(couple_id);
alter table public.questions enable row level security;
alter table public.answers enable row level security;
revoke all on public.questions, public.answers from public, anon, authenticated;

commit;
