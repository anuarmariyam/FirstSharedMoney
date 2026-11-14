-- Read-only catalog assertions, not a replacement for real user JWT tests.
begin;
do $$
declare v_name text;
begin
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where (n.nspname, c.relname) in (('public', 'couples'), ('public', 'partners'), ('fsm_private', 'session_invitations'))
      and not c.relrowsecurity) then raise exception 'RLS is not enabled on a session table'; end if;
  foreach v_name in array array['public.fsm_get_session(uuid)', 'public.fsm_create_session(uuid,text)', 'public.fsm_rotate_invitation(uuid)', 'public.fsm_redeem_invitation(text,text)'] loop
    if not has_function_privilege('authenticated', v_name, 'EXECUTE') or has_function_privilege('anon', v_name, 'EXECUTE') then
      raise exception 'Unexpected session RPC grants';
    end if;
  end loop;
  if has_table_privilege('authenticated', 'public.partners', 'INSERT')
    or has_table_privilege('authenticated', 'public.partners', 'UPDATE')
    or has_table_privilege('anon', 'public.couples', 'SELECT')
    or has_table_privilege('authenticated', 'fsm_private.session_invitations', 'SELECT') then
    raise exception 'Unexpected direct table privileges';
  end if;
end;
$$;
rollback;
