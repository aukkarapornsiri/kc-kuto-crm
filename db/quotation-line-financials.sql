alter table public.crm_quotation_financials add column if not exists line_financials jsonb check (jsonb_typeof(line_financials)='array');
CREATE OR REPLACE FUNCTION private.crm_quote_totals()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  item jsonb;q numeric;p numeric;d numeric;c numeric;line_net numeric;line_cost numeric;
  line_gp numeric;line_margin numeric;sub numeric:=0;line_disc numeric:=0;total_cost numeric:=0;
  actual_gp numeric:=0;actual_margin numeric:=0;doc_disc numeric:=0;net_before_tax numeric:=0;
  price_id uuid;clean jsonb:='[]'::jsonb;financial_lines jsonb:='[]'::jsonb;can_financial boolean:=false;
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
    financial_lines:=financial_lines||jsonb_build_array(jsonb_build_object('cost_total',line_cost,'gp',line_gp,'margin',line_margin,'net',line_net));
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

  insert into public.crm_quotation_financials(quotation_id,cost_total,gp_amount,gp_margin,updated_at,line_financials)
  values(new.id,round(total_cost,2),actual_gp,actual_margin,clock_timestamp(),financial_lines)
  on conflict(quotation_id) do update
  set cost_total=excluded.cost_total,gp_amount=excluded.gp_amount,gp_margin=excluded.gp_margin,updated_at=excluded.updated_at,line_financials=excluded.line_financials;

  new.gp_amount:=0;
  new.gp_margin:=0;
  return new;
end
$function$
;
