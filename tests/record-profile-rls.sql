-- Uses an existing active admin and rolls back every fixture and audit row.
BEGIN;
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM public.profiles WHERE role='admin' AND is_active LIMIT 1),true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE account_id uuid; other_account uuid; manager_id uuid; child_id uuid; lead_id uuid; converted_id uuid; person_id uuid; before_count integer; new_lead uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Active admin required for regression test'; END IF;
 INSERT INTO public.customers(name,status) VALUES('CRM profile regression account','Active') RETURNING id INTO account_id;
 INSERT INTO public.customers(name,status) VALUES('CRM profile regression other account','Active') RETURNING id INTO other_account;
 INSERT INTO public.contacts(name,first_name,last_name,customer_id,status) VALUES('placeholder','Manager','Test',account_id,'active') RETURNING id INTO manager_id;
 INSERT INTO public.contacts(name,first_name,last_name,customer_id,reports_to_id,status) VALUES('placeholder','Child','Test',account_id,manager_id,'active') RETURNING id INTO child_id;
 IF (SELECT name FROM public.contacts WHERE id=child_id)<>'Child Test' OR (SELECT company FROM public.contacts WHERE id=child_id)<>'CRM profile regression account' THEN RAISE EXCEPTION 'Name/account synchronization failed'; END IF;
 BEGIN
  UPDATE public.contacts SET reports_to_id=child_id WHERE id=manager_id;
  RAISE EXCEPTION 'Expected cycle rejection';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%cannot contain a cycle%' THEN RAISE; END IF;
 END;
 BEGIN
  UPDATE public.contacts SET customer_id=other_account WHERE id=child_id;
  RAISE EXCEPTION 'Expected cross-account rejection';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%same account%' THEN RAISE; END IF;
 END;
 INSERT INTO public.leads(company_name,salutation,first_name,last_name,customer_id,phone,mobile,email,position,line_id,mailing_country,mailing_street,mailing_city,mailing_state,mailing_postal_code,note,owner_id,status)
 VALUES('Use existing account','Dr.','Alex','Test',account_id,'020000000','0800000000','crm-regression@example.test','Director','crm-test','Thailand','1 Test Street','Test District','Bangkok','10100','Profile description',auth.uid(),'new') RETURNING id INTO lead_id;
 SELECT count(*) INTO before_count FROM public.customers;
 converted_id:=public.crm_convert_lead(lead_id);
 SELECT converted_contact_id INTO person_id FROM public.leads WHERE id=lead_id;
 IF converted_id<>account_id OR person_id IS NULL OR (SELECT count(*) FROM public.customers)<>before_count THEN RAISE EXCEPTION 'Conversion must reuse the selected account'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.contacts WHERE id=person_id AND name='Dr. Alex Test' AND customer_id=account_id AND mobile='0800000000' AND mailing_postal_code='10100' AND description='Profile description' AND owner_id=auth.uid() AND company='CRM profile regression account') THEN RAISE EXCEPTION 'Converted contact profile was lost'; END IF;
 SELECT count(*) INTO before_count FROM public.contacts;
 PERFORM public.crm_convert_lead(lead_id);
 IF (SELECT count(*) FROM public.contacts)<>before_count THEN RAISE EXCEPTION 'Repeated conversion created another contact'; END IF;
 INSERT INTO public.leads(company_name,first_name,last_name,status,website,mailing_street,mailing_city,mailing_state,mailing_postal_code,mailing_country) VALUES('CRM profile new account','New','Person','new','https://example.test','2 Test Street','Test District','Bangkok','10200','Thailand') RETURNING id INTO new_lead;
 converted_id:=public.crm_convert_lead(new_lead);
 IF NOT EXISTS(SELECT 1 FROM public.customers WHERE id=converted_id AND website='https://example.test' AND address LIKE '%10200%' AND province='Bangkok') THEN RAISE EXCEPTION 'New account address/website transfer failed'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.contacts) OR EXISTS(SELECT 1 FROM public.leads) THEN RAISE EXCEPTION 'Anonymous CRM data must remain private'; END IF; END $$;
RESET ROLE;
ROLLBACK;
SELECT 'PASS: authenticated profile links, hierarchy validation, conversion transfer/idempotency and anonymous isolation; fixtures rolled back' AS result;
