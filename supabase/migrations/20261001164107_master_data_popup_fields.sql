-- Additive fields only. No production examples or business-record rewrites.
alter table public.master_data_items drop constraint master_data_items_category_check;
alter table public.master_data_items add constraint master_data_items_category_check check(category in ('customer_type','industry','lead_source','sales_stage','product_category','region','tier','unit','tag','loss_reason','asset_type','asset_brand','asset_model','asset_status','warranty_status','license_status','asset_location','product_type','product_kind','accounting_account','business_line'));
alter table public.master_data_items
 add column description text not null default '' check(length(description)<=5000),
 add column business_line_id uuid references public.master_data_items(id),
 add column income_account_id uuid references public.master_data_items(id),
 add column expense_account_id uuid references public.master_data_items(id),
 add column inventory_account_id uuid references public.master_data_items(id),
 add column asset_account_id uuid references public.master_data_items(id),
 add column deferred_account_id uuid references public.master_data_items(id);
create index crm_master_business_line on public.master_data_items(business_line_id) where business_line_id is not null;
create index crm_master_income on public.master_data_items(income_account_id) where income_account_id is not null;
create index crm_master_expense on public.master_data_items(expense_account_id) where expense_account_id is not null;
create index crm_master_inventory on public.master_data_items(inventory_account_id) where inventory_account_id is not null;
create index crm_master_asset on public.master_data_items(asset_account_id) where asset_account_id is not null;
create index crm_master_deferred on public.master_data_items(deferred_account_id) where deferred_account_id is not null;
create function private.crm_master_validate_links() returns trigger language plpgsql security invoker set search_path='' as $$
declare k text; ref_id uuid; expected text; changed boolean;
begin
 foreach k in array array['business_line_id','income_account_id','expense_account_id','inventory_account_id','asset_account_id','deferred_account_id'] loop
  ref_id:=(to_jsonb(new)->>k)::uuid;
  if ref_id is not null then
   if new.category<>'product_category' then raise exception 'Account and business-line links are for product categories only'; end if;
   expected:=case when k='business_line_id' then 'business_line' else 'accounting_account' end;
   changed:=tg_op='INSERT';
   if tg_op='UPDATE' then changed:=(to_jsonb(old)->>k) is distinct from (to_jsonb(new)->>k); end if;
   if not exists(select 1 from public.master_data_items r where r.id=ref_id and r.category=expected and (not changed or r.status='active')) then raise exception 'Invalid or inactive master reference: %',k; end if;
  end if;
 end loop;
 return new;
end $$;
revoke all on function private.crm_master_validate_links() from public;
grant execute on function private.crm_master_validate_links() to authenticated,service_role;
create trigger crm_master_links before insert or update on public.master_data_items for each row execute function private.crm_master_validate_links();
notify pgrst, 'reload schema';
