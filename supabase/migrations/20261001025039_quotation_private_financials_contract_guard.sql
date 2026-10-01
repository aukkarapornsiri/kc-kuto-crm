create table if not exists public.crm_quotation_financials (
  quotation_id uuid primary key,
  cost_total numeric not null default 0,
  gp_amount numeric not null default 0,
  gp_margin numeric not null default 0,
  updated_at timestamptz not null default now(),
  constraint crm_quotation_financials_quote_fkey
    foreign key (quotation_id) references public.quotations(id)
    on delete cascade deferrable initially deferred
);

alter table public.crm_quotation_financials enable row level security;
grant select on public.crm_quotation_financials to authenticated;
grant all on public.crm_quotation_financials to service_role;

drop policy if exists crm_quotation_financials_read on public.crm_quotation_financials;
create policy crm_quotation_financials_read
on public.crm_quotation_financials for select
to authenticated
using (private.crm_can('quotations','approve'));

insert into public.crm_quotation_financials(quotation_id,cost_total,gp_amount,gp_margin,updated_at)
select id,greatest(0,coalesce(subtotal,0)-coalesce(discount,0)-coalesce(gp_amount,0)),
       coalesce(gp_amount,0),coalesce(gp_margin,0),coalesce(updated_at,now())
from public.quotations
on conflict(quotation_id) do update
set cost_total=excluded.cost_total,gp_amount=excluded.gp_amount,gp_margin=excluded.gp_margin,updated_at=excluded.updated_at;

alter table public.quotations disable trigger crm_quote_totals;
alter table public.quotations disable trigger crm_quote_approval_guard;
alter table public.quotations disable trigger crm_quote_version;
update public.quotations set gp_amount=0,gp_margin=0
where coalesce(gp_amount,0)<>0 or coalesce(gp_margin,0)<>0;
alter table public.quotations enable trigger crm_quote_totals;
alter table public.quotations enable trigger crm_quote_approval_guard;
alter table public.quotations enable trigger crm_quote_version;

create or replace function private.crm_quote_totals()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  item jsonb;q numeric;p numeric;d numeric;c numeric;line_net numeric;line_cost numeric;
  line_gp numeric;line_margin numeric;sub numeric:=0;line_disc numeric:=0;total_cost numeric:=0;
  actual_gp numeric:=0;actual_margin numeric:=0;doc_disc numeric:=0;net_before_tax numeric:=0;
  price_id uuid;clean jsonb:='[]'::jsonb;can_financial boolean:=false;
