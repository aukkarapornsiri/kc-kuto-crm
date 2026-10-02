-- Isolated test fixture; these users do not exist in production.
create schema auth; create schema private;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table public.profiles(id uuid primary key,role text,custom_role_key text,is_active boolean);
create table public.custom_roles(role_key text primary key);
create table public.role_permissions(role_key text references public.custom_roles,module text,can_view boolean default false,can_create boolean default false,can_edit boolean default false,can_delete boolean default false,can_export boolean default false,can_approve boolean default false,can_assign boolean default false,can_import boolean default false,can_manage_settings boolean default false,updated_at timestamptz default now(),primary key(role_key,module));
create table public.dashboard_type_access(role_key text,dashboard_type text,visible boolean,is_default boolean);
create table public.audit_logs(user_id uuid,action text,module text,category text,changes jsonb);
create table public.customers(id int primary key,name text);
grant usage on schema public,private,auth to authenticated;
grant select,insert,update,delete on all tables in schema public to authenticated;
CREATE OR REPLACE FUNCTION private.crm_can(p_module text, p_action text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_role text; v_custom text; v_key text; v_allowed boolean:=false;
begin
 if auth.uid() is null then return false; end if;
 select role,custom_role_key into v_role,v_custom from public.profiles where id=auth.uid() and is_active=true;
 if v_role is null then return false; end if;
 if v_role='admin' then return true; end if;
 v_key:=case when v_role='custom' then v_custom else v_role end;
 select case p_action
  when 'view' then can_view when 'create' then can_create when 'edit' then can_edit when 'delete' then can_delete
  when 'export' then can_export when 'approve' then can_approve when 'assign' then can_assign when 'import' then can_import
  when 'manage_settings' then can_manage_settings else false end
 into v_allowed from public.role_permissions where role_key=v_key and module=p_module;
 return coalesce(v_allowed,false);
end $function$;

CREATE OR REPLACE FUNCTION private.crm_is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
 select exists(select 1 from public.profiles where id=auth.uid() and role='admin' and is_active=true)
$function$;

alter table profiles enable row level security;
create policy profiles_read on profiles for select to authenticated using(id=auth.uid() or private.crm_is_admin());
alter table role_permissions enable row level security;
create policy permission_admin on role_permissions for all to authenticated using(private.crm_is_admin()) with check(private.crm_is_admin());
alter table custom_roles enable row level security;
create policy role_admin on custom_roles for all to authenticated using(private.crm_is_admin()) with check(private.crm_is_admin());
alter table dashboard_type_access enable row level security;
create policy dashboard_admin on dashboard_type_access for all to authenticated using(private.crm_is_admin()) with check(private.crm_is_admin());
alter table audit_logs enable row level security;
create policy audit_insert on audit_logs for insert to authenticated with check(user_id=auth.uid());
create policy audit_select on audit_logs for select to authenticated using(private.crm_is_admin());
alter table customers enable row level security;
create policy crm_sel on customers for select to authenticated using(private.crm_can('customers','view'));
create policy crm_upd on customers for update to authenticated using(private.crm_can('customers','edit')) with check(private.crm_can('customers','edit'));
insert into profiles values('11111111-1111-4111-8111-111111111111','admin',null,true),('22222222-2222-4222-8222-222222222222','custom','qa_support',true),('33333333-3333-4333-8333-333333333333','custom','qa_support',false);
insert into custom_roles values('admin'),('qa_support'),('other');
insert into role_permissions(role_key,module,can_view) values('qa_support','customers',true),('other','customers',true);
insert into dashboard_type_access values('qa_support','my',true,true),('other','exec',true,true);
insert into customers values(1,'QA customer');
