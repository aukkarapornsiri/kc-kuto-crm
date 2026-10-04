-- Additive identity grouping: no customer/document rows are moved or deleted.
create table public.crm_customer_identity_links (
 id uuid primary key default gen_random_uuid(),
 customer_id uuid not null unique references public.customers(id) on delete restrict,
 canonical_id uuid not null references public.customers(id) on delete restrict,
 linked_at timestamptz not null default now(),
 linked_by uuid not null,
 check(customer_id<>canonical_id)
);
create index crm_customer_identity_canonical_idx on public.crm_customer_identity_links(canonical_id);
create table public.crm_customer_identity_events (
 id uuid primary key default gen_random_uuid(), customer_id uuid not null,
 canonical_id uuid not null, action text not null check(action in ('link','unlink')),
 reason text not null, actor_id uuid not null, created_at timestamptz not null default now()
);
create index crm_customer_identity_events_account_idx on public.crm_customer_identity_events(canonical_id,created_at);
create table public.crm_customer360_events (
 id uuid primary key default gen_random_uuid(), customer_id uuid not null,
 module text not null, record_id uuid not null, action text not null,
 title text not null default '', status text, actor_id uuid, created_at timestamptz not null default now()
);
create index crm_customer360_events_account_idx on public.crm_customer360_events(customer_id,created_at);
alter table public.crm_customer_identity_links enable row level security;
alter table public.crm_customer_identity_events enable row level security;
alter table public.crm_customer360_events enable row level security;
revoke all on public.crm_customer_identity_links,public.crm_customer_identity_events,public.crm_customer360_events from anon,authenticated;
grant select on public.crm_customer_identity_links,public.crm_customer_identity_events,public.crm_customer360_events to authenticated;
create policy customer_identity_read on public.crm_customer_identity_links for select to authenticated
 using (private.crm_can('customers','view') and exists(select 1 from public.customers c where c.id=customer_id) and exists(select 1 from public.customers c where c.id=canonical_id));
create policy customer_identity_history_read on public.crm_customer_identity_events for select to authenticated
 using (private.crm_can('customers','view') and exists(select 1 from public.customers c where c.id=canonical_id));
create policy customer360_events_read on public.crm_customer360_events for select to authenticated
 using (private.crm_can('customers','view') and private.crm_can(case when module='crm_branches' then 'customers' else module end,'view') and exists(select 1 from public.customers c where c.id=customer_id));

create function private.crm_customer_identity_link(p_customer uuid,p_canonical uuid,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare old_root uuid; actor uuid:=auth.uid();
begin
 if actor is null or not exists(select 1 from public.profiles where id=actor and role='admin' and is_active) then raise exception 'Administrator required' using errcode='42501'; end if;
 if p_reason is null or length(btrim(p_reason))<5 or length(p_reason)>500 then raise exception 'A review reason of 5–500 characters is required'; end if;
 -- Serialize all identity changes to prevent inverse links and chains under concurrency.
 perform pg_advisory_xact_lock(610040360);
 if not exists(select 1 from public.customers where id=p_customer) then raise exception 'Customer not found'; end if;
 select canonical_id into old_root from public.crm_customer_identity_links where customer_id=p_customer;
 if p_canonical is null then
  if old_root is null then return p_customer; end if;
  delete from public.crm_customer_identity_links where customer_id=p_customer;
  insert into public.crm_customer_identity_events(customer_id,canonical_id,action,reason,actor_id) values(p_customer,old_root,'unlink',btrim(p_reason),actor);
  return p_customer;
 end if;
 if p_customer=p_canonical then raise exception 'Cannot link a customer to itself'; end if;
 if not exists(select 1 from public.customers where id=p_canonical) then raise exception 'Canonical customer not found'; end if;
 if old_root=p_canonical then return p_canonical; end if;
 if old_root is not null then raise exception 'Unlink the customer before selecting another canonical account'; end if;
 if exists(select 1 from public.crm_customer_identity_links where customer_id=p_canonical or canonical_id=p_customer) then raise exception 'Nested groups are not allowed; review and unlink existing members first'; end if;
 -- Duplicate candidates must be reviewed; never infer identity or merge business fields here.
 insert into public.crm_customer_identity_links(customer_id,canonical_id,linked_by) values(p_customer,p_canonical,actor);
 insert into public.crm_customer_identity_events(customer_id,canonical_id,action,reason,actor_id) values(p_customer,p_canonical,'link',btrim(p_reason),actor);
 return p_canonical;
end $$;
revoke all on function private.crm_customer_identity_link(uuid,uuid,text) from public,anon,authenticated;
grant execute on function private.crm_customer_identity_link(uuid,uuid,text) to authenticated;
create function public.crm_customer_identity_link(p_customer uuid,p_canonical uuid,p_reason text)
returns uuid language sql security invoker set search_path='' as $$select private.crm_customer_identity_link(p_customer,p_canonical,p_reason)$$;
revoke all on function public.crm_customer_identity_link(uuid,uuid,text) from public,anon;
grant execute on function public.crm_customer_identity_link(uuid,uuid,text) to authenticated;

create function private.crm_capture_customer360_event() returns trigger
language plpgsql security definer set search_path='' as $$
declare row_data jsonb; account uuid;
begin
 row_data:=case when TG_OP='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 account:=case when TG_TABLE_NAME='customers' then (row_data->>'id')::uuid else nullif(row_data->>'customer_id','')::uuid end;
 if account is not null and (TG_OP<>'UPDATE' or (to_jsonb(old)-'updated_at') is distinct from (row_data-'updated_at')) then
  insert into public.crm_customer360_events(customer_id,module,record_id,action,title,status,actor_id)
  values(account,TG_TABLE_NAME,(row_data->>'id')::uuid,TG_OP,left(coalesce(row_data->>'code',row_data->>'name',row_data->>'subject',row_data->>'company_name',''),300),row_data->>'status',auth.uid());
 end if;
 return case when TG_OP='DELETE' then old else new end;
end $$;
revoke all on function private.crm_capture_customer360_event() from public,anon,authenticated;
do $$declare tbl text;begin
 foreach tbl in array array['customers','contacts','crm_branches','leads','opportunities','quotations','contracts','assets','tickets','activities','documents'] loop
  execute format('create trigger crm_customer360_capture after insert or update or delete on public.%I for each row execute function private.crm_capture_customer360_event()',tbl);
 end loop;
end $$;
