-- Add exact CRM relationships to the existing converted-SO feed. No order is created here.
alter table public.kc_dw_sales_order_facts
 add column customer_id uuid references public.customers(id) on delete set null,
 add column customer_source_id text not null default '',
 add column customer_name text not null default '',
 add column product_lines jsonb not null default '[]'::jsonb,
 add column currency text not null default 'THB',
 add constraint kc_dw_so_product_lines_shape check (jsonb_typeof(product_lines)='array' and jsonb_array_length(product_lines)<=500),
 add constraint kc_dw_so_currency_shape check (currency ~ '^[A-Z]{3}$');
create index kc_dw_so_customer_idx on public.kc_dw_sales_order_facts(customer_id);
create index kc_dw_so_converted_idx on public.kc_dw_sales_order_facts(converted_at) where status='converted';
alter table public.kc_dw_sales_order_facts enable row level security;
-- The existing feed writes as service_role. CRM users can only read allowed reporting columns.
revoke all on public.kc_dw_sales_order_facts from anon,authenticated;
grant select(id,source_system,source_so_id,so_number,sales_email,sales_name,converted_at,net_amount,status,source_updated_at,synced_at,customer_id,customer_source_id,customer_name,product_lines,currency)
 on public.kc_dw_sales_order_facts to authenticated;
create policy crm_so_map_read on public.kc_dw_sales_order_facts for select to authenticated
 using(private.crm_can('quotations','view') and private.crm_can('customers','view'));
