-- Account 360 style quotation document designer for KC CuTo CRM.
-- Additive: existing quotation records remain valid.

create table if not exists public.crm_quotation_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'KC Standard Quotation',
  description text not null default '',
  is_default boolean not null default false,
  status text not null default 'active' check (status in ('active','inactive')),
  title_th text not null default 'ใบเสนอราคา',
  title_en text not null default 'Quotation',
  document_prefix text not null default 'SQ',
  accent_color text not null default '#0AADA9' check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  company_name_th text not null default '',
  company_name_en text not null default '',
  company_address_th text not null default '',
  company_address_en text not null default '',
  company_phone text not null default '',
  company_email text not null default '',
  company_website text not null default '',
  company_line text not null default '',
  company_tax_id text not null default '',
  logo_url text not null default '',
  default_payment_terms integer not null default 30 check (default_payment_terms between 0 and 365),
  default_tax_rate numeric(7,2) not null default 7 check (default_tax_rate between 0 and 100),
  default_wht_rate numeric(7,2) not null default 0 check (default_wht_rate between 0 and 100),
  default_currency text not null default 'THB',
  default_payment_instructions text not null default '',
  header_text_th text not null default '',
  header_text_en text not null default '',
  footer_text_th text not null default '',
  footer_text_en text not null default '',
  show_item_code boolean not null default true,
  show_item_discount boolean not null default true,
  show_gp boolean not null default true,
  show_margin boolean not null default true,
  show_wht boolean not null default true,
  signature_prepared_label_th text not null default 'ผู้จัดทำ',
  signature_prepared_label_en text not null default 'Prepared by',
  signature_reviewed_label_th text not null default 'ผู้ตรวจสอบ',
  signature_reviewed_label_en text not null default 'Reviewed by',
  signature_approved_label_th text not null default 'ผู้อนุมัติ',
  signature_approved_label_en text not null default 'Approved by',
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists crm_quotation_templates_one_default_idx on public.crm_quotation_templates ((is_default)) where is_default=true;
create index if not exists crm_quotation_templates_status_idx on public.crm_quotation_templates(status,updated_at desc);
alter table public.crm_quotation_templates enable row level security;
grant select,insert,update,delete on public.crm_quotation_templates to authenticated;
grant all on public.crm_quotation_templates to service_role;
drop policy if exists crm_quotation_template_read on public.crm_quotation_templates;
create policy crm_quotation_template_read on public.crm_quotation_templates for select to authenticated using (private.crm_can('quotations','view') or private.crm_is_admin());
drop policy if exists crm_quotation_template_insert on public.crm_quotation_templates;
create policy crm_quotation_template_insert on public.crm_quotation_templates for insert to authenticated with check (private.crm_is_admin());
drop policy if exists crm_quotation_template_update on public.crm_quotation_templates;
create policy crm_quotation_template_update on public.crm_quotation_templates for update to authenticated using (private.crm_is_admin()) with check (private.crm_is_admin());
drop policy if exists crm_quotation_template_delete on public.crm_quotation_templates;
create policy crm_quotation_template_delete on public.crm_quotation_templates for delete to authenticated using (private.crm_is_admin());

insert into public.crm_quotation_templates(name,description,is_default,status,title_th,title_en,document_prefix,accent_color,company_name_th,company_name_en,company_address_th,company_address_en,company_phone,company_email,company_line,company_tax_id,default_payment_terms,default_tax_rate,default_wht_rate,default_currency,show_item_code,show_item_discount,show_gp,show_margin,show_wht)
select 'KC Standard Quotation','Account 360 style quotation',true,'active','ใบเสนอราคา','Quotation','SQ','#0AADA9','บริษัท เทคแซฟวี จำกัด','Tech Savvy Co., Ltd.','5 หัวหมาก 9 แขวงหัวหมาก บางกะปิ กรุงเทพมหานคร 10240','5 Huamak 9, Huamak, Bangkapi, Bangkok 10240','02 732 9100','sales@kai-com.com','@Kaicom','0105567153731',30,7,0,'THB',true,true,true,true,true
where not exists(select 1 from public.crm_quotation_templates where is_default=true);

alter table public.quotations
 add column if not exists template_id uuid,
 add column if not exists template_snapshot jsonb not null default '{}'::jsonb,
 add column if not exists reference_document text not null default '',
 add column if not exists document_discount numeric not null default 0,
 add column if not exists currency text not null default 'THB',
 add column if not exists gp_amount numeric not null default 0,
 add column if not exists reviewed_by text not null default '',
 add column if not exists approved_by text not null default '';

do $$ begin
 if not exists(select 1 from pg_constraint where conname='quotations_template_id_fkey' and conrelid='public.quotations'::regclass) then
  alter table public.quotations add constraint quotations_template_id_fkey foreign key(template_id) references public.crm_quotation_templates(id) on delete set null;
 end if;
 if not exists(select 1 from pg_constraint where conname='quotations_document_discount_nonnegative' and conrelid='public.quotations'::regclass) then
  alter table public.quotations add constraint quotations_document_discount_nonnegative check(document_discount>=0);
 end if;
end $$;

alter table public.quotations alter column code set default ('SQ-'||to_char(current_date,'YYYYMM')||'-'||lpad(nextval('public.quot_seq'::regclass)::text,6,'0'));
comment on table public.crm_quotation_templates is 'Admin-managed KC CuTo quotation document templates.';
comment on column public.quotations.template_snapshot is 'Immutable document-template snapshot captured when the quotation is saved.';
notify pgrst,'reload schema';
