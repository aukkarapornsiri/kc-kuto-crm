create or replace function private.crm_inventory_item_action(p_id uuid,p_action text,p_updated_at timestamptz)
returns void language plpgsql security definer set search_path='' as $$
declare v public.crm_price_items;
begin
 if auth.uid() is null or not private.crm_is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
 perform 1 from public.crm_inventory_settings where id for update;
 select * into v from public.crm_price_items where id=p_id for update;
 if not found then raise exception 'Item not found'; end if;
 if v.updated_at is distinct from p_updated_at then raise exception 'Record changed. Reload before saving.'; end if;
 if p_action in ('active','inactive') then
 update public.crm_price_items set status=p_action,updated_at=clock_timestamp() where id=p_id;
 elsif p_action='delete' then
 if exists(select 1 from public.crm_stock_movements where item_id=p_id) or exists(select 1 from public.crm_stock_balances where item_id=p_id) then raise exception 'This item has stock history. Deactivate it instead.'; end if;
 delete from public.crm_stock_levels where item_id=p_id;
 delete from public.crm_item_details where id=p_id;
 delete from public.crm_price_items where id=p_id;
 else raise exception 'Invalid item action'; end if;
end; $$;
revoke all on function private.crm_inventory_item_action(uuid,text,timestamptz) from public,anon;
grant execute on function private.crm_inventory_item_action(uuid,text,timestamptz) to authenticated;
create or replace function public.crm_inventory_item_action(p_id uuid,p_action text,p_updated_at timestamptz)
returns void language sql security invoker set search_path='' as $$ select private.crm_inventory_item_action(p_id,p_action,p_updated_at); $$;
revoke all on function public.crm_inventory_item_action(uuid,text,timestamptz) from public,anon;
grant execute on function public.crm_inventory_item_action(uuid,text,timestamptz) to authenticated;