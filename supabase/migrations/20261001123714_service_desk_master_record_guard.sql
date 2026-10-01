create or replace function private.crm_service_master_guard() returns trigger language plpgsql set search_path='' as $$ declare t public.tickets;begin
 if tg_table_name='assets' then
 if new.branch_id is not null and not exists(select 1 from public.crm_branches where id=new.branch_id and customer_id=new.customer_id) then raise exception 'Asset branch customer mismatch';end if;
 if new.assigned_user_id is not null and not exists(select 1 from public.contacts where id=new.assigned_user_id and customer_id=new.customer_id) then raise exception 'Asset user customer mismatch';end if;
 elsif tg_table_name='quotations' then
 if new.service_ticket_id is not null then
 select * into t from public.tickets where id=new.service_ticket_id;
 if t.id is null or t.customer_id is distinct from new.customer_id or t.asset_id is distinct from new.service_asset_id then raise exception 'Quotation ticket/customer/asset mismatch';end if;
 end if;end if;return new;end $$;
