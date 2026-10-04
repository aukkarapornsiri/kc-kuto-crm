begin;
select set_config('request.jwt.claim.sub',(select id::text from profiles where role='admin' and is_active limit 1),true);
set local role authenticated;
do $$declare c uuid;other uuid;i uuid;p uuid;n int;begin
 select id into c from customers limit 1;select id into other from customers where id<>c limit 1;
 insert into crm_customer_finance_entries(customer_id,kind,reference,amount,issued_on,due_on)values(c,'invoice','QA-'||gen_random_uuid(),1000.50,'2026-01-01','2026-02-01')returning id into i;
 insert into crm_customer_finance_entries(customer_id,kind,reference,amount,issued_on,invoice_id)values(c,'payment','QA-'||gen_random_uuid(),300.25,'2026-01-02',i)returning id into p;
 if (select amount from crm_customer_finance_entries where id=p)<>300.25 then raise exception 'Readback failed';end if;
 begin insert into crm_customer_finance_entries(customer_id,kind,reference,amount,issued_on,invoice_id)values(c,'payment','QA-over',701,'2026-01-02',i);raise exception 'OVERPAY_ACCEPTED';exception when others then if sqlerrm='OVERPAY_ACCEPTED'then raise;end if;end;
 begin insert into crm_customer_finance_entries(customer_id,kind,reference,amount,issued_on,invoice_id)values(other,'payment','QA-cross',100,'2026-01-02',i);raise exception 'CROSS_ACCEPTED';exception when others then if sqlerrm='CROSS_ACCEPTED'then raise;end if;end;
 begin update crm_customer_finance_entries set amount=10 where id=i;raise exception 'EDIT_ACCEPTED';exception when others then if sqlerrm='EDIT_ACCEPTED'then raise;end if;end;
 begin update crm_customer_finance_entries set status='void',void_reason='QA test reason' where id=i;raise exception 'VOID_WITH_PAYMENT_ACCEPTED';exception when others then if sqlerrm='VOID_WITH_PAYMENT_ACCEPTED'then raise;end if;end;
 update crm_customer_finance_entries set status='void',void_reason='QA payment correction' where id=p;
 update crm_customer_finance_entries set status='void',void_reason='QA invoice correction' where id=i;
 if (select count(*)from crm_customer_finance_entries where id in(i,p)and status='void')<>2 then raise exception 'Void not saved';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from profiles where role='sales_user' and is_active limit 1),true);
set local role authenticated;
do $$begin
 perform count(*) from crm_customer_finance_entries;
 begin insert into crm_customer_finance_entries(customer_id,kind,reference,amount,issued_on,due_on)select id,'invoice','QA-denied',1,'2026-01-01','2026-02-01'from customers limit 1;raise exception 'Sales write accepted';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role anon;
do $$begin begin perform count(*)from public.crm_customer_finance_entries;raise exception 'Anonymous finance access accepted';exception when insufficient_privilege then null;end;end $$;
reset role;
select 'PASS finance write/readback/partial payment/overpayment/cross-customer/immutability/void/sales-deny/anon-deny; rollback' result;
rollback;
