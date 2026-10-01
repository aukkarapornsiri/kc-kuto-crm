create or replace function private.crm_inventory_part_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare m public.crm_stock_movements; w text;
begin
 select * into m from public.crm_stock_movements where service_part_id=old.id;
 if found then
 select code into w from public.crm_warehouses where id=m.warehouse_id;
 if new.inventory_reference is distinct from m.id::text or new.stock_location is distinct from w or (to_jsonb(new)-array['updated_at','inventory_reference','stock_location','old_part_returned']) is distinct from (to_jsonb(old)-array['updated_at','inventory_reference','stock_location','old_part_returned']) then raise exception 'Issued service part and stock reference are locked; record a separate correction'; end if;
 end if; return new;
end $$;
create or replace function private.crm_inventory_price_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.crm_inventory_settings where id for update;
 if new.unit is distinct from old.unit and exists(select 1 from public.crm_stock_movements where item_id=old.id) then raise exception 'Unit is locked after stock movement'; end if;
 new.updated_at:=clock_timestamp();return new;
end $$;
revoke all on function private.crm_inventory_part_guard(),private.crm_inventory_price_guard() from public,anon,authenticated;
