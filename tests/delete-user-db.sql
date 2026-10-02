-- Isolated QA fixture only. Never run against production user accounts.
begin;
create temporary table archive_auth_before as select id from auth.users;
create table public.archive_history(id integer,owner_id uuid references public.profiles(id));
insert into archive_history values(1,'22222222-2222-4222-8222-222222222222');
do $$begin
 if has_function_privilege('authenticated','public.crm_archive_user(uuid,uuid,boolean)','execute') or
    has_function_privilege('anon','public.crm_archive_user(uuid,uuid,boolean)','execute') then
   raise exception 'Archive RPC exposed'; end if;
end $$;
set local role service_role;
do $$begin
 begin perform public.crm_archive_user('11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111',false);raise exception 'Self removal accepted';exception when insufficient_privilege then null;end;
 begin perform public.crm_archive_user('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111',false);raise exception 'Member removal accepted';exception when insufficient_privilege then null;end;
 begin perform public.crm_archive_user('11111111-1111-4111-8111-111111111111','99999999-9999-4999-8999-999999999999',false);raise exception 'Missing target accepted';exception when no_data_found then null;end;
end $$;
select public.crm_archive_user('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222',false);
reset role;
do $$begin
 if not exists(select 1 from public.profiles where id='22222222-2222-4222-8222-222222222222' and not is_active and deletion_requested_at is not null and deleted_at is null) then raise exception 'Stage one failed';end if;
end $$;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
set local role authenticated;
do $$begin
 if private.crm_can('customers','view') then raise exception 'Removed user retained CRM access'; end if;
 begin update public.profiles set deleted_at=now() where id='22222222-2222-4222-8222-222222222222';raise exception 'Direct archive accepted';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
set local role authenticated;
do $$begin
 begin update public.profiles set is_active=true where id='22222222-2222-4222-8222-222222222222';raise exception 'Reactivation accepted';exception when insufficient_privilege then null;end;
 begin delete from public.profiles where id='22222222-2222-4222-8222-222222222222';raise exception 'Physical deletion accepted';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role service_role;
select public.crm_archive_user('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222',false);
select public.crm_archive_user('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222',true);
select public.crm_archive_user('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222',true);
reset role;
do $$begin
 if not exists(select 1 from public.profiles where id='22222222-2222-4222-8222-222222222222' and not is_active and deleted_at is not null and deleted_by='11111111-1111-4111-8111-111111111111') then raise exception 'Finalization failed';end if;
 if not exists(select 1 from archive_history where owner_id='22222222-2222-4222-8222-222222222222') then raise exception 'Work history lost';end if;
 if exists(select id from archive_auth_before except select id from auth.users) then raise exception 'Auth history lost';end if;
end $$;
rollback;

