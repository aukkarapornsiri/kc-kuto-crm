alter table public.crm_quotation_templates
 add column if not exists logo_storage_key text not null default '',
 add column if not exists seller_signature_url text not null default '',
 add column if not exists seller_signature_storage_key text not null default '',
 add column if not exists default_payment_term_code text not null default '';
alter table public.quotations add column if not exists payment_term_code text not null default '';
alter table public.crm_quotation_templates add constraint crm_template_payment_term_check check (default_payment_term_code='' or case default_payment_term_code when 'cash' then default_payment_terms=0 when 'net-7' then default_payment_terms=7 when 'net-15' then default_payment_terms=15 when 'net-30' then default_payment_terms=30 when 'net-45' then default_payment_terms=45 when 'net-60' then default_payment_terms=60 when 'postdated-7' then default_payment_terms=7 when 'postdated-15' then default_payment_terms=15 when 'postdated-30' then default_payment_terms=30 when 'deposit-30' then default_payment_terms=0 when 'deposit-50' then default_payment_terms=0 when 'cheque-today' then default_payment_terms=0 else case when default_payment_term_code ~ '^legacy-[0-9]{1,3}$' then default_payment_terms=substring(default_payment_term_code from 8)::integer and default_payment_terms between 0 and 365 else false end end);
alter table public.quotations add constraint crm_quotation_payment_term_check check (payment_term_code='' or case payment_term_code when 'cash' then payment_terms=0 when 'net-7' then payment_terms=7 when 'net-15' then payment_terms=15 when 'net-30' then payment_terms=30 when 'net-45' then payment_terms=45 when 'net-60' then payment_terms=60 when 'postdated-7' then payment_terms=7 when 'postdated-15' then payment_terms=15 when 'postdated-30' then payment_terms=30 when 'deposit-30' then payment_terms=0 when 'deposit-50' then payment_terms=0 when 'cheque-today' then payment_terms=0 else case when payment_term_code ~ '^legacy-[0-9]{1,3}$' then payment_terms=substring(payment_term_code from 8)::integer and payment_terms between 0 and 365 else false end end);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('crm-quotation-assets','crm-quotation-assets',false,2097152,array['image/png','image/jpeg','image/webp'])
 on conflict(id) do nothing;
create policy crm_quotation_assets_read on storage.objects for select to authenticated
 using(bucket_id='crm-quotation-assets' and (private.crm_can('quotations','view') or private.crm_is_admin()));
create policy crm_quotation_assets_insert on storage.objects for insert to authenticated
 with check(bucket_id='crm-quotation-assets' and private.crm_is_admin() and (storage.foldername(name))[1]=auth.uid()::text);
-- Files are immutable: replacement creates a new key so saved quotation snapshots retain their images.
notify pgrst,'reload schema';
