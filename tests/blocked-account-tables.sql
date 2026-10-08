begin;
create temp table qa_blocked_results(result text,checks integer,tables integer,states integer);
do $$
declare actor uuid:=gen_random_uuid();supervisor uuid;r record;state integer;visible_rows bigint;n integer:=0;table_count integer;
begin
 select id into strict supervisor from public.profiles where is_super_admin and private.crm_active_user(id) limit 1;
 perform set_config('request.jwt.claim.sub',supervisor::text,true);
 update public.role_permissions set can_view=true,can_create=true,can_edit=true,can_delete=true,can_import=true,can_export=true,can_approve=true,can_assign=true,can_manage_settings=true where role_key='sales_user';
 select count(distinct tablename) into table_count from pg_policies where schemaname='public' and permissive='RESTRICTIVE' and qual like '%crm_active_user%';
 if table_count<60 then raise exception 'Missing active-account boundaries: %',table_count;end if;
 for state in 1..5 loop
  actor:=gen_random_uuid();
 insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data) values(actor,'authenticated','authenticated','qa-permissions-'||actor||'@example.invalid','{"provider":"email"}','{}');
 insert into public.profiles(id,email,role,is_active,is_super_admin) values(actor,'qa-permissions@example.invalid','sales_user',true,false);
 insert into public.crm_user_onboarding(user_id,requires_password,completed_at,invited_by) values(actor,false,now(),supervisor);
  if state=1 then update public.profiles set is_active=false where id=actor;
  elsif state=2 then update public.profiles set is_active=false,deleted_at=now(),deletion_requested_at=now() where id=actor;
  elsif state=3 then update auth.users set banned_until=now()+interval '1 hour' where id=actor;
  elsif state=4 then update auth.users set deleted_at=now() where id=actor;
  else update public.crm_user_onboarding set completed_at=null where user_id=actor;
  end if;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  for r in select distinct tablename from pg_policies where schemaname='public' and permissive='RESTRICTIVE' and qual like '%crm_active_user%' loop
   execute 'set local role authenticated';
   begin
    execute format('select count(*) from public.%I',r.tablename) into visible_rows;
   exception when insufficient_privilege then visible_rows:=0;end;
   if visible_rows<>0 then raise exception 'Blocked state % exposes % rows in %',state,visible_rows,r.tablename;end if;
   execute 'reset role';n:=n+1;
  end loop;
  execute 'set local role authenticated';
  if (public.crm_access_context()->>'active')::boolean then raise exception 'Blocked access context accepted';end if;
  execute 'reset role';
  perform set_config('request.jwt.claim.sub',supervisor::text,true);
 end loop;
 insert into qa_blocked_results values('PASS',n,table_count,5);
end $$;
select * from qa_blocked_results;
rollback;
