-- One centrally managed target plan per year; no invented production targets.
create table public.crm_sales_target_plans (
 id uuid primary key default gen_random_uuid(), plan_year integer not null unique check(plan_year between 2000 and 2200),
 start_month date not null,end_month date not null,company_target numeric(18,2) not null check(company_target>=0 and company_target<=1000000000000),
 updated_at timestamptz not null default clock_timestamp(),updated_by uuid not null references public.profiles(id),
 check(extract(day from start_month)=1 and extract(day from end_month)=1),
 check(extract(year from start_month)=plan_year and end_month>=start_month and end_month<start_month+interval '12 months'),
 exclude using gist (daterange(start_month,(end_month+interval '1 month')::date,'[)') with &&)
);
create table public.crm_sales_employee_targets (
 plan_id uuid not null references public.crm_sales_target_plans(id) on delete cascade,
 profile_id uuid not null references public.profiles(id),start_month date not null,end_month date not null,
 amount numeric(18,2) not null check(amount>=0 and amount<=1000000000000),primary key(plan_id,profile_id),
 check(extract(day from start_month)=1 and extract(day from end_month)=1 and end_month>=start_month)
);
create index crm_sales_employee_targets_profile_idx on public.crm_sales_employee_targets(profile_id);
create index crm_sales_target_plans_updated_by_idx on public.crm_sales_target_plans(updated_by);
alter table public.crm_sales_target_plans enable row level security;
alter table public.crm_sales_employee_targets enable row level security;
revoke all on public.crm_sales_target_plans,public.crm_sales_employee_targets from anon,authenticated;
grant select on public.crm_sales_target_plans,public.crm_sales_employee_targets to authenticated;

create function private.crm_target_all_access() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and is_active and role in ('admin','executive'))
$$;
create function private.crm_target_person_access(p_person uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles a where a.id=auth.uid() and a.is_active and (
 a.role in ('admin','executive') or a.id=p_person or
 (a.role='sales_manager' and exists(select 1 from public.profiles p where p.id=p_person and p.manager_id=a.id)) or
 exists(select 1 from public.crm_teams t where t.is_active and t.leader_id=a.id and p_person=any(t.member_ids))))
$$;
create policy target_plan_read on public.crm_sales_target_plans for select to authenticated using((select private.crm_target_all_access()));
create policy target_employee_read on public.crm_sales_employee_targets for select to authenticated using(private.crm_target_person_access(profile_id));

create function private.crm_target_month_amount(p_amount numeric,p_start date,p_end date,p_month date) returns numeric language sql immutable set search_path='' as $$
 select case when p_month<p_start or p_month>p_end then 0
 when p_month=p_end then p_amount-trunc(p_amount/n,2)*(n-1) else trunc(p_amount/n,2) end
 from (select ((extract(year from p_end)-extract(year from p_start))*12+extract(month from p_end)-extract(month from p_start)+1)::integer n) q
$$;

