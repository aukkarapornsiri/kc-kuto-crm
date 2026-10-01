-- Quotation document designer regression test.
-- Uses an existing active admin/customer and rolls back every test change.

begin;
select set_config('request.jwt.claim.sub',(select id::text from public.profiles where role='admin' and is_active limit 1),true);
set local role authenticated;

do $$
declare
  v_qid uuid;
  v_cid uuid;
  v_contact_id uuid;
  v_opp_id uuid;
  v_tid uuid;
  v_terms_before integer;
begin
  if auth.uid() is null then raise exception 'Active admin required'; end if;

  select id into v_cid from public.customers order by created_at limit 1;
  if v_cid is null then raise exception 'Customer fixture required'; end if;
  select id into v_contact_id from public.contacts where customer_id=v_cid order by created_at limit 1;
  select id into v_opp_id from public.opportunities where customer_id=v_cid order by created_at limit 1;
  select id,default_payment_terms into v_tid,v_terms_before
    from public.crm_quotation_templates where is_default=true and status='active' limit 1;
  if v_tid is null then raise exception 'Default quotation template missing'; end if;

  update public.crm_quotation_templates
     set default_payment_terms=45, updated_at=clock_timestamp(), updated_by=auth.uid()
   where id=v_tid;
  if (select default_payment_terms from public.crm_quotation_templates where id=v_tid)<>45 then
    raise exception 'Admin template update failed';
  end if;

  insert into public.quotations(
    code,customer_id,contact_id,opportunity_id,owner_id,issue_date,valid_until,
    payment_terms,tax_rate,wht_rate,document_discount,currency,items,
    template_id,template_snapshot,prepared_by,status
  )
  select
    'SQ-ROLLBACK-RLS',v_cid,v_contact_id,v_opp_id,auth.uid(),current_date,current_date+45,
    45,7,3,10,'THB',
    '[{"code":"QA","name":"QA linked item","qty":2,"unit":"Unit","price":100,"discount":0,"cost":60}]'::jsonb,
    v_tid,to_jsonb(t),coalesce(p.display_name,p.email),'draft'
  from public.crm_quotation_templates t
  join public.profiles p on p.id=auth.uid()
  where t.id=v_tid
  returning id into v_qid;

  if not exists(
    select 1 from public.quotations q
    where q.id=v_qid and q.customer_id=v_cid
      and q.contact_id is not distinct from v_contact_id
      and q.opportunity_id is not distinct from v_opp_id
      and q.template_id=v_tid
      and q.net_total=197.60 and q.gp_amount=0 and q.gp_margin=0
      and q.document_discount=10
      and q.template_snapshot ? 'accent_color'
  ) then raise exception 'Quotation links/totals/snapshot failed'; end if;

  if not exists(
    select 1 from public.crm_quotation_financials f
    where f.quotation_id=v_qid and f.cost_total=120 and f.gp_amount=70 and f.gp_margin=36.84
  ) then raise exception 'Private quotation financials failed'; end if;

  if not exists(
    select 1 from public.crm_record_versions rv
    where rv.module='quotations' and rv.record_id=v_qid
  ) then raise exception 'Quotation version capture failed'; end if;

  if not exists(
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='crm_quotation_transition'
  ) then raise exception 'Approval transition function missing'; end if;

  update public.crm_quotation_templates set default_payment_terms=v_terms_before where id=v_tid;
end $$;

reset role;

select set_config('request.jwt.claim.sub',(select id::text from public.profiles where role='sales_user' and is_active limit 1),true);
set local role authenticated;
do $
declare v_count integer;
begin
  update public.crm_quotation_templates set default_payment_terms=99 where is_default=true;
  get diagnostics v_count = row_count;
  if v_count<>0 then raise exception 'Non-admin must not update quotation templates'; end if;
end $;

reset role;
set local role anon;
do $$
begin
  if exists(select 1 from public.crm_quotation_templates) then raise exception 'Anonymous template data must remain private'; end if;
  if exists(select 1 from public.quotations) then raise exception 'Anonymous quotation data must remain private'; end if;
end $$;
reset role;
rollback;

select 'PASS: quotation template, CRM links, private financials, totals, versioning, approval and anonymous isolation; fixtures rolled back' as result;
