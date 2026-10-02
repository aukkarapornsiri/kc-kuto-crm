-- Active users may read their own access configuration without Settings access.
-- Existing administrator/settings reads and all write policies are retained.
create policy crm_own_role_read on public.role_permissions for select to authenticated
using (role_key = (select case when p.role='custom' then p.custom_role_key else p.role end from public.profiles p where p.id=(select auth.uid()) and p.is_active));
create policy crm_own_dashboard_read on public.dashboard_type_access for select to authenticated
using (role_key = (select case when p.role='custom' then p.custom_role_key else p.role end from public.profiles p where p.id=(select auth.uid()) and p.is_active));
create policy crm_own_role_label_read on public.custom_roles for select to authenticated
using (role_key = (select case when p.role='custom' then p.custom_role_key else p.role end from public.profiles p where p.id=(select auth.uid()) and p.is_active));

-- Full-matrix save with optimistic concurrency, atomic audit and server readback.
create function public.crm_set_role_permissions(p_role text,p_rows jsonb,p_expected jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 v_modules text[]:=array['dashboard','leads','customers','contacts','opportunities','quotations','contracts','assets','tickets','activities','documents','reports','ai','settings'];
 v_actions text[]:=array['view','create','edit','delete','export','approve','assign','import','manage_settings'];
 v_current jsonb; v_result jsonb; v_row jsonb; v_action text;
begin
 if not private.crm_is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
 if p_role='admin' then raise exception 'Administrator permissions are protected' using errcode='42501'; end if;
 perform 1 from public.custom_roles where role_key=p_role for update;
 if not found then raise exception 'Unknown role'; end if;
 if jsonb_typeof(p_rows) is distinct from 'array' then raise exception 'Permissions must be an array'; end if;
 if jsonb_array_length(p_rows)<>14 or (select count(distinct value->>'module') from jsonb_array_elements(p_rows))<>14 then raise exception 'Exactly 14 distinct modules required'; end if;
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
end $$;
revoke all on function public.crm_set_role_permissions(text,jsonb,jsonb) from public,anon;
grant execute on function public.crm_set_role_permissions(text,jsonb,jsonb) to authenticated;
