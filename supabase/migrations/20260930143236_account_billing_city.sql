ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS billing_city text;
CREATE OR REPLACE FUNCTION public.crm_convert_lead(p_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE src public.leads; cid uuid; person_id uuid; account_name text;
BEGIN
 IF NOT(private.crm_can('leads','view') AND private.crm_can('leads','edit') AND private.crm_can('customers','create')) THEN RAISE EXCEPTION 'Lead conversion permission required' USING ERRCODE='42501'; END IF;
 SELECT * INTO src FROM public.leads WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Lead not found'; END IF;
 IF src.status='converted' THEN
  IF src.customer_id IS NULL THEN RAISE EXCEPTION 'Converted lead has no linked customer'; END IF;
  RETURN src.customer_id;
 END IF;
 IF length(trim(src.company_name))=0 THEN RAISE EXCEPTION 'Company name required'; END IF;
 cid:=src.customer_id;
 IF cid IS NULL THEN
  INSERT INTO public.customers(name,phone,email,website,address,billing_city,province,owner_id,owner_name,status)
  VALUES(src.company_name,src.phone,src.email,src.website,concat_ws(', ',nullif(src.mailing_street,''),nullif(src.mailing_city,''),nullif(src.mailing_state,''),nullif(src.mailing_postal_code,''),nullif(src.mailing_country,'')),src.mailing_city,src.mailing_state,src.owner_id,src.owner_name,'Active') RETURNING id INTO cid;
 END IF;
 SELECT name INTO account_name FROM public.customers WHERE id=cid;
 IF account_name IS NULL THEN RAISE EXCEPTION 'Account not found or access denied'; END IF;
 IF length(trim(coalesce(src.contact_name,'')))>0 THEN
  IF NOT private.crm_can('contacts','create') THEN RAISE EXCEPTION 'Contact creation permission required' USING ERRCODE='42501'; END IF;
  INSERT INTO public.contacts(name,salutation,first_name,last_name,customer_id,company,phone,mobile,email,line_id,position,description,mailing_country,mailing_street,mailing_city,mailing_state,mailing_postal_code,owner_id,owner_name,status,is_primary)
  VALUES(src.contact_name,src.salutation,src.first_name,src.last_name,cid,account_name,src.phone,src.mobile,src.email,src.line_id,src.position,src.note,src.mailing_country,src.mailing_street,src.mailing_city,src.mailing_state,src.mailing_postal_code,src.owner_id,src.owner_name,'active',true) RETURNING id INTO person_id;
 END IF;
 UPDATE public.leads SET status='converted',customer_id=cid,converted_contact_id=person_id,converted_at=clock_timestamp(),updated_at=clock_timestamp() WHERE id=p_id;
 INSERT INTO public.audit_logs(user_id,action,module,record_id,changes) VALUES(auth.uid(),'update','leads',p_id,jsonb_build_object('converted_customer_id',cid,'converted_contact_id',person_id));
 RETURN cid;
END $function$
;
