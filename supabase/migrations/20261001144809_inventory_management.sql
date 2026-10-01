-- Internal stock uses the existing quotation price book, never the public shop catalogue.
alter table public.master_data_items drop constraint master_data_items_category_check;
alter table public.master_data_items add constraint master_data_items_category_check check(category in ('customer_type','industry','lead_source','sales_stage','product_category','region','tier','unit','tag','loss_reason','asset_type','asset_brand','asset_model','asset_status','warranty_status','license_status','asset_location','product_type','product_kind','accounting_account'));
create table public.crm_warehouses(id uuid primary key default gen_random_uuid(),code text not null unique check(code ~ '^[A-Z0-9][A-Z0-9_-]{0,39}$'),name text not null check(length(btrim(name)) between 1 and 200),address text not null default '',active boolean not null default true,updated_at timestamptz not null default now());
create table public.crm_inventory_settings(id boolean primary key default true check(id),enabled boolean not null default false,allow_negative boolean not null default false,default_warehouse_id uuid references public.crm_warehouses(id),updated_at timestamptz not null default now());
insert into public.crm_inventory_settings(id) values(true);
create table public.crm_item_details(id uuid primary key references public.crm_price_items(id),stock_mode text not null default 'service' check(stock_mode in ('stock','nonstock','service')),product_type text not null default '',product_kind text not null default '',brand text not null default '',part_number text not null default '',barcode text not null default '',vat_mode text not null default 'exclusive' check(vat_mode in ('exclusive','inclusive','exempt')),subscription text not null default '',contract_start date,contract_end date,track_serial boolean not null default false,product_id text references public.products(id),income_account text not null default '',expense_account text not null default '',inventory_account text not null default '',asset_account text not null default '',deferred_account text not null default '',check(contract_end is null or contract_start is null or contract_end>=contract_start),check(not track_serial or stock_mode='stock'));
create table public.crm_stock_levels(id uuid primary key default gen_random_uuid(),warehouse_id uuid not null references public.crm_warehouses(id),item_id uuid not null references public.crm_price_items(id),reorder_point numeric not null default 0 check(reorder_point>=0 and reorder_point<1000000000),unique(warehouse_id,item_id));
create table public.crm_stock_balances(id uuid primary key default gen_random_uuid(),warehouse_id uuid not null references public.crm_warehouses(id),item_id uuid not null references public.crm_price_items(id),serial_number text not null default '',quantity numeric not null default 0 check(abs(quantity)<1000000000),unique(warehouse_id,item_id,serial_number));
create table public.crm_stock_movements(id uuid primary key,kind text not null check(kind in ('opening','receipt','issue','transfer','adjustment')),item_id uuid not null references public.crm_price_items(id),warehouse_id uuid not null references public.crm_warehouses(id),to_warehouse_id uuid references public.crm_warehouses(id),serial_number text not null default '',quantity numeric not null check(quantity<>0 and abs(quantity)<1000000000),reason text not null check(length(btrim(reason)) between 1 and 1000),service_part_id uuid references public.crm_service_parts(id),created_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),request jsonb not null);
create unique index crm_stock_service_part_once on public.crm_stock_movements(service_part_id) where service_part_id is not null;
create index crm_stock_history_item on public.crm_stock_movements(item_id,created_at desc);
create index crm_stock_history_warehouse on public.crm_stock_movements(warehouse_id,created_at desc);
create index crm_stock_history_destination on public.crm_stock_movements(to_warehouse_id);
create index crm_stock_history_actor on public.crm_stock_movements(created_by);
create index crm_stock_balance_item on public.crm_stock_balances(item_id);
create index crm_stock_level_item on public.crm_stock_levels(item_id);
create index crm_item_product on public.crm_item_details(product_id);
create index crm_inventory_default_wh on public.crm_inventory_settings(default_warehouse_id);
-- Active administrators own inventory writes; financial visibility stays with quotation approval.
do $$ declare n text; begin foreach n in array array['crm_warehouses','crm_inventory_settings','crm_item_details','crm_stock_levels','crm_stock_balances','crm_stock_movements'] loop
 execute format('alter table public.%I enable row level security',n);
 execute format('revoke all on public.%I from anon,authenticated',n);
 execute format('grant select on public.%I to authenticated',n);
 execute format('create policy inventory_read on public.%I for select to authenticated using(private.crm_can(''quotations'',''view'') or private.crm_can(''tickets'',''view''))',n);
 if n in ('crm_warehouses','crm_inventory_settings','crm_stock_levels') then
 execute format('grant insert,update on public.%I to authenticated',n);
 execute format('create policy inventory_insert on public.%I for insert to authenticated with check(private.crm_is_admin())',n);
 execute format('create policy inventory_update on public.%I for update to authenticated using(private.crm_is_admin()) with check(private.crm_is_admin())',n);
 execute format('create trigger inventory_audit after insert or update on public.%I for each row execute function private.crm_settings_audit()',n);
 end if;
 end loop; end $$;
