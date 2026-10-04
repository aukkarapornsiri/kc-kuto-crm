create table public.crm_customer_finance_entries (
 id uuid primary key default gen_random_uuid(),
 customer_id uuid not null references public.customers(id) on delete restrict,
 kind text not null check(kind in('invoice','payment')),
 reference text not null check(length(btrim(reference)) between 1 and 150),
 invoice_id uuid references public.crm_customer_finance_entries(id) on delete restrict,
 amount numeric(16,2) not null check(amount>0 and amount<=1000000000000),
 currency text not null default 'THB' check(currency in('THB','USD','EUR','JPY')),
 issued_on date not null,
 due_on date,
 source text not null default 'manual' check(source='manual'),
 note text not null default '' check(length(note)<=2000),
 status text not null default 'active' check(status in('active','void')),
 void_reason text not null default '' check(length(void_reason)<=500),
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 created_by uuid not null default auth.uid(),
 updated_by uuid not null default auth.uid(),
 check((kind='invoice' and invoice_id is null and due_on is not null and due_on>=issued_on) or(kind='payment' and invoice_id is not null and due_on is null)),
 unique(customer_id,kind,reference)
);
create index crm_customer_finance_account_idx on public.crm_customer_finance_entries(customer_id,issued_on);
create index crm_customer_finance_invoice_idx on public.crm_customer_finance_entries(invoice_id);
alter table public.crm_customer_finance_entries enable row level security;
revoke all on public.crm_customer_finance_entries from anon,authenticated;
grant select,insert,update on public.crm_customer_finance_entries to authenticated;
create policy finance_read on public.crm_customer_finance_entries for select to authenticated using(private.crm_can('customers','view') and private.crm_can('quotations','view') and exists(select 1 from public.customers c where c.id=customer_id));
create policy finance_insert on public.crm_customer_finance_entries for insert to authenticated with check(private.crm_can('customers','view') and private.crm_can('quotations','view') and private.crm_can('quotations','approve') and created_by=auth.uid() and updated_by=auth.uid() and exists(select 1 from public.customers c where c.id=customer_id));
create policy finance_update on public.crm_customer_finance_entries for update to authenticated using(private.crm_can('customers','view') and private.crm_can('quotations','view') and private.crm_can('quotations','approve')) with check(private.crm_can('customers','view') and private.crm_can('quotations','view') and private.crm_can('quotations','approve') and updated_by=auth.uid());
create function public.crm_validate_finance_reference() returns trigger language plpgsql security invoker set search_path='' as $$
declare inv public.crm_customer_finance_entries; paid numeric;
begin
 if tg_op='UPDATE' then
  if (to_jsonb(new)-array['status','void_reason','updated_at','updated_by']) is distinct from (to_jsonb(old)-array['status','void_reason','updated_at','updated_by']) then raise exception 'Entries are immutable; void and create a correction';end if;
  if old.status='void' or new.status<>'void' or length(btrim(new.void_reason))<5 then raise exception 'Voiding requires an active entry and a reason of at least 5 characters';end if;
  if old.kind='invoice' and exists(select 1 from public.crm_customer_finance_entries where invoice_id=old.id and status='active')then raise exception 'Void active payments before voiding the invoice';end if;
 else
  if new.status<>'active' or new.void_reason<>'' then raise exception 'New entries must be active';end if;
  new.created_by:=auth.uid();new.created_at:=clock_timestamp();
 end if;
 if new.kind='payment' then
  select * into inv from public.crm_customer_finance_entries where id=new.invoice_id for update;
  if inv.id is null or inv.kind<>'invoice' or inv.customer_id<>new.customer_id or inv.currency<>new.currency or inv.status<>'active' then raise exception 'Invalid invoice/customer/currency';end if;
  if new.issued_on<inv.issued_on then raise exception 'Payment date precedes invoice';end if;
  if new.status='active' then
   select coalesce(sum(amount),0) into paid from public.crm_customer_finance_entries where invoice_id=inv.id and status='active' and id<>new.id;
   if paid+new.amount>inv.amount then raise exception 'Payment exceeds outstanding balance';end if;
  end if;
 end if;
 new.updated_at:=clock_timestamp();new.updated_by:=auth.uid();return new;
end $$;
revoke all on function public.crm_validate_finance_reference() from public,anon,authenticated;
create trigger crm_validate_finance_reference before insert or update on public.crm_customer_finance_entries for each row execute function public.crm_validate_finance_reference();
