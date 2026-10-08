-- Transactional production smoke test: no test records are retained.
begin;
select set_config('request.jwt.claim.sub',(select id::text from public.profiles where role='admin' limit 1),true);
set local role authenticated;
do $$
declare result jsonb;
begin
 result:=public.crm_create_customer_with_contact(jsonb_build_object('name','QA primary contact rollback','owner_id',auth.uid(),'status','Active'),'{"first_name":"QA","last_name":"Contact","position":"Manager","phone":"020000000","email":"qa@example.test"}'::jsonb);
 if not exists(select 1 from public.contacts where customer_id=(result->>'id')::uuid and is_primary and name='QA Contact' and email='qa@example.test') then raise exception 'Linked contact assertion failed'; end if;
 begin
  perform public.crm_create_customer_with_contact('{"name":"QA incomplete contact"}','{"first_name":"QA"}');
  raise exception 'Expected contact validation' using errcode='ZX001';
 exception when raise_exception then null;
 end;
 if exists(select 1 from public.customers where name='QA incomplete contact') then raise exception 'Partial customer created'; end if;
end $$;
select set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
do $$
begin
 begin
  perform public.crm_create_customer_with_contact('{"name":"QA unauthorized"}','{"first_name":"QA","last_name":"Contact"}');
  raise exception 'Expected permission denial' using errcode='ZX001';
 exception when insufficient_privilege then null;
 end;
end $$;
rollback;