create function private.crm_save_sales_targets(p_year integer,p_start date,p_end date,p_company numeric,p_employees jsonb,p_expected timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_plan public.crm_sales_target_plans%rowtype;v_row jsonb;v_id uuid;v_start date;v_end date;v_amount numeric;v_before jsonb;
begin
 if not private.crm_is_admin() then raise exception 'Administrator access required' using errcode='42501';end if;
 if p_year is null or p_year not between 2000 and 2200 or p_start is null or p_end is null or extract(year from p_start)<>p_year or extract(day from p_start)<>1 or extract(day from p_end)<>1 or p_end<p_start or p_end>=p_start+interval '12 months' then raise exception 'Choose a valid 1-12 month period starting in the plan year';end if;
 if p_company is null or p_company<0 or p_company>1000000000000 or p_company<>round(p_company,2) then raise exception 'Invalid company target';end if;
 if jsonb_typeof(p_employees) is distinct from 'array' then raise exception 'Employee targets must be an array';end if;
 if jsonb_array_length(p_employees)>1000 or (select count(distinct value->>'profile_id') from jsonb_array_elements(p_employees))<>jsonb_array_length(p_employees) then raise exception 'Duplicate or excessive employees';end if;
 perform pg_advisory_xact_lock(728192,1);
 select * into v_plan from public.crm_sales_target_plans where plan_year=p_year for update;
 if (v_plan.id is null and p_expected is not null) or (v_plan.id is not null and v_plan.updated_at is distinct from p_expected) then raise exception 'Target plan changed. Reload before saving.' using errcode='40001';end if;
 v_before:=jsonb_build_object('plan',to_jsonb(v_plan),'employees',(select coalesce(jsonb_agg(to_jsonb(e)),'[]'::jsonb) from public.crm_sales_employee_targets e where e.plan_id=v_plan.id));
 for v_row in select value from jsonb_array_elements(p_employees) loop
  v_id:=(v_row->>'profile_id')::uuid;v_start:=(v_row->>'start_month')::date;v_end:=(v_row->>'end_month')::date;v_amount:=(v_row->>'amount')::numeric;
  if v_id is null or v_start is null or v_end is null or v_start<p_start or v_end>p_end or v_end<v_start or extract(day from v_start)<>1 or extract(day from v_end)<>1 then raise exception 'Employee period must be within company period';end if;
  if v_amount is null or v_amount<0 or v_amount>1000000000000 or v_amount<>round(v_amount,2) then raise exception 'Invalid employee target';end if;
  if not exists(select 1 from public.profiles p where p.id=v_id and (p.is_active or exists(select 1 from public.crm_sales_employee_targets e where e.plan_id=v_plan.id and e.profile_id=p.id))) then raise exception 'Unknown or inactive employee';end if;
 end loop;
 if v_plan.id is null then
  insert into public.crm_sales_target_plans(plan_year,start_month,end_month,company_target,updated_by) values(p_year,p_start,p_end,p_company,auth.uid()) returning * into v_plan;
 else
  update public.crm_sales_target_plans set start_month=p_start,end_month=p_end,company_target=p_company,updated_at=clock_timestamp(),updated_by=auth.uid() where id=v_plan.id returning * into v_plan;
 end if;
 delete from public.crm_sales_employee_targets where plan_id=v_plan.id;
 insert into public.crm_sales_employee_targets(plan_id,profile_id,start_month,end_month,amount)
 select v_plan.id,(value->>'profile_id')::uuid,(value->>'start_month')::date,(value->>'end_month')::date,(value->>'amount')::numeric from jsonb_array_elements(p_employees);
 insert into public.audit_logs(user_id,action,module,category,changes) values(auth.uid(),'update','settings','data_change',jsonb_build_object('sales_target_plan',v_plan.id,'year',p_year,'before_plan',v_before,'after_plan',to_jsonb(v_plan),'employee_targets',p_employees));
 return to_jsonb(v_plan);
end $$;

-- Single authenticated read API for Settings, dashboards and reports.
-- Privileged access stays private; every employee aggregate is scoped explicitly.
create function private.crm_get_sales_targets(p_year integer) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_plan public.crm_sales_target_plans%rowtype;v_all boolean;v_admin boolean;v_people jsonb;v_employees jsonb;v_months jsonb;v_scope text;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and is_active) or not (private.crm_can('dashboard','view') or private.crm_can('reports','view') or private.crm_can('settings','view')) then raise exception 'Access denied' using errcode='42501';end if;
 if p_year is null or p_year not between 2000 and 2200 then raise exception 'Invalid plan year';end if;
 v_all:=private.crm_target_all_access();v_admin:=private.crm_is_admin();
 select * into v_plan from public.crm_sales_target_plans where plan_year=p_year;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name,'active',p.is_active) order by p.display_name,p.id),'[]'::jsonb) into v_people from public.profiles p where private.crm_target_person_access(p.id) and (p.is_active or exists(select 1 from public.crm_sales_employee_targets e where e.plan_id=v_plan.id and e.profile_id=p.id));
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
create function public.crm_save_sales_targets(p_year integer,p_start date,p_end date,p_company numeric,p_employees jsonb,p_expected timestamptz default null) returns jsonb language sql security invoker set search_path='' as $$ select private.crm_save_sales_targets(p_year,p_start,p_end,p_company,p_employees,p_expected) $$;
create function public.crm_get_sales_targets(p_year integer) returns jsonb language sql stable security invoker set search_path='' as $$ select private.crm_get_sales_targets(p_year) $$;
revoke all on function private.crm_target_all_access(),private.crm_target_person_access(uuid),private.crm_target_month_amount(numeric,date,date,date),private.crm_save_sales_targets(integer,date,date,numeric,jsonb,timestamptz),private.crm_get_sales_targets(integer),public.crm_save_sales_targets(integer,date,date,numeric,jsonb,timestamptz),public.crm_get_sales_targets(integer) from public,anon;
grant execute on function private.crm_target_all_access(),private.crm_target_person_access(uuid),private.crm_save_sales_targets(integer,date,date,numeric,jsonb,timestamptz),private.crm_get_sales_targets(integer),public.crm_save_sales_targets(integer,date,date,numeric,jsonb,timestamptz),public.crm_get_sales_targets(integer) to authenticated;
