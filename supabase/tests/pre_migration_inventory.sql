-- Execute with CLI db query --read-only. No user records or secrets are selected.
-- One result set: CLI JSON output otherwise retains only the final statement.
select
  (select coalesce(jsonb_agg(jsonb_build_object(
    'schema', n.nspname, 'name', c.relname, 'kind', c.relkind
  ) order by n.nspname, c.relname), '[]'::jsonb)
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('r', 'p', 'v', 'm', 'f')
      and n.nspname !~ '^pg_'
      and n.nspname not in (
        'information_schema', 'auth', 'storage', 'realtime', 'extensions',
        'graphql', 'graphql_public', 'vault', 'supabase_migrations',
        'supabase_functions', 'net', 'cron', 'pgbouncer', '_realtime',
        '_analytics', 'supavisor'
      )
  ) as application_objects,
  (select count(*) from auth.users) as existing_auth_users,
  (select count(*) from storage.objects) as existing_storage_objects,
  to_regclass('public.couples') is not null as couples_already_exists,
  to_regclass('public.partners') is not null as partners_already_exists,
  to_regclass('supabase_migrations.schema_migrations') is not null as migration_history_exists,
  (select n.nspname from pg_catalog.pg_extension e
    join pg_catalog.pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pgcrypto') as pgcrypto_schema;
