begin;
do $setup$ declare actor uuid;customer uuid;begin
 select id into actor from public.profiles where role='admin' and is_active limit 1;
 if actor is null then raise exception 'Active admin needed for isolated RLS test';end if;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 insert into public.customers(name,province) values('QA SO map rollback','Bangkok') returning id into customer;
 insert into public.kc_dw_sales_order_facts(source_system,source_so_id,so_number,sales_email,converted_at,period_month,net_amount,gross_profit,status,customer_id,product_lines)
 values('qa_rollback',customer::text,'QA-SO','qa@example.invalid',now(),date_trunc('month',now())::date,100,10,'converted',customer,'[{"product":"Cloud","net_amount":100}]');
 perform set_config('test.so_id',customer::text,true);
 update public.kc_dw_sales_order_facts set status='cancelled',source_updated_at=now()+interval '1 day' where source_so_id=customer::text;
 update public.kc_dw_sales_order_facts set status='converted',net_amount=999,source_updated_at=now() where source_so_id=customer::text;
 if not exists(select 1 from public.kc_dw_sales_order_facts where source_so_id=customer::text and status='cancelled' and net_amount=100) then raise exception 'Stale SO event replaced newer cancellation';end if;
end $setup$;
set local role authenticated;
do $read$ declare n int;begin
 select count(*) into n from public.kc_dw_sales_order_facts where source_so_id=current_setting('test.so_id');if n<>1 then raise exception 'Authorized SO report read failed';end if;
 begin perform gross_profit from public.kc_dw_sales_order_facts;raise exception 'Gross profit exposed';exception when insufficient_privilege then null;end;
 begin insert into public.kc_dw_sales_order_facts(source_so_id) values('spoof');raise exception 'Client SO write allowed';exception when insufficient_privilege then null;end;
 begin update public.kc_dw_sales_order_facts set net_amount=999;raise exception 'Client SO update allowed';exception when insufficient_privilege then null;end;
 begin delete from public.kc_dw_sales_order_facts;raise exception 'Client SO delete allowed';exception when insufficient_privilege then null;end;
end $read$;
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role authenticated;
do $inactive$ declare n int;begin select count(*) into n from public.kc_dw_sales_order_facts where source_so_id=current_setting('test.so_id');if n<>0 then raise exception 'Missing-session SO read';end if;end $inactive$;
set local role anon;
do $anon$ begin begin perform id from public.kc_dw_sales_order_facts;raise exception 'Anonymous SO read';exception when insufficient_privilege then null;end;end $anon$;
reset role;
rollback;
select 'PASS: authorized report columns, private gross profit, service-only writes, missing-session and anonymous denial, locked stale-event guard; all fixtures rolled back' as result;
