-- Real database/RLS regression. Does not authenticate a browser session.
-- Rollback includes fixtures, policy edits, versions, notifications and audit rows.
begin;
select set_config('request.jwt.claim.sub',(select id::text from public.profiles where role='admin' and is_active limit 1),true);
set local role authenticated;
do $$
declare c uuid;c2 uuid;person uuid;opp uuid;q public.quotations;u timestamptz;affected integer;
begin
 if auth.uid() is null then raise exception 'Active admin test identity required';end if;
 insert into public.customers(code,name,status,address,shipping_street) values('QA/E2E-CUSTOMER','QA/E2E customer','Active','QA/E2E billing','QA/E2E shipping') returning id into c;
 insert into public.customers(code,name,status) values('QA/E2E-OTHER','QA/E2E other','Active') returning id into c2;
 insert into public.contacts(name,last_name,customer_id) values('QA/E2E contact','QA/E2E contact',c) returning id into person;
 insert into public.opportunities(code,name,customer_id,contact_id,amount,probability) values('QA/E2E-OPP','QA/E2E opportunity',c,person,100,25) returning id into opp;
 insert into public.quotations(code,customer_id,contact_id,opportunity_id,owner_id,items,tax_rate,wht_rate,prepared_by,payment_terms,note)
 values('QA/E2E-QUOTE',c,person,opp,auth.uid(),'[{"name":"QA/E2E service","qty":2,"price":100,"discount":10}]',10,3,'QA/E2E author',45,'QA/E2E terms') returning * into q;
 if q.subtotal<>200 or q.discount<>10 or q.vat<>19 or q.total<>209 or q.withholding_tax<>5.70 or q.net_total<>203.30 then raise exception 'VAT/WHT mismatch';end if;
 u:=q.updated_at;
 update public.quotations set wht_rate=5,updated_at=clock_timestamp() where id=q.id and updated_at=u returning * into q;
 if q.net_total<>199.50 then raise exception 'Rate-only update not recalculated';end if;
 update public.quotations set note='QA/E2E stale update' where id=q.id and updated_at=u;
 get diagnostics affected=row_count;if affected<>0 then raise exception 'Stale edit overwrote data';end if;
 if not exists(select 1 from public.quotations r join public.opportunities o on o.id=r.opportunity_id join public.contacts p on p.id=r.contact_id join public.customers a on a.id=r.customer_id where r.id=q.id and a.id=c and p.customer_id=a.id and o.customer_id=a.id) then raise exception 'Related-record chain broken';end if;
 begin update public.contacts set customer_id=c2 where id=person;raise exception 'Contact moved out of linked account';exception when foreign_key_violation then null;end;
 begin update public.opportunities set customer_id=c2,contact_id=null where id=opp;raise exception 'Opportunity moved out of linked account';exception when foreign_key_violation then null;end;
 begin update public.quotations set customer_id=c2 where id=q.id;raise exception 'Cross-account quotation accepted';exception when others then if SQLERRM='Cross-account quotation accepted' then raise;end if;end;
 begin update public.quotations set contact_id=gen_random_uuid() where id=q.id;raise exception 'Orphan contact accepted';exception when others then if SQLERRM='Orphan contact accepted' then raise;end if;end;
 begin update public.quotations set items='[]' where id=q.id;raise exception 'Empty quotation accepted';exception when others then if SQLERRM='Empty quotation accepted' then raise;end if;end;
 begin update public.quotations set tax_rate=101 where id=q.id;raise exception 'Invalid rate accepted';exception when others then if SQLERRM='Invalid rate accepted' then raise;end if;end;
 begin update public.quotations set customer_id=null where id=q.id;raise exception 'Linked quote lost account';exception when check_violation then null;end;
 begin update public.quotations set valid_until=issue_date-1 where id=q.id;raise exception 'Invalid validity date accepted';exception when check_violation then null;end;
 begin update public.contacts set reports_to_id=person where id=person;raise exception 'Contact cycle accepted';exception when others then if SQLERRM='Contact cycle accepted' then raise;end if;end;
 update public.customers set parent_customer_id=c where id=c2;
 begin update public.customers set parent_customer_id=c2 where id=c;raise exception 'Customer cycle accepted';exception when others then if SQLERRM='Customer cycle accepted' then raise;end if;end;
 if (select count(*) from public.crm_record_versions where module='quotations' and record_id=q.id)<>2 then raise exception 'Version history missing';end if;
end $$;
set local role anon;
do $$begin
 begin if exists(select 1 from public.quotations) then raise exception 'Anonymous quotation data exposed';end if;exception when insufficient_privilege then null;end;
 begin perform public.crm_quotation_transition(gen_random_uuid(),'submit','QA/E2E');raise exception 'Anonymous approval allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'PASS: real database save/edit/readback, VAT/WHT, stale write, relationship chain, cross-account move, orphan, cycles, versions and anonymous denial' result;
rollback;
