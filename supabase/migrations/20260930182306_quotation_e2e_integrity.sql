-- No historical rows are rewritten. Recalculate only new/financially edited drafts.
create or replace function private.crm_quote_totals() returns trigger
language plpgsql security invoker set search_path='' as $$
declare item jsonb; q numeric; p numeric; d numeric; sub numeric:=0; disc numeric:=0; clean jsonb:='[]';
begin
 if TG_OP='UPDATE' and (to_jsonb(new)-array['updated_at','status','approval_status','approval_comment']) is not distinct from (to_jsonb(old)-array['updated_at','status','approval_status','approval_comment']) then return new; end if;
 if TG_OP='UPDATE' and new.items is not distinct from old.items and new.tax_rate is not distinct from old.tax_rate and new.wht_rate is not distinct from old.wht_rate and new.subtotal is not distinct from old.subtotal and new.discount is not distinct from old.discount and new.vat is not distinct from old.vat and new.total is not distinct from old.total and new.withholding_tax is not distinct from old.withholding_tax and new.net_total is not distinct from old.net_total then return new; end if;
 if new.items is null or jsonb_typeof(new.items)<>'array' then raise exception 'Invalid quotation items'; end if;
 if jsonb_array_length(new.items) not between 1 and 500 then raise exception 'Quotation requires 1 to 500 items'; end if;
 if new.tax_rate is null or new.wht_rate is null or new.tax_rate not between 0 and 100 or new.wht_rate not between 0 and 100 then raise exception 'Invalid VAT or WHT rate'; end if;
 for item in select * from jsonb_array_elements(new.items) loop
  q:=(item->>'qty')::numeric;p:=(item->>'price')::numeric;d:=coalesce((item->>'discount')::numeric,0);
  if length(trim(coalesce(item->>'name','')))=0 or q is null or p is null or q<=0 or p<0 or d<0 or d>q*p or q>=1e12 or p>=1e12 or d>=1e12 or q='NaN'::numeric or p='NaN'::numeric or d='NaN'::numeric then raise exception 'Invalid quantity, price or discount'; end if;
  sub:=sub+q*p;disc:=disc+d;clean:=clean||jsonb_build_array(item||jsonb_build_object('total',round(q*p-d,2)));
 end loop;
 new.items:=clean;new.subtotal:=round(sub,2);new.discount:=round(disc,2);
 new.vat:=round((new.subtotal-new.discount)*new.tax_rate/100,2);
 new.total:=new.subtotal-new.discount+new.vat;
 new.withholding_tax:=round((new.subtotal-new.discount)*new.wht_rate/100,2);
 new.net_total:=new.total-new.withholding_tax;
 return new;
end $$;
revoke all on function private.crm_quote_totals() from public;

-- Composite keys preserve account identity even when a referenced record is moved.
create unique index if not exists crm_contacts_id_customer on public.contacts(id,customer_id);
create unique index if not exists crm_opportunities_id_customer on public.opportunities(id,customer_id);
alter table public.opportunities add constraint crm_opportunity_contact_account
 foreign key(contact_id,customer_id) references public.contacts(id,customer_id) on update restrict on delete restrict not valid;
alter table public.quotations add constraint crm_quotation_contact_account
 foreign key(contact_id,customer_id) references public.contacts(id,customer_id) on update restrict on delete restrict not valid;
alter table public.quotations add constraint crm_quotation_opportunity_account
 foreign key(opportunity_id,customer_id) references public.opportunities(id,customer_id) on update restrict on delete restrict not valid;
notify pgrst,'reload schema';
