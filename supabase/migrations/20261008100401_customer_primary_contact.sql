-- Create customer and primary contact atomically with existing RLS permissions.
create or replace function public.crm_create_customer_with_contact(p_customer jsonb,p_contact jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare account public.customers; first_name text := trim(coalesce(p_contact->>'first_name','')); last_name text := trim(coalesce(p_contact->>'last_name',''));
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if not private.crm_can('customers','create') or not private.crm_can('contacts','create') then raise exception 'ไม่มีสิทธิ์สร้างลูกค้าหรือผู้ติดต่อ / Customer and contact create permissions required' using errcode='42501'; end if;
 if coalesce(trim(p_customer->>'name'),'')='' or first_name='' or last_name='' then raise exception 'Customer name and contact first/last name are required'; end if;
 if exists(select 1 from jsonb_each_text(p_contact) v where length(v.value)>250) then raise exception 'Contact fields must be at most 250 characters'; end if;
 insert into public.customers (name,name_en,type,industry,tier,tax_id,phone,email,website,description,parent_customer_id,address,billing_country,billing_city,province,billing_postal_code,shipping_country,shipping_street,shipping_city,shipping_state,shipping_postal_code,status,owner_id,owner_name) values (p_customer->>'name',p_customer->>'name_en',p_customer->>'type',p_customer->>'industry',p_customer->>'tier',nullif(p_customer->>'tax_id','')::uuid,p_customer->>'phone',p_customer->>'email',p_customer->>'website',p_customer->>'description',nullif(p_customer->>'parent_customer_id','')::uuid,p_customer->>'address',p_customer->>'billing_country',p_customer->>'billing_city',p_customer->>'province',p_customer->>'billing_postal_code',p_customer->>'shipping_country',p_customer->>'shipping_street',p_customer->>'shipping_city',p_customer->>'shipping_state',p_customer->>'shipping_postal_code',p_customer->>'status',nullif(p_customer->>'owner_id','')::uuid,p_customer->>'owner_name') returning * into account;
 insert into public.contacts (name,first_name,last_name,position,phone,email,customer_id,company,owner_id,owner_name,is_primary,status)
 values (first_name||' '||last_name,first_name,last_name,trim(p_contact->>'position'),trim(p_contact->>'phone'),trim(p_contact->>'email'),account.id,account.name,account.owner_id,account.owner_name,true,'active');
 return to_jsonb(account);
end;
$$;
revoke all on function public.crm_create_customer_with_contact(jsonb,jsonb) from public,anon;
grant execute on function public.crm_create_customer_with_contact(jsonb,jsonb) to authenticated;
