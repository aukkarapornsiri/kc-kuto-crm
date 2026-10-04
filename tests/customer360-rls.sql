begin;
select set_config('request.jwt.claim.sub',(select id::text from public.profiles where role='admin' and is_active limit 1),true);
set local role authenticated;
do $$declare a uuid;b uuid;c uuid;n integer;begin
 insert into public.customers(name,status) values('QA C360 primary','Active') returning id into a;
 insert into public.customers(name,status) values('QA C360 duplicate','Active') returning id into b;
 insert into public.customers(name,status) values('QA C360 third','Active') returning id into c;
 perform public.crm_customer_identity_link(b,a,'Reviewed test duplicate');
 perform public.crm_customer_identity_link(b,a,'Reviewed repeated request');
 if (select count(*) from public.crm_customer_identity_events where customer_id=b)<>1 then raise exception 'Retry was not idempotent'; end if;
 if (select canonical_id from public.crm_customer_identity_links where customer_id=b)<>a then raise exception 'Link missing';end if;
 begin perform public.crm_customer_identity_link(a,b,'Inverse link attempt');raise exception 'Cycle accepted';exception when others then if sqlerrm='Cycle accepted' then raise;end if;end;
 begin perform public.crm_customer_identity_link(a,c,'Nested group attempt');raise exception 'Nested group accepted';exception when others then if sqlerrm='Nested group accepted' then raise;end if;end;
 begin insert into public.crm_customer_identity_links(customer_id,canonical_id,linked_by) values(c,a,auth.uid());raise exception 'Direct write accepted';exception when insufficient_privilege then null;end;
 update public.customers set phone='QA-EDIT' where id=b;
 if not exists(select 1 from public.crm_customer360_events where customer_id=b and action='UPDATE') then raise exception 'Change history missing';end if;
 perform public.crm_customer_identity_link(b,null,'Undo test duplicate');
 if exists(select 1 from public.crm_customer_identity_links where customer_id=b) then raise exception 'Unlink failed';end if;
 if (select count(*) from public.customers where id in(a,b,c))<>3 then raise exception 'Original customers lost';end if;
 if (select phone from public.customers where id=b)<>'QA-EDIT' then raise exception 'Business fields were overwritten';end if;
 if (select count(*) from public.crm_customer_identity_events where customer_id=b)<>2 then raise exception 'Audit missing';end if;
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 if (select count(*) from public.crm_customer360_events)<>0 then raise exception 'Unrecognized identity can read history';end if;
 begin perform public.crm_customer_identity_link(b,a,'Unauthorized attempt');raise exception 'Unauthorized link accepted';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',coalesce((select id::text from public.profiles where role<>'admin' and is_active limit 1),gen_random_uuid()::text),true);
set local role authenticated;
do $$begin
 begin perform public.crm_customer_identity_link(gen_random_uuid(),gen_random_uuid(),'Member must be denied');raise exception 'Member could link identities';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role anon;
do $$begin
 begin perform count(*) from public.crm_customer_identity_links;raise exception 'Anonymous access accepted';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
