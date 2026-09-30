-- Additive customer profile extension. Existing addresses and relationships are preserved.
alter table public.customers
 add column if not exists description text,
 add column if not exists parent_customer_id uuid references public.customers(id) on delete restrict,
 add column if not exists billing_country text,
 add column if not exists billing_postal_code text,
 add column if not exists shipping_country text,
 add column if not exists shipping_street text,
 add column if not exists shipping_city text,
 add column if not exists shipping_state text,
 add column if not exists shipping_postal_code text;
create index if not exists customers_parent_customer_id_idx on public.customers(parent_customer_id);
create or replace function private.crm_customer_parent_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
declare cursor_id uuid; next_id uuid; seen uuid[];
begin
 if new.parent_customer_id is null then return new; end if;
 if TG_OP='UPDATE' and new.parent_customer_id is not distinct from old.parent_customer_id then return new; end if;
 perform pg_catalog.pg_advisory_xact_lock(20300930,1643);
 cursor_id:=new.parent_customer_id; seen:=array[new.id];
 while cursor_id is not null loop
  if cursor_id=any(seen) then raise exception 'Parent account cannot be itself or a descendant' using errcode='23514'; end if;
  seen:=array_append(seen,cursor_id);
  select parent_customer_id into next_id from public.customers where id=cursor_id;
  if not found then raise exception 'Parent account not found or access denied' using errcode='42501'; end if;
  cursor_id:=next_id;
 end loop;
 return new;
end $$;
create trigger crm_customer_parent_guard before insert or update of parent_customer_id on public.customers for each row execute function private.crm_customer_parent_guard();
notify pgrst,'reload schema';
