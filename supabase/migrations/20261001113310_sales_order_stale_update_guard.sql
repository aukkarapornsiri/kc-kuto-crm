-- This trigger runs under the row lock held by UPSERT, preventing concurrent old events
-- from replacing newer cancellations or values even after both callers pre-read the row.
create or replace function private.crm_so_ignore_stale_update()
returns trigger language plpgsql set search_path='' as $$
begin
 if old.source_updated_at is not null and new.source_updated_at is not null
    and new.source_updated_at<old.source_updated_at then return null;end if;
 return new;
end $$;
create trigger crm_so_ignore_stale_update before update on public.kc_dw_sales_order_facts
 for each row execute function private.crm_so_ignore_stale_update();
alter policy crm_so_map_read on public.kc_dw_sales_order_facts
 using((select private.crm_can('quotations','view')) and (select private.crm_can('customers','view')));
