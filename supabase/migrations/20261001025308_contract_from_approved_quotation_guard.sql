create or replace function private.crm_customer_links()
returns trigger
language plpgsql
set search_path=''
as $$
declare
  doc jsonb:=to_jsonb(new);old_doc jsonb:='{}';field text;tbl text;
  linked_customer uuid;link uuid;linked_status text;linked_approval text;linked_opportunity uuid;
begin
  if TG_OP='UPDATE' then old_doc:=to_jsonb(old);end if;
  for field,tbl in select * from (values
    ('contact_id','contacts'),('opportunity_id','opportunities'),
    ('quotation_id','quotations'),('contract_id','contracts'),('asset_id','assets')
  ) refs(f,t)
  loop
    if not doc?field or doc->>field is null or doc->>'customer_id' is null then continue;end if;
    if TG_OP='UPDATE' and doc->>field is not distinct from old_doc->>field
       and doc->>'customer_id' is not distinct from old_doc->>'customer_id' then continue;end if;
    link:=(doc->>field)::uuid;
    if field='quotation_id' and TG_TABLE_NAME='contracts' then
      select q.customer_id,q.status,q.approval_status,q.opportunity_id
      into linked_customer,linked_status,linked_approval,linked_opportunity
      from public.quotations q where q.id=link;
      if linked_customer is distinct from (doc->>'customer_id')::uuid then
        raise exception 'Related record is inaccessible or belongs to another customer: %',field;
      end if;
      if linked_status not in ('approved','accepted') or coalesce(linked_approval,'')<>'approved' then
        raise exception 'Contract requires an approved quotation';
      end if;
      if linked_opportunity is not null
         and (doc->>'opportunity_id' is null or (doc->>'opportunity_id')::uuid is distinct from linked_opportunity) then
        raise exception 'Contract opportunity must match quotation opportunity';
      end if;
    else
      execute format('select customer_id from public.%I where id=$1',tbl) into linked_customer using link;
      if linked_customer is distinct from (doc->>'customer_id')::uuid then
        raise exception 'Related record is inaccessible or belongs to another customer: %',field;
      end if;
    end if;
  end loop;
  return new;
end
$$;
