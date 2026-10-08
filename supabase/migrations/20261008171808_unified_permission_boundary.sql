-- One authorization boundary; no changes to customer data or role grants.
create or replace function private.crm_active_user(p_actor uuid default auth.uid()) returns boolean
language sql stable security definer set search_path='' as $$
 select p_actor is not null and exists(select 1 from public.profiles p join auth.users u on u.id=p.id
 where p.id=p_actor and p.is_active and p.deleted_at is null and p.deletion_requested_at is null
 and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())
 and not exists(select 1 from public.crm_user_onboarding o where o.user_id=p.id and o.completed_at is null))
$$;
revoke all on function private.crm_active_user(uuid) from public,anon;
grant execute on function private.crm_active_user(uuid) to authenticated,service_role;
create or replace function private.crm_is_super_admin() returns boolean
language sql stable security definer set search_path='' as $$
 select private.crm_active_user() and exists(select 1 from public.profiles where id=auth.uid() and is_super_admin)
$$;
revoke all on function private.crm_is_super_admin() from public,anon;
grant execute on function private.crm_is_super_admin() to authenticated,service_role;
create or replace function private.crm_is_admin() returns boolean
language sql stable security definer set search_path='' as $$ select private.crm_is_super_admin() $$;
create or replace function private.crm_can(p_module text,p_action text) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare p public.profiles; allowed boolean;
begin
 if not private.crm_active_user() then return false; end if;
 if p_action not in ('view','create','edit','delete','export','approve','assign','import','manage_settings') or p_module not in ('dashboard','leads','customers','contacts','opportunities','quotations','contracts','assets','tickets','activities','documents','reports','ai','settings','inventory','access') then return false; end if;
 select * into p from public.profiles where id=auth.uid();
 if p.is_super_admin then return true; end if;
 if p_module='access' then return false; end if;
 select coalesce((to_jsonb(r)->>('can_'||p_action))::boolean,false) into allowed from public.role_permissions r
 where r.role_key=case when p.role='custom' then p.custom_role_key else p.role end and r.module=p_module;
 return coalesce(allowed,false);
