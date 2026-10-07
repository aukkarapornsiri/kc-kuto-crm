-- Dashboard planet metadata must include department so the UI can show Sales employees only.
create or replace function private.crm_get_sales_targets(p_year integer) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_plan public.crm_sales_target_plans%rowtype;v_all boolean;v_admin boolean;v_people jsonb;v_employees jsonb;v_months jsonb;v_scope text;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and is_active) or not (private.crm_can('dashboard','view') or private.crm_can('reports','view') or private.crm_can('settings','view')) then raise exception 'Access denied' using errcode='42501';end if;
 if p_year is null or p_year not between 2000 and 2200 then raise exception 'Invalid plan year';end if;
 v_all:=private.crm_target_all_access();v_admin:=private.crm_is_admin();
 select * into v_plan from public.crm_sales_target_plans where plan_year=p_year;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name,'active',p.is_active,'department_group',p.department_group) order by p.display_name,p.id),'[]'::jsonb) into v_people from public.profiles p where private.crm_target_person_access(p.id) and (p.is_active or exists(select 1 from public.crm_sales_employee_targets e where e.plan_id=v_plan.id and e.profile_id=p.id));
 select coalesce(jsonb_agg(jsonb_build_object('profile_id',e.profile_id,'name',p.display_name,'start_month',e.start_month,'end_month',e.end_month,'amount',e.amount) order by p.display_name,e.profile_id),'[]'::jsonb) into v_employees from public.crm_sales_employee_targets e join public.profiles p on p.id=e.profile_id where e.plan_id=v_plan.id and private.crm_target_person_access(p.id);
 select coalesce(jsonb_agg(jsonb_build_object('month',m::date,
 'company_target',case when v_all then private.crm_target_month_amount(v_plan.company_target,v_plan.start_month,v_plan.end_month,m::date) else null end,
 'company_actual',case when v_all then (select coalesce(sum(f.net_amount),0) from public.kc_dw_sales_order_facts f where f.period_month=m::date and f.status='converted' and f.currency='THB') else null end,
 'employees',(select coalesce(jsonb_agg(jsonb_build_object('profile_id',p.id,'target',case when e.profile_id is null then null else private.crm_target_month_amount(e.amount,e.start_month,e.end_month,m::date) end,
 'actual',(select coalesce(sum(f.net_amount),0) from public.kc_dw_sales_order_facts f where lower(f.sales_email)=lower(p.email) and f.period_month=m::date and f.status='converted' and f.currency='THB')) order by p.display_name,p.id),'[]'::jsonb)
 from public.profiles p left join public.crm_sales_employee_targets e on e.profile_id=p.id and e.plan_id=v_plan.id
 where private.crm_target_person_access(p.id) and (p.is_active or e.profile_id is not null))) order by m),'[]'::jsonb)
 into v_months from generate_series(v_plan.start_month::timestamp,v_plan.end_month::timestamp,interval '1 month') m;
 v_scope:=case when v_all then 'company' when exists(select 1 from jsonb_array_elements(v_people) p where p->>'id'<>auth.uid()::text) then 'team' else 'self' end;
 return jsonb_build_object('plan',case when v_plan.id is null then null else jsonb_build_object('id',v_plan.id,'plan_year',v_plan.plan_year,'start_month',v_plan.start_month,'end_month',v_plan.end_month,'company_target',case when v_all then v_plan.company_target else null end,'updated_at',v_plan.updated_at) end,
 'people',v_people,'employees',v_employees,'months',v_months,'scope',v_scope,'can_manage',v_admin,'can_export',private.crm_can('reports','export'),'basis','converted_so_net_thb','as_of',now());
end $$;