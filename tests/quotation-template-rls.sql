begin;
do $setup$
declare actor uuid;
begin
 select id into actor from public.profiles where role='admin' and is_active limit 1;
 if actor is null then raise exception 'CRM admin required'; end if;
 perform set_config('request.jwt.claim.sub',actor::text,true);
end;
$setup$;
set local role authenticated;
do $checks$
declare saved public.crm_quotation_templates; account_id uuid; quote public.quotations;
begin
 update public.crm_quotation_templates set default_payment_term_code='postdated-15',default_payment_terms=15,
  logo_storage_key=auth.uid()::text||'/logo-fixture.png',seller_signature_storage_key=auth.uid()::text||'/seller-signature-fixture.png',signature_prepared_label_th='ผู้ขาย'
  where is_default returning * into saved;
 if saved.default_payment_term_code<>'postdated-15' or saved.default_payment_terms<>15 or saved.seller_signature_storage_key='' then raise exception 'Template read-back failed'; end if;
 insert into public.customers(name) values('QA quotation asset rollback') returning id into account_id;
 insert into public.quotations(customer_id,owner_id,payment_term_code,payment_terms,template_id,template_snapshot,items)
 values(account_id,auth.uid(),'deposit-30',0,saved.id,to_jsonb(saved),'[{"name":"QA line","qty":1,"price":100}]') returning * into quote;
 if quote.payment_term_code<>'deposit-30' or quote.payment_terms<>0 or quote.template_snapshot->>'seller_signature_storage_key'<>saved.seller_signature_storage_key then raise exception 'Quotation method/snapshot read-back failed'; end if;
 begin
  update public.crm_quotation_templates set default_payment_term_code='net-45',default_payment_terms=15 where id=saved.id;
  raise exception 'Inconsistent terms accepted';
 exception when check_violation then null; end;
 begin
  update public.quotations set payment_term_code='unknown' where id=quote.id;
  raise exception 'Unknown method accepted';
 exception when check_violation then null; end;
end;
$checks$;
set local role anon;
do $deny$
begin
 begin
  insert into public.crm_quotation_templates(name) values('QA anonymous template');
  raise exception 'Anonymous template write allowed';
 exception when insufficient_privilege then null; end;
end;
$deny$;
rollback;
select jsonb_build_object('result','PASS: authenticated template image keys, seller slot, payment method/days, quotation snapshot, invalid-term checks and anonymous denial; all fixture rows rolled back',
 'private_bucket',(select not public and file_size_limit=2097152 from storage.buckets where id='crm-quotation-assets'),
 'asset_policies',(select jsonb_agg(jsonb_build_object('name',policyname,'role',roles,'command',cmd,'qual',qual,'check',with_check)) from pg_policies where schemaname='storage' and policyname like 'crm_quotation_assets_%')) as result;