end $$;
create or replace function public.crm_access_context() returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('active',private.crm_active_user(),'super_admin',private.crm_is_super_admin())
$$;
revoke all on function public.crm_access_context() from public,anon;
grant execute on function public.crm_access_context() to authenticated;
-- RPCs run under the caller; management policies are not delegated through Settings.
CREATE OR REPLACE FUNCTION public.crm_set_role_permissions(p_role text, p_rows jsonb, p_expected jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
 v_modules text[]:=array['dashboard','leads','customers','contacts','opportunities','quotations','contracts','assets','tickets','activities','documents','reports','ai','settings','inventory'];
 v_actions text[]:=array['view','create','edit','delete','export','approve','assign','import','manage_settings'];
 v_current jsonb; v_result jsonb; v_row jsonb; v_action text;
begin
 if not private.crm_is_super_admin() then raise exception 'Settings manage permission required' using errcode='42501'; end if;

 perform 1 from public.custom_roles where role_key=p_role for update;
 if not found then raise exception 'Unknown role'; end if;
 if jsonb_typeof(p_rows) is distinct from 'array' then raise exception 'Permissions must be an array'; end if;
 if jsonb_array_length(p_rows)<>15 or (select count(distinct value->>'module') from jsonb_array_elements(p_rows))<>15 then raise exception 'Exactly 15 distinct modules required'; end if;
 for v_row in select value from jsonb_array_elements(p_rows) loop
  if jsonb_typeof(v_row) is distinct from 'object' or not ((v_row->>'module')=any(v_modules)) then raise exception 'Unknown module'; end if;
  foreach v_action in array v_actions loop
   if jsonb_typeof(v_row->('can_'||v_action)) is distinct from 'boolean' then raise exception 'Every permission must be boolean'; end if;
  end loop;
 end loop;
 select jsonb_agg(jsonb_build_object('module',m)||
  (select jsonb_object_agg('can_'||a,coalesce(to_jsonb(r)->('can_'||a),'false'::jsonb)) from unnest(v_actions) a) order by m)
 into v_current from unnest(v_modules) m left join public.role_permissions r on r.module=m and r.role_key=p_role;
 if p_expected is null or v_current is distinct from (select jsonb_agg(value order by value->>'module') from jsonb_array_elements(p_expected)) then
  raise exception 'Permissions changed. Reload before saving.' using errcode='40001';
 end if;
 for v_row in select value from jsonb_array_elements(p_rows) loop
  insert into public.role_permissions(role_key,module,can_view,can_create,can_edit,can_delete,can_export,can_approve,can_assign,can_import,can_manage_settings,updated_at)
  values(p_role,v_row->>'module',(v_row->>'can_view')::boolean,(v_row->>'can_create')::boolean,(v_row->>'can_edit')::boolean,(v_row->>'can_delete')::boolean,(v_row->>'can_export')::boolean,(v_row->>'can_approve')::boolean,(v_row->>'can_assign')::boolean,(v_row->>'can_import')::boolean,(v_row->>'can_manage_settings')::boolean,clock_timestamp())
  on conflict(role_key,module) do update set can_view=excluded.can_view,can_create=excluded.can_create,can_edit=excluded.can_edit,can_delete=excluded.can_delete,can_export=excluded.can_export,can_approve=excluded.can_approve,can_assign=excluded.can_assign,can_import=excluded.can_import,can_manage_settings=excluded.can_manage_settings,updated_at=excluded.updated_at;
 end loop;
 select jsonb_agg(jsonb_build_object('module',m)||
  (select jsonb_object_agg('can_'||a,coalesce(to_jsonb(r)->('can_'||a),'false'::jsonb)) from unnest(v_actions) a) order by m)
 into v_result from unnest(v_modules) m join public.role_permissions r on r.module=m and r.role_key=p_role;
 insert into public.audit_logs(user_id,action,module,category,changes) values(auth.uid(),'update','settings','permission_change',jsonb_build_object('role_key',p_role,'before',v_current,'permissions',v_result));
 return v_result;
end $function$
;
CREATE OR REPLACE FUNCTION public.crm_save_permissions(p_role text, p_rows jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE item jsonb; n integer=0;
BEGIN
 IF NOT private.crm_is_super_admin() THEN RAISE EXCEPTION 'Admin required' USING ERRCODE='42501'; END IF;

 IF NOT EXISTS(SELECT 1 FROM public.custom_roles WHERE role_key=p_role) THEN RAISE EXCEPTION 'Unknown role'; END IF;
 IF jsonb_typeof(p_rows)<>'array' OR jsonb_array_length(p_rows)>30 THEN RAISE EXCEPTION 'Invalid permission matrix'; END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
  IF item->>'module' NOT IN ('dashboard','leads','customers','contacts','opportunities','quotations','contracts','assets','tickets','activities','documents','reports','ai','settings') THEN RAISE EXCEPTION 'Unknown module'; END IF;
  INSERT INTO public.role_permissions(role_key,module,can_view,can_create,can_edit,can_delete,can_export,can_approve,can_assign,can_import,can_manage_settings)
  VALUES(p_role,item->>'module',coalesce((item->>'can_view')::boolean,false),coalesce((item->>'can_create')::boolean,false),coalesce((item->>'can_edit')::boolean,false),coalesce((item->>'can_delete')::boolean,false),coalesce((item->>'can_export')::boolean,false),coalesce((item->>'can_approve')::boolean,false),coalesce((item->>'can_assign')::boolean,false),coalesce((item->>'can_import')::boolean,false),coalesce((item->>'can_manage_settings')::boolean,false))
  ON CONFLICT(role_key,module) DO UPDATE SET can_view=EXCLUDED.can_view,can_create=EXCLUDED.can_create,can_edit=EXCLUDED.can_edit,can_delete=EXCLUDED.can_delete,can_export=EXCLUDED.can_export,can_approve=EXCLUDED.can_approve,can_assign=EXCLUDED.can_assign,can_import=EXCLUDED.can_import,can_manage_settings=EXCLUDED.can_manage_settings,updated_at=clock_timestamp();
  n=n+1;
 END LOOP;
 INSERT INTO public.audit_logs(user_id,action,module,category,changes) VALUES(auth.uid(),'update','settings','permission_change',jsonb_build_object('role_key',p_role,'permissions',p_rows));
 RETURN n;
END $function$
;

create or replace function private.crm_guard_profile_update() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if not private.crm_is_super_admin() then
  if old.id is distinct from auth.uid() then raise insufficient_privilege using message='Super Admin required'; end if;
  if (to_jsonb(new)-array['display_name','first_name','last_name','phone','job_title','avatar_path','company_name','document_department','employee_code','contact_email','line_id','updated_at','two_factor_enabled'])
   is distinct from (to_jsonb(old)-array['display_name','first_name','last_name','phone','job_title','avatar_path','company_name','document_department','employee_code','contact_email','line_id','updated_at','two_factor_enabled'])
  then raise insufficient_privilege using message='Protected user fields require Super Admin'; end if;
 end if;
 new.updated_at:=now(); return new;
end $$;
alter policy crm_profiles_upd on public.profiles using ((id=auth.uid() and private.crm_active_user()) or private.crm_is_super_admin()) with check ((id=auth.uid() and private.crm_active_user()) or private.crm_is_super_admin());
alter policy crm_settings_ins on public.role_permissions with check (private.crm_is_super_admin());
alter policy crm_settings_upd on public.role_permissions using (private.crm_is_super_admin()) with check (private.crm_is_super_admin());
alter policy crm_settings_del on public.role_permissions using (private.crm_is_super_admin());
alter policy crm_settings_sel on public.role_permissions using (private.crm_is_super_admin());
create policy crm_active_boundary on public.role_permissions as restrictive for all to authenticated using (private.crm_active_user()) with check (private.crm_active_user());
alter policy crm_settings_ins on public.custom_roles with check (private.crm_is_super_admin());
alter policy crm_settings_upd on public.custom_roles using (private.crm_is_super_admin()) with check (private.crm_is_super_admin());
alter policy crm_settings_del on public.custom_roles using (private.crm_is_super_admin());
alter policy crm_settings_sel on public.custom_roles using (private.crm_is_super_admin());
create policy crm_active_boundary on public.custom_roles as restrictive for all to authenticated using (private.crm_active_user()) with check (private.crm_active_user());
alter policy crm_settings_ins on public.dashboard_type_access with check (private.crm_is_super_admin());
alter policy crm_settings_upd on public.dashboard_type_access using (private.crm_is_super_admin()) with check (private.crm_is_super_admin());
alter policy crm_settings_del on public.dashboard_type_access using (private.crm_is_super_admin());
alter policy crm_settings_sel on public.dashboard_type_access using (private.crm_is_super_admin());
create policy crm_active_boundary on public.dashboard_type_access as restrictive for all to authenticated using (private.crm_active_user()) with check (private.crm_active_user());

do $do$ declare r record; begin
 for r in select tablename from pg_tables where schemaname='public' and (tablename like 'crm_%' or tablename in ('customers','contacts','leads','opportunities','quotations','contracts','assets','asset_attachments','tickets','activities','documents','scheduled_reports','report_export_jobs','ai_insights','master_data_items','notifications','audit_logs','company_settings','approval_rules','translations')) and tablename not in ('crm_user_onboarding','crm_access_invitations') loop
 execute format('create policy crm_active_boundary on public.%I as restrictive for all to authenticated using (private.crm_active_user()) with check (private.crm_active_user())',r.tablename);
 end loop;
 for r in select tablename from pg_tables where schemaname='public' and (tablename like 'crm_%' or tablename in ('profiles','role_permissions','custom_roles','dashboard_type_access','customers','contacts','leads','opportunities','quotations','contracts','assets','tickets','activities','documents','master_data_items')) loop
 execute format('revoke truncate,references,trigger on public.%I from anon,authenticated',r.tablename);
 end loop;
end $do$;
CREATE OR REPLACE FUNCTION private.crm_archive_user(p_actor uuid, p_target uuid, p_finalize boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare target public.profiles; actor public.profiles;
begin
 if p_actor is null or p_actor=p_target then
   raise exception 'Cannot remove your own account' using errcode='42501';
 end if;
 -- Serialize cross-admin removals, then lock actor and target against concurrent edits.
 perform pg_catalog.pg_advisory_xact_lock(71020261002);
 perform 1 from public.profiles where id in(p_actor,p_target) order by id for update;
 select * into actor from public.profiles where id=p_actor;
 if actor.id is null or not public.crm_actor_can(p_actor,'access','delete') or not actor.is_active or actor.deletion_requested_at is not null then
   raise exception 'Settings delete permission required' using errcode='42501';
 end if;
 select * into target from public.profiles where id=p_target;
 if target.id is null then raise exception 'User not found' using errcode='P0002'; end if;
 if target.deleted_at is not null then return jsonb_build_object('deleted',true); end if;
 -- Existing profile guards and audit triggers see the verified administrator.
 perform pg_catalog.set_config('request.jwt.claim.sub',p_actor::text,true);
 if p_finalize then
   if target.deletion_requested_at is null then raise exception 'Removal has not started'; end if;
   update public.profiles set deleted_at=clock_timestamp(),deleted_by=p_actor where id=p_target;
 else
   update public.profiles set is_active=false,
     deletion_requested_at=coalesce(deletion_requested_at,clock_timestamp()),deleted_by=p_actor
     where id=p_target;
 end if;
 return jsonb_build_object('deleted',p_finalize);
end $function$
;
CREATE OR REPLACE FUNCTION public.crm_prepare_invitation(p_email text, p_actor uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare uid uuid;
begin
 if auth.role()<>'service_role' then raise exception 'Service role required'; end if;
 if not public.crm_actor_can(p_actor,'access','create') then raise exception 'Settings create permission required'; end if;
 if p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid email'; end if;
 select id into uid from auth.users where lower(email)=lower(trim(p_email));
 if exists(select 1 from public.profiles p where p.id=uid and (not p.is_active or p.deleted_at is not null or p.deletion_requested_at is not null)) then raise exception 'Account is disabled'; end if;
 if exists(select 1 from public.profiles p where p.id=uid and p.role='admin') then raise exception 'Administrator already has access'; end if;
 if exists(select 1 from public.crm_user_onboarding o where o.user_id=uid and o.completed_at is not null) then raise exception 'User already completed onboarding'; end if;
 insert into public.crm_access_invitations(email,invited_by) values(lower(trim(p_email)),p_actor) on conflict(email) do update set invited_by=excluded.invited_by,status='prepared';
 if uid is not null then
  insert into public.profiles(id,email,display_name,role,department_group,is_active) values(uid,lower(trim(p_email)),split_part(p_email,'@',1),'sales_user','Sales',true) on conflict do nothing;
  insert into public.crm_user_onboarding(user_id,requires_password,invited_by) select uid,not exists(select 1 from auth.identities where user_id=uid and provider='azure') and not exists(select 1 from auth.users where id=uid and coalesce(encrypted_password,'')<>''),p_actor on conflict do nothing;
 end if;
 return uid;
end $function$
;
CREATE OR REPLACE FUNCTION public.crm_save_dashboard_access(p_role text, p_rows jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE item jsonb; n integer=0;
BEGIN
 IF NOT private.crm_is_super_admin() THEN RAISE EXCEPTION 'Settings manage permission required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.custom_roles WHERE role_key=p_role) THEN RAISE EXCEPTION 'Role is protected or unknown'; END IF;
 IF jsonb_typeof(p_rows)<>'array' OR jsonb_array_length(p_rows)<>8 THEN RAISE EXCEPTION 'Eight dashboard types are required'; END IF;
 IF (SELECT count(DISTINCT x->>'dashboard_type') FROM jsonb_array_elements(p_rows) x)<>8 THEN RAISE EXCEPTION 'Duplicate dashboard type'; END IF;
 IF (SELECT count(*) FROM jsonb_array_elements(p_rows) x WHERE (x->>'is_default')::boolean)<>1 THEN RAISE EXCEPTION 'Choose exactly one default dashboard'; END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
  IF item->>'dashboard_type' NOT IN ('my','sales','manager','exec','service','renewal','admin','ai') THEN RAISE EXCEPTION 'Unknown dashboard'; END IF;
  IF coalesce((item->>'is_default')::boolean,false) AND NOT coalesce((item->>'visible')::boolean,false) THEN RAISE EXCEPTION 'Default dashboard must be visible'; END IF;
  INSERT INTO public.dashboard_type_access(role_key,dashboard_type,visible,is_default) VALUES(p_role,item->>'dashboard_type',coalesce((item->>'visible')::boolean,false),coalesce((item->>'is_default')::boolean,false))
  ON CONFLICT(role_key,dashboard_type) DO UPDATE SET visible=EXCLUDED.visible,is_default=EXCLUDED.is_default,updated_at=clock_timestamp();n=n+1;
 END LOOP;
 INSERT INTO public.audit_logs(user_id,action,module,category,changes) VALUES(auth.uid(),'update','settings','permission_change',jsonb_build_object('role_key',p_role,'dashboard_access',p_rows));RETURN n;
END $function$
;

-- Export is an explicit operation; table reads remain governed by View RLS.
create or replace function public.crm_export_records(p_table text,p_offset integer default 0,p_limit integer default 500) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare m text; result jsonb;
begin
 m:=case when p_table='master_data_items' then 'settings' else p_table end;
 if p_table not in ('customers','contacts','leads','master_data_items') or not private.crm_can(m,'export') then raise insufficient_privilege using message='Export permission required'; end if;
 if p_offset<0 or p_limit not between 1 and 500 then raise exception 'Invalid pagination'; end if;
 execute format('select coalesce(jsonb_agg(to_jsonb(r)),''[]''::jsonb) from (select * from public.%I order by id offset $1 limit $2) r',p_table) into result using p_offset,p_limit;
 return result;
end $$;
revoke all on function public.crm_export_records(text,integer,integer) from public,anon;
grant execute on function public.crm_export_records(text,integer,integer) to authenticated;
-- Assignment is not an ordinary edit. Prevent direct PATCH from bypassing Assign.
create or replace function private.crm_assignment_guard() returns trigger
language plpgsql set search_path='' as $$
declare key text; old_value jsonb; new_value jsonb;
begin
 if auth.uid() is null then return new; end if;
 foreach key in array tg_argv loop
  old_value:=case when tg_op='INSERT' then to_jsonb(auth.uid()) else to_jsonb(old)->key end;
  new_value:=to_jsonb(new)->key;
  if new_value is distinct from old_value and new_value is not null and new_value<>'null'::jsonb and not private.crm_can(tg_table_name,'assign') then raise insufficient_privilege using message='Assignment permission required'; end if;
 end loop;
 return new;
end $$;
create trigger crm_assignment_permission before insert or update on public.leads for each row execute function private.crm_assignment_guard('owner_id','assigned_to_id');
create trigger crm_assignment_permission before insert or update on public.opportunities for each row execute function private.crm_assignment_guard('owner_id');
-- Transaction assertions: management must not be reachable via a delegated Settings grant.
do $$ declare actor uuid; begin
 select id into actor from public.profiles where is_super_admin and is_active and deleted_at is null limit 1;
 if actor is null then raise exception 'No active Super Admin; migration refused'; end if;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 if not private.crm_is_super_admin() or not private.crm_can('access','manage_settings') then raise exception 'Super Admin access regression'; end if;
 for actor in select id from public.profiles where not is_super_admin loop
  perform set_config('request.jwt.claim.sub',actor::text,true);
  if private.crm_can('access','manage_settings') then raise exception 'Non-Super Admin elevation'; end if;
 end loop;
 perform set_config('request.jwt.claim.sub','',true);
 if private.crm_can('customers','view') then raise exception 'Anonymous access regression'; end if;
end $$;