create function private.crm_inventory_save_item(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid:=coalesce(nullif(p->>'id','')::uuid,gen_random_uuid()); v_old public.crm_price_items; v_details public.crm_item_details; v_code text; v_name text:=btrim(p->>'name'); v_unit text:=btrim(p->>'unit'); v_mode text:=coalesce(p->>'stock_mode','service'); v_serial boolean:=coalesce((p->>'track_serial')::boolean,false); v_price numeric:=(p->>'price')::numeric; v_cost numeric:=(p->>'cost')::numeric;
begin
 if auth.uid() is null or not private.crm_is_admin() then raise insufficient_privilege using message='Administrator required'; end if;
 perform 1 from public.crm_inventory_settings where id for update;
 select * into v_old from public.crm_price_items where id=v_id for update;
 if found and (p->>'updated_at')::timestamptz is distinct from v_old.updated_at then raise exception 'Record changed. Reload before saving.'; end if;
 if coalesce(length(v_name),0) not between 1 and 200 or coalesce(length(v_unit),0) not between 1 and 80 or v_price is null or v_cost is null or not(v_price>=0 and v_price<1000000000 and v_cost>=0 and v_cost<1000000000) then raise exception 'Name, unit and valid prices required'; end if;
 v_code:=upper(coalesce(nullif(btrim(p->>'code'),''),'ITEM-'||substr(replace(v_id::text,'-',''),1,12)));
 if v_code !~ '^[A-Z0-9][A-Z0-9_-]{0,39}$' then raise exception 'Invalid item code'; end if;
 if exists(select 1 from public.crm_price_items where upper(code)=v_code and id<>v_id) then raise exception 'Duplicate item code'; end if;
 select * into v_details from public.crm_item_details where id=v_id;
 if exists(select 1 from public.crm_stock_movements where item_id=v_id) and (v_mode is distinct from v_details.stock_mode or v_serial is distinct from v_details.track_serial or v_unit is distinct from v_old.unit) then raise exception 'Stock mode, serial tracking and unit are locked after stock movement'; end if;
 insert into public.crm_price_items(id,name,code,category,unit,price,cost,description,status) values(v_id,v_name,v_code,coalesce(p->>'category',''),v_unit,v_price,v_cost,coalesce(p->>'description',''),coalesce(p->>'status','active')) on conflict(id) do update set name=excluded.name,code=excluded.code,category=excluded.category,unit=excluded.unit,price=excluded.price,cost=excluded.cost,description=excluded.description,status=excluded.status,updated_at=clock_timestamp();
 insert into public.crm_item_details(id,stock_mode,product_type,product_kind,brand,part_number,barcode,vat_mode,subscription,contract_start,contract_end,track_serial,product_id,income_account,expense_account,inventory_account,asset_account,deferred_account)
 values(v_id,v_mode,coalesce(p->>'product_type',''),coalesce(p->>'product_kind',''),coalesce(p->>'brand',''),coalesce(p->>'part_number',''),coalesce(p->>'barcode',''),coalesce(p->>'vat_mode','exclusive'),coalesce(p->>'subscription',''),nullif(p->>'contract_start','')::date,nullif(p->>'contract_end','')::date,v_serial,nullif(p->>'product_id',''),coalesce(p->>'income_account',''),coalesce(p->>'expense_account',''),coalesce(p->>'inventory_account',''),coalesce(p->>'asset_account',''),coalesce(p->>'deferred_account',''))
 on conflict(id) do update set stock_mode=excluded.stock_mode,product_type=excluded.product_type,product_kind=excluded.product_kind,brand=excluded.brand,part_number=excluded.part_number,barcode=excluded.barcode,vat_mode=excluded.vat_mode,subscription=excluded.subscription,contract_start=excluded.contract_start,contract_end=excluded.contract_end,track_serial=excluded.track_serial,product_id=excluded.product_id,income_account=excluded.income_account,expense_account=excluded.expense_account,inventory_account=excluded.inventory_account,asset_account=excluded.asset_account,deferred_account=excluded.deferred_account;
 return v_id;
end $$;
create trigger inventory_item_audit after insert or update on public.crm_item_details for each row execute function private.crm_settings_audit();
create function public.crm_inventory_save_item(p jsonb) returns uuid language sql security invoker set search_path='' as $$select private.crm_inventory_save_item(p)$$;
-- One atomic transaction serializes postings/settings, checks idempotency and maintains immutable history.
create function private.crm_inventory_post(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid:=(p->>'id')::uuid; v_item uuid:=(p->>'item_id')::uuid; v_wh uuid:=(p->>'warehouse_id')::uuid; v_to uuid:=nullif(p->>'to_warehouse_id','')::uuid; v_kind text:=p->>'kind'; v_qty numeric:=(p->>'quantity')::numeric; v_sn text:=btrim(coalesce(p->>'serial_number','')); v_delta numeric; v_current numeric; v_settings public.crm_inventory_settings; v_detail public.crm_item_details; v_price public.crm_price_items; v_part public.crm_service_parts; v_existing public.crm_stock_movements; v_part_id uuid:=nullif(p->>'service_part_id','')::uuid;
begin
 if auth.uid() is null or not private.crm_is_admin() then raise insufficient_privilege using message='Administrator required'; end if;
 select * into v_settings from public.crm_inventory_settings where id for update;
 select * into v_existing from public.crm_stock_movements where id=v_id;
 if found then if v_existing.request<>p then raise exception 'Request ID already used with different data'; end if; return v_id; end if;
 if not v_settings.enabled then raise exception 'Enable stock control first'; end if;
 if v_id is null or v_qty is null or v_qty=0 or not(abs(v_qty)<1000000000) or v_kind not in ('opening','receipt','issue','transfer','adjustment') or (v_kind<>'adjustment' and v_qty<0) then raise exception 'Invalid movement or quantity'; end if;
 if not exists(select 1 from public.crm_warehouses where id=v_wh and active) or (v_kind='transfer' and (v_to is null or v_to=v_wh or not exists(select 1 from public.crm_warehouses where id=v_to and active))) then raise exception 'Select active source and distinct destination warehouses'; end if;
 if v_kind<>'transfer' and v_to is not null then raise exception 'Destination only valid for transfers'; end if;
 select * into v_price from public.crm_price_items where id=v_item;
 select * into v_detail from public.crm_item_details where id=v_item;
 if v_detail.id is null or v_detail.stock_mode<>'stock' or v_price.status<>'active' then raise exception 'Active stock-controlled item required'; end if;
 if (v_detail.track_serial and (length(v_sn)=0 or abs(v_qty)<>1)) or (not v_detail.track_serial and v_sn<>'') then raise exception 'Serial-tracked items require one unit and one serial number'; end if;
 v_delta:=case when v_kind in ('issue','transfer') then -v_qty else v_qty end;
 if v_kind='opening' and exists(select 1 from public.crm_stock_movements where item_id=v_item and (warehouse_id=v_wh or to_warehouse_id=v_wh) and serial_number=v_sn) then raise exception 'Opening balance already initialized. Use an adjustment.'; end if;
 if v_part_id is not null then
 if v_kind<>'issue' then raise exception 'Service parts must use issue'; end if;
 select * into v_part from public.crm_service_parts where id=v_part_id for update;
 if v_part.id is null or not private.crm_service_access(v_part.ticket_id,'edit') or v_part.quantity<>v_qty or (v_part.product_id is not null and v_part.product_id is distinct from v_detail.product_id) or (v_part.part_no<>v_price.code and v_part.part_no<>v_detail.part_number) or coalesce(v_part.serial_number,'')<>v_sn then raise exception 'Service part item, quantity and serial must match'; end if;
 if exists(select 1 from public.tickets where id=v_part.ticket_id and status='closed') then raise exception 'Closed service case'; end if;
 end if;
 insert into public.crm_stock_balances(warehouse_id,item_id,serial_number) values(v_wh,v_item,v_sn) on conflict(warehouse_id,item_id,serial_number) do nothing;
 select quantity into v_current from public.crm_stock_balances where warehouse_id=v_wh and item_id=v_item and serial_number=v_sn for update;
 if v_current+v_delta<0 and (not v_settings.allow_negative or v_detail.track_serial) then raise exception 'Insufficient stock'; end if;
 if v_detail.track_serial and v_delta>0 and exists(select 1 from public.crm_stock_balances where item_id=v_item and serial_number=v_sn and quantity>0) then raise exception 'Serial number already in stock'; end if;
 update public.crm_stock_balances set quantity=quantity+v_delta where warehouse_id=v_wh and item_id=v_item and serial_number=v_sn;
 if v_kind='transfer' then
 insert into public.crm_stock_balances(warehouse_id,item_id,serial_number,quantity) values(v_to,v_item,v_sn,v_qty) on conflict(warehouse_id,item_id,serial_number) do update set quantity=public.crm_stock_balances.quantity+excluded.quantity;
 end if;
 insert into public.crm_stock_movements(id,kind,item_id,warehouse_id,to_warehouse_id,serial_number,quantity,reason,service_part_id,created_by,request) values(v_id,v_kind,v_item,v_wh,v_to,v_sn,v_qty,btrim(p->>'reason'),v_part_id,auth.uid(),p);
 if v_part_id is not null then update public.crm_service_parts set stock_location=(select code from public.crm_warehouses where id=v_wh),inventory_reference=v_id::text where id=v_part_id; end if;
 return v_id;
end $$;
create function public.crm_inventory_post(p jsonb) returns uuid language sql security invoker set search_path='' as $$select private.crm_inventory_post(p)$$;
revoke all on function private.crm_inventory_save_item(jsonb),private.crm_inventory_post(jsonb),public.crm_inventory_save_item(jsonb),public.crm_inventory_post(jsonb) from public,anon;
grant execute on function private.crm_inventory_save_item(jsonb),private.crm_inventory_post(jsonb),public.crm_inventory_save_item(jsonb),public.crm_inventory_post(jsonb) to authenticated;
-- Prevent edits to the identity/quantity of a part already issued from inventory.
create function private.crm_inventory_part_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.crm_stock_movements where service_part_id=old.id) then
 if (to_jsonb(new)-array['updated_at','inventory_reference','stock_location','old_part_returned']) is distinct from (to_jsonb(old)-array['updated_at','inventory_reference','stock_location','old_part_returned']) then raise exception 'Issued service part is locked; record a separate correction'; end if;
 end if; return new;
end $$;
revoke all on function private.crm_inventory_part_guard() from public,anon,authenticated;
create trigger inventory_part_guard before update on public.crm_service_parts for each row execute function private.crm_inventory_part_guard();
create function private.crm_inventory_price_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.unit is distinct from old.unit and exists(select 1 from public.crm_stock_movements where item_id=old.id) then raise exception 'Unit is locked after stock movement'; end if;
 new.updated_at:=clock_timestamp();return new;
end $$;
revoke all on function private.crm_inventory_price_guard() from public,anon,authenticated;
create trigger inventory_price_guard before update on public.crm_price_items for each row execute function private.crm_inventory_price_guard();
