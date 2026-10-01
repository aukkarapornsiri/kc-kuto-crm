-- Quotation financial-visibility UAT. Every fixture is rolled back.

begin;

select set_config('request.jwt.claim.sub',(select id::text from public.profiles where role='admin' and is_active limit 1),true);
set local role authenticated;
insert into public.crm_price_items(name,code,category,unit,price,cost,description,status)
values('QA Secure Price','QA-SEC-COST','Hardware','Unit',100,60,'Rollback fixture','active');
reset role;

select set_config('request.jwt.claim.sub',(select id::text from public.profiles where role='sales_user' and is_active limit 1),true);
set local role authenticated;

do $$
declare
  v_price uuid;
  v_customer uuid;
  v_quote uuid;
  v_catalog_cost numeric;
begin
  if exists(select 1 from public.crm_price_items where code='QA-SEC-COST') then
    raise exception 'Sales user must not read raw Price Book rows';
  end if;

  select id,cost into v_price,v_catalog_cost from public.crm_price_catalog() where code='QA-SEC-COST';
  if v_price is null or v_catalog_cost is not null then raise exception 'Masked price catalog failed for sales user'; end if;

  begin
    insert into public.crm_price_items(name,code,price,cost,status) values('Denied','QA-DENIED',1,1,'active');
    raise exception 'Sales user created Price Book item';
  exception when insufficient_privilege then null;
  end;

  select id into v_customer from public.customers order by created_at limit 1;

  insert into public.quotations(
    customer_id,customer_name,owner_id,owner_name,issue_date,valid_until,payment_terms,
    tax_rate,wht_rate,document_discount,currency,items,status
  )
  select v_customer,c.name,auth.uid(),p.display_name,current_date,current_date+30,30,7,0,0,'THB',
    jsonb_build_array(jsonb_build_object(
      'price_item_id',v_price::text,'code','QA-SEC-COST','name','QA Secure Price',
      'qty',2,'unit','Unit','price',100,'discount',0,'cost',1
    )),'draft'
  from public.customers c
  join public.profiles p on p.id=auth.uid()
  where c.id=v_customer
  returning id into v_quote;

  if not exists(
    select 1 from public.quotations
    where id=v_quote and gp_amount=0 and gp_margin=0
      and not ((items->0) ? 'cost') and not ((items->0) ? 'gp') and not ((items->0) ? 'margin')
  ) then raise exception 'Raw quotation financial masking failed'; end if;

  if exists(select 1 from public.crm_quotation_financials where quotation_id=v_quote) then
    raise exception 'Sales user read private quotation financials';
  end if;

  begin
    perform * from public.crm_quotation_financial_summary(v_quote);
    raise exception 'Sales user financial summary unexpectedly allowed';
  exception when insufficient_privilege then null;
  end;

  perform set_config('test.fin_quote',v_quote::text,true);
end $$;

reset role;
select set_config('request.jwt.claim.sub',(select id::text from public.profiles where role='admin' and is_active limit 1),true);
set local role authenticated;

do $$
declare v_cost numeric;v_fin record;
begin
  select cost into v_cost from public.crm_price_catalog() where code='QA-SEC-COST';
  if v_cost<>60 then raise exception 'Financial role must receive Price Book cost'; end if;
  select * into v_fin from public.crm_quotation_financial_summary(current_setting('test.fin_quote')::uuid);
  if v_fin.cost_total<>120 or v_fin.gp_amount<>80 or v_fin.gp_margin<>40 then
    raise exception 'Private quotation financial summary mismatch';
  end if;
end $$;

reset role;
rollback;

select 'PASS: sales cost/GP masking, authoritative Price Book cost, private financial RLS and admin financial visibility; fixtures rolled back' as result;
