create or replace function public.crm_prepare_invitation(p_email text,p_actor uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid;
begin
 if auth.role()<>'service_role' then raise exception 'Service role required'; end if;
 if not exists(select 1 from public.profiles where id=p_actor and role='admin' and is_active) then raise exception 'Admin required'; end if;
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
end $$;
revoke all on function public.crm_prepare_invitation(text,uuid) from public,anon,authenticated;
grant execute on function public.crm_prepare_invitation(text,uuid) to service_role;
