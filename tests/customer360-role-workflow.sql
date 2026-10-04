begin;
create temp table c360_qa_results(role_name text,read_ok boolean,write_ok boolean,detail text);
grant all on c360_qa_results to authenticated;
select set_config('request.jwt.claim.sub',(select id::text from profiles where role='admin' and is_active limit 1),true);
set local role authenticated;
do $$declare c record; a uuid; n int:=0;begin
 for c in select id from public.customers where name not like '[DEV]%' order by updated_at desc limit 5 loop
  insert into public.activities(subject,customer_id,type,status,priority,scheduled_at,owner_id) values('QA Customer 360 rollback',c.id,'Call','planned','medium',now()+interval '1 day',auth.uid()) returning id into a;
  update public.activities set description='Read-back checked',status='completed' where id=a;
  if not exists(select 1 from public.activities where id=a and customer_id=c.id and description='Read-back checked' and status='completed')then raise exception 'Activity save/readback failed';end if;
  if not exists(select 1 from public.crm_customer360_events where customer_id=c.id and record_id=a and action='UPDATE')then raise exception 'Timeline event missing';end if;
  n:=n+1;
 end loop;
 if n<>5 then raise exception 'Five real customers required';end if;
 insert into c360_qa_results values('admin',true,true,'5 real customers: activity save/update/readback + timeline; rolled back');
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from profiles where role='sales_user' and is_active limit 1),true);
set local role authenticated;
do $$declare c uuid;a uuid;begin
 select id into c from public.customers where name not like '[DEV]%' limit 1;
 if c is null then raise exception 'Sales cannot read customer';end if;
 insert into public.activities(subject,customer_id,type,status,priority,scheduled_at,owner_id) values('QA Sales rollback',c,'Email','planned','medium',now(),auth.uid()) returning id into a;
 update public.activities set status='completed' where id=a;
 if not exists(select 1 from public.activities where id=a and status='completed')then raise exception 'Sales readback failed';end if;
 begin perform public.crm_customer_identity_link(c,c,'Sales must not merge');raise exception 'Sales merge allowed';exception when insufficient_privilege then null;end;
 insert into c360_qa_results values('sales_user',true,true,'Create/update/read activity; identity linking denied');
end $$;
reset role;
-- Temporarily exercise the configured manager role with the same actor. Entire transaction rolls back.
update public.profiles set role='sales_manager' where id=auth.uid();
set local role authenticated;
do $$declare c uuid;a uuid;begin
 select id into c from public.customers limit 1;
 insert into public.activities(subject,customer_id,type,status,priority,scheduled_at,owner_id) values('QA Manager rollback',c,'LINE Contact','completed','medium',now(),auth.uid()) returning id into a;
 if not exists(select 1 from public.activities where id=a)then raise exception 'Manager readback failed';end if;
 begin perform public.crm_customer_identity_link(c,c,'Manager must not merge');raise exception 'Manager merge allowed';exception when insufficient_privilege then null;end;
 insert into c360_qa_results values('sales_manager (transaction simulation)',true,true,'Create/read LINE activity; identity linking denied');
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from profiles where role='executive' and is_active limit 1),true);
set local role authenticated;
do $$begin
 if not exists(select 1 from public.customers)then raise exception 'Executive cannot read';end if;
 begin insert into public.customers(name,status)values('QA denied','Active');raise exception 'Executive write allowed';exception when insufficient_privilege then null;end;
 insert into c360_qa_results values('executive',true,false,'Customer create correctly denied');
end $$;
reset role;
select set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
set local role authenticated;
do $$begin
 if exists(select 1 from public.customers) or exists(select 1 from public.activities) then raise exception 'Unknown actor sees records';end if;
 insert into c360_qa_results values('unrecognized identity',false,false,'No customers or activities visible');
end $$;
reset role;
select * from c360_qa_results;
rollback;
