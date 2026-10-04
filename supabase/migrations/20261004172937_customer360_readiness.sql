create table public.crm_customer_readiness (
 customer_id uuid primary key references public.customers(id) on delete cascade,
 details jsonb not null default '{}'::jsonb check(jsonb_typeof(details)='object' and octet_length(details::text)<=40000),
 updated_at timestamptz not null default clock_timestamp(),
 updated_by uuid not null default auth.uid()
);
alter table public.crm_customer_readiness enable row level security;
revoke all on public.crm_customer_readiness from anon,authenticated;
grant select,insert,update on public.crm_customer_readiness to authenticated;
create policy readiness_read on public.crm_customer_readiness for select to authenticated using(private.crm_can('customers','view') and exists(select 1 from public.customers c where c.id=customer_id));
create policy readiness_insert on public.crm_customer_readiness for insert to authenticated with check(private.crm_can('customers','view') and private.crm_can('customers','edit') and updated_by=auth.uid() and exists(select 1 from public.customers c where c.id=customer_id));
create policy readiness_update on public.crm_customer_readiness for update to authenticated using(private.crm_can('customers','view') and private.crm_can('customers','edit') and exists(select 1 from public.customers c where c.id=customer_id)) with check(private.crm_can('customers','view') and private.crm_can('customers','edit') and updated_by=auth.uid() and exists(select 1 from public.customers c where c.id=customer_id));
create function public.crm_stamp_customer_readiness() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' and new.customer_id<>old.customer_id then raise exception 'Customer reference cannot be changed';end if;
 new.updated_at:=clock_timestamp();new.updated_by:=auth.uid();return new;
end $$;
revoke all on function public.crm_stamp_customer_readiness() from public,anon,authenticated;
create trigger crm_readiness_stamp before insert or update on public.crm_customer_readiness for each row execute function public.crm_stamp_customer_readiness();
