create or replace function private.crm_lead_assignees()
returns table(id uuid, display_name text, department_group text, is_active boolean)
language plpgsql stable security definer set search_path = ''
as $$
begin
 if auth.uid() is null or not private.crm_can('leads','assign') or not private.crm_can('leads','edit') then
  raise exception 'Lead assignment permission required' using errcode='42501';
 end if;
 return query select p.id,p.display_name,p.department_group,p.is_active
 from public.profiles p
 where p.is_active=true and p.deleted_at is null and lower(trim(p.department_group))='sales'
 order by p.display_name,p.id;
end;
$$;
revoke all on function private.crm_lead_assignees() from public,anon;
grant execute on function private.crm_lead_assignees() to authenticated;
create or replace function public.crm_lead_assignees()
returns table(id uuid, display_name text, department_group text, is_active boolean)
language sql stable security invoker set search_path = ''
as $$ select * from private.crm_lead_assignees(); $$;
revoke all on function public.crm_lead_assignees() from public,anon;
grant execute on function public.crm_lead_assignees() to authenticated;