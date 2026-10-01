-- Contract handoff regression. Every fixture is rolled back.
begin;
select set_config('request.jwt.claim.sub',(select id::text from public.profiles where role='admin' and is_active limit 1),true);
set local role authenticated;

do $$
declare
  c1 uuid;c2 uuid;q_approved uuid;q_draft uuid;k uuid;
begin
  insert into public.customers(name,status) values('QA Contract Guard 1','Active') returning id into c1;
  insert into public.customers(name,status) values('QA Contract Guard 2','Active') returning id into c2;

  insert into public.quotations(customer_id,customer_name,owner_id,owner_name,issue_date,valid_until,payment_terms,tax_rate,wht_rate,document_discount,currency,items,status)
  select c1,'QA Contract Guard 1',p.id,p.display_name,current_date,current_date+30,30,7,0,0,'THB',
         '[{"name":"Admin manual item","qty":1,"unit":"Unit","price":100,"discount":0,"cost":60}]'::jsonb,'draft'
  from public.profiles p where p.id=auth.uid()
  returning id into q_approved;

  perform set_config('crm.approval_transition','yes',true);
  update public.quotations set approval_status='approved',status='approved',updated_at=clock_timestamp() where id=q_approved;
  perform set_config('crm.approval_transition','',true);

  insert into public.contracts(name,customer_id,quotation_id,start_date,end_date,value,status)
  values('QA Contract Guard',c1,q_approved,current_date,current_date+365,100,'active')
  returning id into k;

  begin
    insert into public.contracts(name,customer_id,quotation_id,start_date,end_date,value,status)
    values('QA Duplicate',c1,q_approved,current_date,current_date+365,100,'active');
    raise exception 'Duplicate quotation contract allowed';
  exception when unique_violation then null;
  end;

  begin
    update public.contracts set customer_id=c2 where id=k;
    raise exception 'Cross-customer contract quotation allowed';
  exception when others then
    if SQLERRM='Cross-customer contract quotation allowed' then raise; end if;
    if SQLERRM not like '%belongs to another customer%' then raise; end if;
  end;

  insert into public.quotations(customer_id,customer_name,owner_id,owner_name,issue_date,valid_until,payment_terms,tax_rate,wht_rate,document_discount,currency,items,status)
  select c1,'QA Contract Guard 1',p.id,p.display_name,current_date,current_date+30,30,7,0,0,'THB',
         '[{"name":"Draft item","qty":1,"unit":"Unit","price":50,"discount":0,"cost":20}]'::jsonb,'draft'
  from public.profiles p where p.id=auth.uid()
  returning id into q_draft;

  begin
    insert into public.contracts(name,customer_id,quotation_id,start_date,end_date,value,status)
    values('QA Draft Contract',c1,q_draft,current_date,current_date+365,50,'active');
    raise exception 'Draft quotation contract allowed';
  exception when others then
    if SQLERRM='Draft quotation contract allowed' then raise; end if;
    if SQLERRM not like '%requires an approved quotation%' then raise; end if;
  end;
end $$;

reset role;
rollback;
select 'PASS: approved-only quotation handoff, one contract per quotation, and cross-customer guard; fixtures rolled back' as result;
