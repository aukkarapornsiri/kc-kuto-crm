-- Production-safe transactional test: no password, no sessions, no persisted fixtures.
begin;
create temp table qa_matrix_results(checks integer,roles integer,modules integer);
do $$
declare actor uuid:=gen_random_uuid(); supervisor uuid; fixture uuid; r record; m text; a text; p integer; n integer:=0; roles_count integer:=0; expected boolean; actual boolean;
 modules text[]:=array['activities','ai','assets','contacts','contracts','customers','dashboard','documents','inventory','leads','opportunities','quotations','reports','settings','tickets'];
 actions text[]:=array['view','create','edit','delete','export','approve','assign','import','manage_settings'];
begin
 select id into strict supervisor from public.profiles where is_super_admin and private.crm_active_user(id) limit 1;
 perform set_config('request.jwt.claim.sub',supervisor::text,true);
 fixture:=actor;
 insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data) values(actor,'authenticated','authenticated','qa-permissions-'||actor||'@example.invalid','{"provider":"email","providers":["email"]}','{}');
 insert into public.profiles(id,email,role,is_active,is_super_admin) values(actor,'qa-permissions@example.invalid','sales_user',true,false);
 for r in select role_key,is_system from public.custom_roles order by role_key loop
  roles_count:=roles_count+1;
  update public.profiles set role=case when r.role_key in ('admin','executive','sales_manager','sales_user','service_agent','renewal_owner','finance') then r.role_key else 'custom' end,custom_role_key=case when r.role_key in ('admin','executive','sales_manager','sales_user','service_agent','renewal_owner','finance') then null else r.role_key end where id=actor;
  for p in 0..2 loop
   foreach m in array modules loop
    foreach a in array actions loop
     if p=0 then execute format('select coalesce((select %I from public.role_permissions where role_key=$1 and module=$2),false)','can_'||a) into expected using r.role_key,m;
     else
      expected:=(p=2);
      execute format('insert into public.role_permissions(role_key,module,%I) values($1,$2,$3) on conflict(role_key,module) do update set %I=excluded.%I','can_'||a,'can_'||a,'can_'||a) using r.role_key,m,expected;
     end if;
     perform set_config('request.jwt.claim.sub',actor::text,true); execute 'set local role authenticated';
     actual:=private.crm_can(m,a);
     if actual is distinct from expected then raise exception 'Mismatch role=% module=% action=% phase=% expected=% actual=%',r.role_key,m,a,p,expected,actual;end if;
     if private.crm_can('access',a) then raise exception 'Non-super access administration role=%',r.role_key;end if;
     execute 'reset role'; perform set_config('request.jwt.claim.sub',supervisor::text,true);n:=n+1;
    end loop;
   end loop;
  end loop;
 end loop;
 actor:=supervisor;
 foreach m in array modules loop foreach a in array actions loop
  perform set_config('request.jwt.claim.sub',actor::text,true); execute 'set local role authenticated';
  if not private.crm_can(m,a) or not private.crm_can('access',a) then raise exception 'Super Admin denied';end if;
  execute 'reset role'; perform set_config('request.jwt.claim.sub',supervisor::text,true);n:=n+1;
 end loop;end loop;
 -- The application must prevent disabling its protected Super Admin.
 begin
  update public.profiles set is_active=false where id=actor;
  raise exception 'Unexpectedly disabled Super Admin';
 exception when raise_exception then
  if SQLERRM<>'Cannot disable or change the Super Admin account' then raise;end if;
 end;
 actor:=fixture;
 update public.profiles set is_active=false where id=actor;
 perform set_config('request.jwt.claim.sub',actor::text,true); execute 'set local role authenticated';
 foreach m in array modules loop foreach a in array actions loop
  if private.crm_can(m,a) then raise exception 'Disabled fixture allowed';end if;n:=n+1;
 end loop;end loop;
 execute 'reset role'; perform set_config('request.jwt.claim.sub',supervisor::text,true);
 insert into qa_matrix_results values(n,roles_count,cardinality(modules));
end $$;
select 'PASS' as result,* from qa_matrix_results;
rollback;