begin
  if TG_OP='UPDATE'
     and (to_jsonb(new)-array['updated_at','status','approval_status','approval_comment'])
         is not distinct from (to_jsonb(old)-array['updated_at','status','approval_status','approval_comment'])
  then return new; end if;

  if TG_OP='UPDATE'
     and new.items is not distinct from old.items
     and new.tax_rate is not distinct from old.tax_rate
     and new.wht_rate is not distinct from old.wht_rate
     and new.document_discount is not distinct from old.document_discount
     and new.subtotal is not distinct from old.subtotal
     and new.discount is not distinct from old.discount
     and new.vat is not distinct from old.vat
     and new.total is not distinct from old.total
     and new.withholding_tax is not distinct from old.withholding_tax
     and new.net_total is not distinct from old.net_total
  then return new; end if;

  if new.items is null or jsonb_typeof(new.items)<>'array' then raise exception 'Invalid quotation items'; end if;
  if jsonb_array_length(new.items) not between 1 and 500 then raise exception 'Quotation requires 1 to 500 items'; end if;
  if new.tax_rate is null or new.wht_rate is null or new.tax_rate not between 0 and 100 or new.wht_rate not between 0 and 100 then
    raise exception 'Invalid VAT or WHT rate';
  end if;

  can_financial:=coalesce(private.crm_can('quotations','approve'),false);
  doc_disc:=coalesce(new.document_discount,0);
  if doc_disc<0 or doc_disc>=1e12 or doc_disc='NaN'::numeric then raise exception 'Invalid document discount'; end if;

  for item in select * from jsonb_array_elements(new.items) loop
    q:=(item->>'qty')::numeric;p:=(item->>'price')::numeric;d:=coalesce((item->>'discount')::numeric,0);
    price_id:=null;c:=null;
    if coalesce(item->>'price_item_id','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      price_id:=(item->>'price_item_id')::uuid;
    end if;
    if price_id is not null then
      select pi.cost into c from public.crm_price_items pi where pi.id=price_id and pi.status='active';
      if c is null then raise exception 'Price Book item is unavailable'; end if;
    elsif not can_financial then
      raise exception 'Price Book item is required for this quotation';
    else
      c:=coalesce((item->>'cost')::numeric,0);
    end if;

    if length(trim(coalesce(item->>'name','')))=0 or q is null or p is null or q<=0 or p<0 or d<0 or c<0 or d>q*p
       or q>=1e12 or p>=1e12 or d>=1e12 or c>=1e12
       or q='NaN'::numeric or p='NaN'::numeric or d='NaN'::numeric or c='NaN'::numeric
    then raise exception 'Invalid quotation quantity, price, discount or cost'; end if;

    line_net:=round(q*p-d,2);line_cost:=round(q*c,2);line_gp:=round(line_net-line_cost,2);
    line_margin:=case when line_net=0 then 0 else round(line_gp/line_net*100,2) end;
    sub:=sub+q*p;line_disc:=line_disc+d;total_cost:=total_cost+line_cost;
    clean:=clean||jsonb_build_array((item-'cost'-'gp'-'margin')||jsonb_build_object('total',line_net));
  end loop;

  new.items:=clean;new.subtotal:=round(sub,2);line_disc:=round(line_disc,2);
  if doc_disc>new.subtotal-line_disc then raise exception 'Document discount exceeds quotation value'; end if;
  new.document_discount:=round(doc_disc,2);new.discount:=round(line_disc+new.document_discount,2);
  net_before_tax:=round(new.subtotal-new.discount,2);new.vat:=round(net_before_tax*new.tax_rate/100,2);
  new.total:=round(net_before_tax+new.vat,2);new.withholding_tax:=round(net_before_tax*new.wht_rate/100,2);
  new.net_total:=round(new.total-new.withholding_tax,2);
  actual_gp:=round(net_before_tax-total_cost,2);
  actual_margin:=case when net_before_tax=0 then 0 else round(actual_gp/net_before_tax*100,2) end;

  insert into public.crm_quotation_financials(quotation_id,cost_total,gp_amount,gp_margin,updated_at)
  values(new.id,round(total_cost,2),actual_gp,actual_margin,clock_timestamp())
  on conflict(quotation_id) do update
  set cost_total=excluded.cost_total,gp_amount=excluded.gp_amount,gp_margin=excluded.gp_margin,updated_at=excluded.updated_at;

  new.gp_amount:=0;
  new.gp_margin:=0;
  return new;
end
$$;

create or replace function public.crm_quotation_financial_summary(p_quotation uuid default null)
returns table(quotation_id uuid,cost_total numeric,gp_amount numeric,gp_margin numeric,updated_at timestamptz)
language plpgsql stable security invoker set search_path=''
as $$
begin
  if auth.uid() is null or not private.crm_can('quotations','approve') then
    raise insufficient_privilege using message='Quotation approval permission required';
  end if;
  return query
  select f.quotation_id,f.cost_total,f.gp_amount,f.gp_margin,f.updated_at
  from public.crm_quotation_financials f
  where p_quotation is null or f.quotation_id=p_quotation
  order by f.updated_at desc;
end
$$;
revoke all on function public.crm_quotation_financial_summary(uuid) from public,anon;
grant execute on function public.crm_quotation_financial_summary(uuid) to authenticated;

create unique index if not exists crm_contract_one_per_quotation
on public.contracts(quotation_id)
where quotation_id is not null;

create or replace function private.crm_customer_links()
returns trigger
language plpgsql
set search_path=''
as $$
declare
  doc jsonb:=to_jsonb(new);old_doc jsonb:='{}';field text;tbl text;linked_customer uuid;link uuid;
begin
  if TG_OP='UPDATE' then old_doc:=to_jsonb(old);end if;
  for field,tbl in
    select * from (values
      ('contact_id','contacts'),
      ('opportunity_id','opportunities'),
      ('quotation_id','quotations'),
      ('contract_id','contracts'),
      ('asset_id','assets')
    ) refs(f,t)
  loop
    if not doc?field or doc->>field is null or doc->>'customer_id' is null then continue;end if;
    if TG_OP='UPDATE' and doc->>field is not distinct from old_doc->>field and doc->>'customer_id' is not distinct from old_doc->>'customer_id' then continue;end if;
    link:=(doc->>field)::uuid;
    execute format('select customer_id from public.%I where id=$1',tbl) into linked_customer using link;
    if linked_customer is distinct from (doc->>'customer_id')::uuid then
      raise exception 'Related record is inaccessible or belongs to another customer: %',field;
    end if;
  end loop;
  return new;
end
$$;

notify pgrst,'reload schema';
