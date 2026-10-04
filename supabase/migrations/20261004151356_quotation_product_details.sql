alter table public.crm_price_items add column if not exists product_details jsonb not null default '{}'::jsonb;
alter table public.crm_price_items add constraint crm_price_product_details_object check (jsonb_typeof(product_details)='object');
