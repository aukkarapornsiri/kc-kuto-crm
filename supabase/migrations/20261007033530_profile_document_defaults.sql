-- Personal contact details are distinct from authorization department_group.
alter table public.profiles
 add column if not exists company_name text not null default '',
 add column if not exists document_department text not null default '',
 add column if not exists employee_code text not null default '',
 add column if not exists contact_email text not null default '',
 add column if not exists line_id text not null default '';
alter table public.profiles add constraint crm_personal_contact_bounds check (
 length(company_name)<=150 and length(document_department)<=150 and length(employee_code)<=150
 and length(contact_email)<=150 and length(line_id)<=150
 and (contact_email='' or contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'));
-- Job title is descriptive only. Retain the existing protections on all access fields.
create or replace function private.crm_guard_profile_update()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not private.crm_is_admin() then
   if old.id<>auth.uid() then raise exception 'Not allowed'; end if;
   new.id:=old.id; new.email:=old.email; new.role:=old.role; new.department_group:=old.department_group;
   new.manager_id:=old.manager_id; new.is_active:=old.is_active;
   new.custom_role_key:=old.custom_role_key; new.created_at:=old.created_at;
 end if;
 new.updated_at:=now(); return new;
end $$;
update storage.buckets set file_size_limit=5242880 where id='crm-profile-photos';

create or replace function private.crm_document_profile_defaults()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.document_profile is null and auth.uid() is not null then
  select jsonb_build_object('name',p.display_name,'first_name',coalesce(p.first_name,''),'last_name',coalesce(p.last_name,''),
   'company_name',p.company_name,'phone',p.phone,'job_title',coalesce(p.job_title,''),
   'department',coalesce(nullif(p.document_department,''),p.department_group,''),'employee_code',p.employee_code,
   'email',coalesce(nullif(p.contact_email,''),p.email,''),'line_id',p.line_id)
  into new.document_profile from public.profiles p where p.id=auth.uid();
 end if;
 return new;
end $$;
revoke all on function private.crm_document_profile_defaults() from public,anon,authenticated;
-- Only INSERT initializes defaults. Existing documents retain their historical snapshot.
do $$ declare target text; begin
 foreach target in array array['quotations','contracts','documents','tickets','crm_stock_movements'] loop
  execute format('alter table public.%I add column if not exists document_profile jsonb',target);
  execute format('alter table public.%I add constraint %I check(document_profile is null or (jsonb_typeof(document_profile)=''object'' and pg_column_size(document_profile)<=16384))',target,target||'_document_profile_valid');
  execute format('create trigger crm_document_profile_on_insert before insert on public.%I for each row execute function private.crm_document_profile_defaults()',target);
 end loop;
end $$;
