begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists fsm_private;
revoke all on schema fsm_private from public, anon, authenticated;

create table public.couples (
  id uuid primary key default gen_random_uuid(),
  mode text not null default 'standard' check (mode in ('standard', 'demo')),
  currency text not null default 'USD' check (currency = 'USD'),
  questionnaire_version smallint not null default 1 check (questionnaire_version = 1),
  created_by_auth_user_id uuid not null references auth.users(id) on delete restrict,
  creation_request_id uuid not null,
  creation_request_fingerprint text not null check (creation_request_fingerprint ~ '^[a-f0-9]{64}$'),
  current_agreement_version_id uuid,
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  unique (created_by_auth_user_id, creation_request_id),
  check (expires_at > created_at),
  -- Replace this guard with the approved composite FK when agreement tables ship.
  constraint phase_4a_has_no_agreement check (current_agreement_version_id is null)
);

create table public.partners (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete restrict,
  slot text not null check (slot in ('A', 'B')),
  display_name text not null check (display_name = btrim(display_name) and char_length(display_name) between 1 and 40),
  questionnaire_status text not null default 'draft' check (questionnaire_status in ('draft', 'submitted')),
  questionnaire_revision integer not null default 0 check (questionnaire_revision >= 0),
  submitted_at timestamptz,
  comparison_consent_at timestamptz,
  budget_consent_at timestamptz,
  joined_at timestamptz not null default clock_timestamp(),
  access_expires_at timestamptz not null,
  revoked_at timestamptz,
  unique (couple_id, slot),
  unique (couple_id, auth_user_id),
  unique (id, couple_id),
  check (access_expires_at > joined_at),
  check (revoked_at is null or revoked_at >= joined_at),
  check (
    (questionnaire_status = 'draft' and submitted_at is null and comparison_consent_at is null and budget_consent_at is null)
    or (questionnaire_status = 'submitted' and submitted_at is not null)
  )
);

create table fsm_private.session_invitations (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  created_by_partner_id uuid not null,
  target_slot text not null default 'B' check (target_slot = 'B'),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_by_partner_id uuid,
  revoked_at timestamptz,
  foreign key (created_by_partner_id, couple_id) references public.partners(id, couple_id) on delete cascade,
  foreign key (consumed_by_partner_id, couple_id) references public.partners(id, couple_id) on delete cascade,
  check (expires_at > created_at and expires_at <= created_at + interval '24 hours'),
  check ((consumed_at is null) = (consumed_by_partner_id is null)),
  check (consumed_at is null or consumed_at >= created_at),
  check (revoked_at is null or revoked_at >= created_at),
  check (consumed_at is null or revoked_at is null)
);

-- Closed from the first migration, including on projects with broad defaults.
alter table public.couples enable row level security;
alter table public.partners enable row level security;
alter table fsm_private.session_invitations enable row level security;
revoke all on public.couples, public.partners, fsm_private.session_invitations from public, anon, authenticated;

commit;
