-- Cross-link regression for Customer -> Contact/Opportunity -> Quotation -> Contract.
-- Runs as an active admin and rolls back all fixtures.

begin;
select set_config('request.jwt.claim.sub',(select id::text from public.profiles where role='admin' and is_active limit 1),true);
set local role authenticated;

do $$
declare
  v_customer uuid;
  v_contact uuid;
  v_opp uuid;
  v_quote uuid;
  v_contract uuid;
  v_template uuid;
begin
  insert into public.customers(name,status,owner_id,owner_name)
  select 'QA Crosslink Rollback','Active',id,display_name from public.profiles where id=auth.uid()
  returning id into v_customer;

  insert into public.contacts(name,first_name,last_name,customer_id,status,owner_id,owner_name)
  select 'QA Contact','QA','Contact',v_customer,'active',id,display_name from public.profiles where id=auth.uid()
  returning id into v_contact;

  insert into public.opportunities(name,customer_id,customer_name,contact_id,contact_name,stage,amount,probability,status,owner_id,owner_name)
  select 'QA Opportunity',v_customer,'QA Crosslink Rollback',v_contact,'QA Contact','Lead',1000,25,'open',id,display_name
  from public.profiles where id=auth.uid()
  returning id into v_opp;

  select id into v_template from public.crm_quotation_templates where is_default=true limit 1;

  insert into public.quotations(
    customer_id,customer_name,contact_id,contact_name,opportunity_id,owner_id,owner_name,
    issue_date,valid_until,payment_terms,tax_rate,wht_rate,document_discount,currency,items,
    template_id,template_snapshot,prepared_by,status
  )
  select v_customer,'QA Crosslink Rollback',v_contact,'QA Contact',v_opp,p.id,p.display_name,
         current_date,current_date+30,30,7,0,0,'THB',
         '[{"code":"QA-X","name":"Crosslink item","qty":1,"unit":"Unit","price":1000,"discount":0,"cost":700}]'::jsonb,
         v_template,to_jsonb(t),p.display_name,'draft'
  from public.profiles p
  join public.crm_quotation_templates t on t.id=v_template
  where p.id=auth.uid()
  returning id into v_quote;

  perform set_config('crm.approval_transition','yes',true);
  update public.quotations
     set approval_status='approved',status='approved',updated_at=clock_timestamp()
   where id=v_quote;
  perform set_config('crm.approval_transition','',true);

  insert into public.contracts(
    name,customer_id,customer_name,quotation_id,opportunity_id,type,product,value,start_date,end_date,status,owner_id,owner_name
  )
  select 'QA Contract',v_customer,'QA Crosslink Rollback',v_quote,v_opp,'Maintenance','Crosslink item',1000,current_date,current_date+365,'active',id,display_name
  from public.profiles where id=auth.uid()
  returning id into v_contract;

  if not exists(
    select 1 from public.quotations q
    join public.contacts c on c.id=q.contact_id and c.customer_id=q.customer_id
    join public.opportunities o on o.id=q.opportunity_id and o.customer_id=q.customer_id
    where q.id=v_quote and q.customer_id=v_customer
  ) then raise exception 'Quotation Customer/Contact/Opportunity linkage failed'; end if;

  if not exists(
    select 1 from public.contracts c
    join public.quotations q on q.id=c.quotation_id and q.customer_id=c.customer_id
    join public.opportunities o on o.id=c.opportunity_id and o.customer_id=c.customer_id
    where c.id=v_contract and c.customer_id=v_customer
  ) then raise exception 'Contract Quote/Opportunity linkage failed'; end if;

  if not exists(select 1 from public.crm_record_versions where module='quotations' and record_id=v_quote)
  then raise exception 'Quotation version missing'; end if;
end $$;

reset role;
rollback;

select 'PASS: Customer -> Contact/Opportunity -> approved Quotation -> Contract cross-links and versioning; fixtures rolled back' as result;
