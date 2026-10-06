begin;
alter table public.profiles add column if not exists is_super_admin boolean not null default false;
update public.profiles set is_super_admin=true where id='d2dfa3ed-b941-4699-be10-507c7a99b373' and lower(email)='monchai@kai-com.com' and role='admin';
create function private.crm_guard_super_admin() returns trigger language plpgsql set search_path='' as $$
begin
 if new.is_super_admin is distinct from old.is_super_admin then raise exception 'Super Admin assignment is managed separately'; end if;
 if old.is_super_admin and (new.role<>'admin' or not new.is_active or new.email is distinct from old.email or new.deleted_at is not null or new.deletion_requested_at is not null) then raise exception 'Cannot disable or change the Super Admin account'; end if;
 return new;
end $$;
create trigger crm_guard_super_admin before update on public.profiles for each row execute function private.crm_guard_super_admin();
create table public.crm_access_invitations(email text primary key, invited_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), last_sent_at timestamptz, status text not null default 'prepared' check(status in ('prepared','sent','failed')), check(email=lower(trim(email))));
alter table public.crm_access_invitations enable row level security;
grant select on public.crm_access_invitations to authenticated;
grant all on public.crm_access_invitations to service_role;
create policy crm_invites_admin_read on public.crm_access_invitations for select to authenticated using(private.crm_is_admin());
create table public.crm_user_onboarding(user_id uuid primary key references public.profiles(id) on delete cascade, requires_password boolean not null default true, personal_details jsonb not null default '{}'::jsonb, completed_at timestamptz, invited_by uuid references public.profiles(id), created_at timestamptz not null default now());
alter table public.crm_user_onboarding enable row level security;
grant select on public.crm_user_onboarding to authenticated;
grant all on public.crm_user_onboarding to service_role;
create policy crm_onboarding_read on public.crm_user_onboarding for select to authenticated using(user_id=auth.uid() or private.crm_is_admin());
-- Only an explicit invitation creates CRM membership; other applications share Auth.
create or replace function private.crm_sync_new_auth_user() returns trigger language plpgsql security definer set search_path='' as $$
declare inviter uuid;
begin
 select invited_by into inviter from public.crm_access_invitations where email=lower(new.email);
 if inviter is null then return new; end if;
 insert into public.profiles(id,email,display_name,role,department_group,is_active) values(new.id,new.email,split_part(new.email,'@',1),'sales_user','Sales',true) on conflict(id) do nothing;
 insert into public.crm_user_onboarding(user_id,requires_password,invited_by) values(new.id,coalesce(new.raw_app_meta_data->>'provider','email')<>'azure',inviter) on conflict do nothing;
 return new;
end $$;
-- Service-only provisioning also supports already registered Microsoft identities.
create function public.crm_prepare_invitation(p_email text,p_actor uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid;
begin
 if auth.role()<>'service_role' then raise exception 'Service role required'; end if;
 if not exists(select 1 from public.profiles where id=p_actor and role='admin' and is_active) then raise exception 'Admin required'; end if;
 if p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid email'; end if;
 select id into uid from auth.users where lower(email)=lower(trim(p_email));
 if exists(select 1 from public.profiles p where p.id=uid and (not p.is_active or p.deleted_at is not null or p.deletion_requested_at is not null)) then raise exception 'Account is disabled'; end if;
 if exists(select 1 from public.profiles p where p.id=uid) and not exists(select 1 from public.crm_user_onboarding o where o.user_id=uid and o.completed_at is null) then raise exception 'User already has CRM access'; end if;
 insert into public.crm_access_invitations(email,invited_by) values(lower(trim(p_email)),p_actor) on conflict(email) do update set invited_by=excluded.invited_by,status='prepared';
 if uid is not null then
  insert into public.profiles(id,email,display_name,role,department_group,is_active) values(uid,lower(trim(p_email)),split_part(p_email,'@',1),'sales_user','Sales',true) on conflict do nothing;
  insert into public.crm_user_onboarding(user_id,requires_password,invited_by) select uid,not exists(select 1 from auth.identities where user_id=uid and provider='azure'),p_actor on conflict do nothing;
 end if;
 return uid;
end $$;
revoke all on function public.crm_prepare_invitation(text,uuid) from public,anon,authenticated;
grant execute on function public.crm_prepare_invitation(text,uuid) to service_role;
create function public.crm_complete_onboarding(p_details jsonb) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); clean jsonb;
begin
 if uid is null or not exists(select 1 from auth.users where id=uid and email_confirmed_at is not null) then raise exception 'Verified account required'; end if;
 if not exists(select 1 from public.profiles where id=uid and is_active) then raise exception 'Account disabled'; end if;
 if not exists(select 1 from public.crm_user_onboarding where user_id=uid and completed_at is null) then raise exception 'No pending invitation'; end if;
 if exists(select 1 from public.crm_user_onboarding o join auth.users u on u.id=o.user_id where o.user_id=uid and o.requires_password and coalesce(u.encrypted_password,'')='') then raise exception 'Set a password first'; end if;
 clean:=jsonb_build_object('first_name',trim(coalesce(p_details->>'first_name','')),'last_name',trim(coalesce(p_details->>'last_name','')),'phone',trim(coalesce(p_details->>'phone','')),'job_title',trim(coalesce(p_details->>'job_title','')));
 if clean->>'first_name'='' or clean->>'last_name'='' or exists(select 1 from jsonb_each_text(clean) where length(value)>150) then raise exception 'Name required; maximum 150 characters per field'; end if;
 update public.crm_user_onboarding set personal_details=clean,completed_at=now() where user_id=uid;
 update public.profiles set first_name=clean->>'first_name',last_name=clean->>'last_name',display_name=(clean->>'first_name')||' '||(clean->>'last_name') where id=uid;
end $$;
revoke all on function public.crm_complete_onboarding(jsonb) from public,anon;
grant execute on function public.crm_complete_onboarding(jsonb) to authenticated;
-- Gate existing CRM policies at their shared permission helpers.
create or replace function private.crm_is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin' and p.is_active and not exists(select 1 from public.crm_user_onboarding o where o.user_id=p.id and o.completed_at is null))
$$;
create or replace function private.crm_can(p_module text,p_action text) returns boolean language plpgsql stable security definer set search_path='' as $$
declare v_role text; v_custom text; v_key text; v_allowed boolean:=false;
begin
 if auth.uid() is null or exists(select 1 from public.crm_user_onboarding where user_id=auth.uid() and completed_at is null) then return false; end if;
 select role,custom_role_key into v_role,v_custom from public.profiles where id=auth.uid() and is_active=true;
 if v_role is null then return false; end if;
 if v_role='admin' then return true; end if;
 v_key:=case when v_role='custom' then v_custom else v_role end;
 select case p_action when 'view' then can_view when 'create' then can_create when 'edit' then can_edit when 'delete' then can_delete when 'export' then can_export when 'approve' then can_approve when 'assign' then can_assign when 'import' then can_import when 'manage_settings' then can_manage_settings else false end into v_allowed from public.role_permissions where role_key=v_key and module=p_module;
 return coalesce(v_allowed,false);
end $$;
commit;
