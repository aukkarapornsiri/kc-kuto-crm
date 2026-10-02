\set ON_ERROR_STOP on
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $$ begin
 if (select count(*) from role_permissions)<>1 then raise exception 'Own permissions unavailable or another role exposed';end if;
 if (select count(*) from custom_roles)<>1 then raise exception 'Own role label unavailable';end if;
 if (select count(*) from dashboard_type_access)<>1 then raise exception 'Own dashboard unavailable';end if;
 if (select count(*) from customers)<>1 then raise exception 'View permission not enforced correctly';end if;
 update customers set name='must not change';if found then raise exception 'Forbidden edit succeeded';end if;
 begin perform public.crm_set_role_permissions('qa_support','[]','[]');raise exception 'Member saved permissions';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
do $$ begin
 if exists(select 1 from role_permissions) or exists(select 1 from dashboard_type_access) or exists(select 1 from customers) then raise exception 'Inactive user has access';end if;
end $$;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
create temp table qa_matrix as select jsonb_agg(jsonb_build_object('module',m)|| (select jsonb_object_agg('can_'||a,coalesce(to_jsonb(r)->('can_'||a),'false'::jsonb)) from unnest(array['view','create','edit','delete','export','approve','assign','import','manage_settings']) a) order by m) as rows from unnest(array['dashboard','leads','customers','contacts','opportunities','quotations','contracts','assets','tickets','activities','documents','reports','ai','settings']) m left join role_permissions r on r.module=m and r.role_key='qa_support';
do $$ declare before_rows jsonb; after_rows jsonb; saved jsonb;begin
 select rows into before_rows from qa_matrix;
 select jsonb_agg(case when value->>'module'='customers' then value||'{"can_edit":true}'::jsonb else value end) into after_rows from jsonb_array_elements(before_rows);
 saved:=public.crm_set_role_permissions('qa_support',after_rows,before_rows);
 if jsonb_array_length(saved)<>14 or not private.crm_can('customers','edit') then raise exception 'Invalid saved matrix';end if;
 if (select count(*) from audit_logs where changes->>'role_key'='qa_support')<>1 then raise exception 'Missing audit';end if;
 begin perform public.crm_set_role_permissions('qa_support',before_rows,before_rows);raise exception 'Stale save accepted';exception when serialization_failure then null;end;
 begin perform public.crm_set_role_permissions('admin',after_rows,after_rows);raise exception 'Admin save accepted';exception when insufficient_privilege then null;end;
 begin perform public.crm_set_role_permissions('qa_support','[]',saved);raise exception 'Partial matrix accepted';exception when raise_exception then if sqlerrm='Partial matrix accepted' then raise;end if;end;
 begin perform public.crm_set_role_permissions('qa_support',jsonb_set(saved,'{0,can_view}','"true"'),saved);raise exception 'String boolean accepted';exception when raise_exception then if sqlerrm='String boolean accepted' then raise;end if;end;
end $$;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $$ begin
 if not private.crm_can('customers','edit') then raise exception 'Saved access not effective';end if;
 update customers set name='Allowed';if not found then raise exception 'Allowed edit failed';end if;
 if (select count(*) from role_permissions)<>14 then raise exception 'Saved matrix not readable by member';end if;
end $$;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$ declare old_rows jsonb;new_rows jsonb;begin
 select jsonb_agg(jsonb_build_object('module',r.module)|| (select jsonb_object_agg('can_'||a,to_jsonb(r)->('can_'||a)) from unnest(array['view','create','edit','delete','export','approve','assign','import','manage_settings']) a)) into old_rows from role_permissions r where role_key='qa_support';
 select jsonb_agg(value||'{"can_view":false,"can_edit":false}'::jsonb) into new_rows from jsonb_array_elements(old_rows);
 perform public.crm_set_role_permissions('qa_support',new_rows,old_rows);
end $$;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $$ begin if exists(select 1 from customers) or private.crm_can('customers','edit') then raise exception 'Revoked permission still effective';end if;end $$;
rollback;
select 'Role access database checks passed' as result;
