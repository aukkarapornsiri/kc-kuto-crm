alter table public.profiles add column first_name text;
alter table public.profiles add column last_name text;

-- Existing names remain untouched until edited. Legacy clients can still use display_name.
create function private.crm_sync_profile_names() returns trigger
language plpgsql set search_path='' as $$
declare names_changed boolean;
begin
 if tg_op='INSERT' then
   names_changed := new.first_name is not null or new.last_name is not null;
 else
   names_changed := new.first_name is distinct from old.first_name or new.last_name is distinct from old.last_name;
 end if;
 if names_changed then
   new.first_name := btrim(coalesce(new.first_name,''));
   new.last_name := btrim(coalesce(new.last_name,''));
   if new.first_name='' then raise exception 'First name is required' using errcode='23514'; end if;
   if length(new.first_name)>2000 or length(new.last_name)>2000 then raise exception 'Name is too long' using errcode='23514'; end if;
   new.display_name := new.first_name || case when new.last_name<>'' then ' '||new.last_name else '' end;
 elsif tg_op='UPDATE' then
   if new.display_name is distinct from old.display_name then
     new.first_name:=null; new.last_name:=null;
   end if;
 end if;
 return new;
end $$;
revoke all on function private.crm_sync_profile_names() from public,anon,authenticated;
create trigger zz_crm_sync_profile_names before insert or update on public.profiles
 for each row execute function private.crm_sync_profile_names();
