-- Additive profile fields. Existing unsplit names remain intact.
ALTER TABLE public.contacts
 ADD COLUMN salutation text,
 ADD COLUMN first_name text,
 ADD COLUMN last_name text,
 ADD COLUMN mobile text,
 ADD COLUMN description text,
 ADD COLUMN mailing_country text,
 ADD COLUMN mailing_street text,
 ADD COLUMN mailing_city text,
 ADD COLUMN mailing_state text,
 ADD COLUMN mailing_postal_code text,
 ADD COLUMN reports_to_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
 ADD CONSTRAINT contacts_reports_to_not_self CHECK(reports_to_id IS DISTINCT FROM id);
ALTER TABLE public.leads
 ADD COLUMN salutation text,
 ADD COLUMN first_name text,
 ADD COLUMN last_name text,
 ADD COLUMN mobile text,
 ADD COLUMN website text,
 ADD COLUMN mailing_country text,
 ADD COLUMN mailing_street text,
 ADD COLUMN mailing_city text,
 ADD COLUMN mailing_state text,
 ADD COLUMN mailing_postal_code text,
 ADD COLUMN converted_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL;
CREATE INDEX contacts_reports_to_idx ON public.contacts(reports_to_id) WHERE reports_to_id IS NOT NULL;
CREATE INDEX leads_converted_contact_idx ON public.leads(converted_contact_id) WHERE converted_contact_id IS NOT NULL;

CREATE FUNCTION private.crm_person_profile() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE person_name text; account_name text; manager_account uuid; cycle_found boolean;
BEGIN
 person_name:=concat_ws(' ',nullif(trim(NEW.salutation),''),nullif(trim(NEW.first_name),''),nullif(trim(NEW.last_name),''));
 IF TG_TABLE_NAME='contacts' THEN
  IF coalesce(trim(NEW.first_name),'')<>'' OR coalesce(trim(NEW.last_name),'')<>'' THEN NEW.name:=person_name; END IF;
  IF NEW.customer_id IS NOT NULL THEN
   SELECT name INTO account_name FROM public.customers WHERE id=NEW.customer_id;
   IF account_name IS NULL THEN RAISE EXCEPTION 'Account not found or access denied'; END IF;
   NEW.company:=account_name;
  END IF;
  -- Serialize hierarchy/account changes to reject concurrent cycles too.
  PERFORM pg_advisory_xact_lock(719030,1);
  IF NEW.reports_to_id IS NOT NULL THEN
   IF NEW.reports_to_id=NEW.id THEN RAISE EXCEPTION 'Contact cannot report to itself'; END IF;
   SELECT customer_id INTO manager_account FROM public.contacts WHERE id=NEW.reports_to_id;
   IF NOT FOUND OR manager_account IS DISTINCT FROM NEW.customer_id THEN RAISE EXCEPTION 'Reports-to contact must belong to the same account'; END IF;
   WITH RECURSIVE managers AS (
    SELECT id,reports_to_id,ARRAY[id] AS path FROM public.contacts WHERE id=NEW.reports_to_id
    UNION ALL SELECT c.id,c.reports_to_id,m.path||c.id FROM public.contacts c JOIN managers m ON c.id=m.reports_to_id WHERE NOT c.id=ANY(m.path)
   ) SELECT EXISTS(SELECT 1 FROM managers WHERE id=NEW.id) INTO cycle_found;
   IF cycle_found THEN RAISE EXCEPTION 'Reporting hierarchy cannot contain a cycle'; END IF;
  END IF;
  IF TG_OP='UPDATE' AND NEW.customer_id IS DISTINCT FROM OLD.customer_id AND EXISTS(SELECT 1 FROM public.contacts WHERE reports_to_id=NEW.id AND customer_id IS DISTINCT FROM NEW.customer_id) THEN
   RAISE EXCEPTION 'Update reporting contacts before moving this contact to another account';
  END IF;
 ELSE
  IF coalesce(trim(NEW.first_name),'')<>'' OR coalesce(trim(NEW.last_name),'')<>'' THEN NEW.contact_name:=person_name; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.crm_person_profile() FROM PUBLIC;
CREATE TRIGGER crm_contact_profile BEFORE INSERT OR UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION private.crm_person_profile();
CREATE TRIGGER crm_lead_profile BEFORE INSERT OR UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION private.crm_person_profile();

CREATE OR REPLACE FUNCTION public.crm_convert_lead(p_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
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
  INSERT INTO public.customers(name,phone,email,website,address,province,owner_id,owner_name,status)
  VALUES(src.company_name,src.phone,src.email,src.website,concat_ws(', ',nullif(src.mailing_street,''),nullif(src.mailing_city,''),nullif(src.mailing_state,''),nullif(src.mailing_postal_code,''),nullif(src.mailing_country,'')),src.mailing_state,src.owner_id,src.owner_name,'Active') RETURNING id INTO cid;
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
END $$;
REVOKE ALL ON FUNCTION public.crm_convert_lead(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_convert_lead(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
