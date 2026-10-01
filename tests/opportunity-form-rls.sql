-- Read-back and relationship checks use the live schema; all test rows roll back.
begin;
do $setup$
declare admin_id uuid;
begin
  select id into admin_id from public.profiles where role='admin' and is_active limit 1;
  if admin_id is null then raise exception 'Active CRM admin required'; end if;
  perform set_config('request.jwt.claim.sub',admin_id::text,true);
end;
$setup$;
set local role authenticated;
do $checks$
declare account_id uuid; other_id uuid; contact_id uuid; other_contact uuid; opportunity_id uuid; quote_id uuid; saved public.opportunities;
begin
  insert into public.customers(name) values('QA popup rollback account') returning id into account_id;
  insert into public.customers(name) values('QA popup rollback other') returning id into other_id;
  insert into public.contacts(name,customer_id) values('QA popup contact',account_id) returning id into contact_id;
  insert into public.contacts(name,customer_id) values('QA other contact',other_id) returning id into other_contact;
  insert into public.opportunities(name,customer_id,customer_name,contact_id,contact_name,owner_id,close_date,amount,solution,stage,probability,forecast_category,next_action,status)
    values('QA popup deal',account_id,'QA popup rollback account',contact_id,'QA popup contact',auth.uid(),current_date+30,120000.50,'Popup description','Proposal',60,'Best Case','Customer review','open')
    returning * into saved;
  opportunity_id:=saved.id;
  if saved.customer_id<>account_id or saved.contact_id<>contact_id or saved.owner_id<>auth.uid()
    or saved.customer_name<>'QA popup rollback account' or saved.contact_name<>'QA popup contact'
    or saved.solution<>'Popup description' or saved.next_action<>'Customer review' or saved.weighted_amount<>72000.30
    or saved.forecast_category<>'Best Case' then raise exception 'Opportunity popup round trip failed'; end if;
  insert into public.quotations(customer_id,contact_id,opportunity_id,owner_id,items,total,status)
    values(account_id,contact_id,opportunity_id,auth.uid(),'[{"name":"QA item","qty":1,"price":120000.50}]',128400.535,'draft') returning id into quote_id;
  if not exists(select 1 from public.quotations q join public.opportunities o on o.id=q.opportunity_id
    join public.customers c on c.id=o.customer_id where q.id=quote_id and q.customer_id=c.id and q.contact_id=o.contact_id)
    then raise exception 'Quotation opportunity relationship failed'; end if;
  begin
    update public.opportunities set contact_id=other_contact where id=opportunity_id;
    raise exception 'Cross-account contact accepted';
  exception when foreign_key_violation or check_violation then null; when raise_exception then if SQLERRM not like 'Related record is inaccessible or belongs to another customer:%' then raise; end if; end;
  update public.opportunities set stage='Won',status='won',probability=100,forecast_category='Closed Won' where id=opportunity_id returning * into saved;
  if saved.weighted_amount<>120000.50 or saved.status<>'won' then raise exception 'Won metrics failed'; end if;
  update public.opportunities set stage='Lost',status='lost',probability=0,forecast_category='Closed Lost',lost_reason='Budget' where id=opportunity_id returning * into saved;
  if saved.weighted_amount<>0 or saved.status<>'lost' then raise exception 'Lost metrics failed'; end if;
end;
$checks$;
set local role anon;
do $anon_check$
begin
  begin
    insert into public.opportunities(name) values('QA anonymous denied');
    raise exception 'Anonymous opportunity write allowed';
  exception when insufficient_privilege then null; end;
end;
$anon_check$;
rollback;
select 'PASS: authenticated opportunity popup fields, computed metrics, Customer/Contact/Quotation links, cross-account rejection and anonymous write denial; all fixture rows rolled back' as result;
