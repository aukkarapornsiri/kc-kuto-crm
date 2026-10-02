-- Preserve historical ownership. Removal is a two-stage, retryable operation.
alter table public.profiles add column deletion_requested_at timestamptz;
alter table public.profiles add column deleted_at timestamptz;
alter table public.profiles add column deleted_by uuid;
alter table public.profiles add constraint crm_archived_user_inactive
 check (deletion_requested_at is null or is_active = false);

create function private.crm_guard_user_archive() returns trigger
language plpgsql set search_path='' as $$
begin
 if current_user not in ('postgres','supabase_admin') and
   (new.deletion_requested_at is distinct from old.deletion_requested_at or
    new.deleted_at is distinct from old.deleted_at or new.deleted_by is distinct from old.deleted_by) then
   raise exception 'Archive fields are managed by the user administration service' using errcode='42501';
 end if;
 if old.deletion_requested_at is not null and new.is_active then
   raise exception 'A removed user cannot be reactivated' using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function private.crm_guard_user_archive() from public,anon,authenticated;
create trigger crm_guard_user_archive before update on public.profiles
 for each row execute function private.crm_guard_user_archive();

-- Only the authenticated Edge Function may supply an actor. Browser RPC access is denied.
create function private.crm_archive_user(p_actor uuid,p_target uuid,p_finalize boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare target public.profiles; actor public.profiles;
begin
 if p_actor is null or p_actor=p_target then
   raise exception 'Cannot remove your own account' using errcode='42501';
 end if;
 -- Serialize cross-admin removals, then lock actor and target against concurrent edits.
 perform pg_catalog.pg_advisory_xact_lock(71020261002);
 perform 1 from public.profiles where id in(p_actor,p_target) order by id for update;
 select * into actor from public.profiles where id=p_actor;
 if actor.id is null or actor.role<>'admin' or not actor.is_active or actor.deletion_requested_at is not null then
   raise exception 'Active administrator required' using errcode='42501';
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
end $$;
revoke all on function private.crm_archive_user(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function private.crm_archive_user(uuid,uuid,boolean) to service_role;
create function public.crm_archive_user(p_actor uuid,p_target uuid,p_finalize boolean default false)
returns jsonb language sql security invoker set search_path='' as $$
 select private.crm_archive_user(p_actor,p_target,p_finalize);
$$;
revoke all on function public.crm_archive_user(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.crm_archive_user(uuid,uuid,boolean) to service_role;
grant usage on schema private to service_role;

-- Direct physical deletion would break historical references and bypass the archive flow.
drop policy if exists crm_profiles_del on public.profiles;
revoke delete on public.profiles from authenticated;
