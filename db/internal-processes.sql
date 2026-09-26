-- Additive internal CRM processes. No business rows are deleted or rewritten.
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS renewed_from_id uuid REFERENCES public.contracts(id);
CREATE UNIQUE INDEX IF NOT EXISTS crm_contract_one_renewal ON public.contracts(renewed_from_id) WHERE renewed_from_id IS NOT NULL;
CREATE OR REPLACE FUNCTION public.crm_renew_contract(p_id uuid,p_end_date date,p_value numeric)
RETURNS public.contracts LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE src public.contracts; result public.contracts;
BEGIN
 IF NOT(private.crm_can('contracts','view') AND private.crm_can('contracts','edit') AND private.crm_can('contracts','create')) THEN RAISE EXCEPTION 'Contract permission required' USING ERRCODE='42501'; END IF;
 SELECT * INTO src FROM public.contracts WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Contract not found'; END IF;
 SELECT * INTO result FROM public.contracts WHERE renewed_from_id=p_id;
 IF FOUND THEN RETURN result; END IF;
 IF src.status IN ('renewed','cancelled','lost') THEN RAISE EXCEPTION 'Contract cannot be renewed in this state'; END IF;
 IF src.end_date IS NULL OR p_end_date IS NULL OR p_end_date<=src.end_date OR p_value IS NULL OR p_value<0 OR p_value='NaN'::numeric THEN RAISE EXCEPTION 'Invalid renewal date or value'; END IF;
 INSERT INTO public.contracts(name,type,product,customer_id,customer_name,owner_id,owner_name,start_date,end_date,value,status,renewal_status,sla_level,auto_renew,renewal_owner_id,renewal_owner_name,quotation_id,opportunity_id,renewed_from_id)
 VALUES(src.name,src.type,src.product,src.customer_id,src.customer_name,src.owner_id,src.owner_name,src.end_date+1,p_end_date,p_value,'active','not-started',src.sla_level,src.auto_renew,src.renewal_owner_id,src.renewal_owner_name,src.quotation_id,src.opportunity_id,p_id) RETURNING * INTO result;
 UPDATE public.contracts SET status='renewed',renewal_status='renewed',updated_at=clock_timestamp() WHERE id=p_id;
 INSERT INTO public.audit_logs(user_id,action,module,record_id,changes) VALUES(auth.uid(),'update','contracts',p_id,jsonb_build_object('renewed_contract_id',result.id));
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.crm_renew_contract(uuid,date,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_renew_contract(uuid,date,numeric) TO authenticated;

CREATE TABLE public.crm_approval_policies(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 200),
 minimum_amount numeric NOT NULL DEFAULT 0 CHECK(minimum_amount>=0 AND minimum_amount<1e15),
 approver_ids uuid[] NOT NULL CHECK(cardinality(approver_ids) BETWEEN 1 AND 8),is_active boolean NOT NULL DEFAULT true,
 updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.crm_approval_policies ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON public.crm_approval_policies TO authenticated;
CREATE POLICY crm_policy_read ON public.crm_approval_policies FOR SELECT TO authenticated USING(private.crm_can('quotations','view') OR private.crm_is_admin());
CREATE POLICY crm_policy_insert ON public.crm_approval_policies FOR INSERT TO authenticated WITH CHECK(private.crm_is_admin());
CREATE POLICY crm_policy_update ON public.crm_approval_policies FOR UPDATE TO authenticated USING(private.crm_is_admin()) WITH CHECK(private.crm_is_admin());
CREATE TABLE public.crm_approval_requests(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),quotation_id uuid NOT NULL REFERENCES public.quotations(id),
 submitted_by uuid NOT NULL REFERENCES public.profiles(id),approver_ids uuid[] NOT NULL,
 current_step integer NOT NULL DEFAULT 1,status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','cancelled')),
 snapshot jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX crm_one_pending_request ON public.crm_approval_requests(quotation_id) WHERE status='pending';
CREATE TABLE public.crm_approval_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),request_id uuid NOT NULL REFERENCES public.crm_approval_requests(id),
 actor_id uuid NOT NULL REFERENCES public.profiles(id),step integer NOT NULL,decision text NOT NULL,comment text,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX crm_approval_events_request ON public.crm_approval_events(request_id);
ALTER TABLE public.crm_approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_approval_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.crm_approval_requests,public.crm_approval_events TO authenticated;
CREATE POLICY crm_request_read ON public.crm_approval_requests FOR SELECT TO authenticated USING(private.crm_can('quotations','view'));
CREATE POLICY crm_event_read ON public.crm_approval_events FOR SELECT TO authenticated USING(private.crm_can('quotations','view'));
-- Definer is needed for the narrow state transition to notify other users and write
-- protected approval state. Authorization is checked here; no client write grants.
CREATE FUNCTION private.crm_approval_transition(p_quotation uuid,p_action text,p_comment text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q public.quotations;r public.crm_approval_requests;p public.crm_approval_policies;next_user uuid;uid uuid:=auth.uid();
BEGIN
 IF uid IS NULL OR NOT private.crm_can('quotations','view') THEN RAISE EXCEPTION 'Quotation access required' USING ERRCODE='42501'; END IF;
 SELECT * INTO q FROM public.quotations WHERE id=p_quotation FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Quotation not found'; END IF;
 SELECT * INTO r FROM public.crm_approval_requests WHERE quotation_id=p_quotation AND status='pending' FOR UPDATE;
 IF p_action='submit' THEN
  IF NOT (private.crm_can('quotations','edit') OR (q.owner_id=uid AND private.crm_can('quotations','create'))) THEN RAISE EXCEPTION 'Submission permission required' USING ERRCODE='42501'; END IF;
  IF r.id IS NOT NULL THEN RETURN to_jsonb(r); END IF;
  IF q.status NOT IN ('draft','rejected','submitted','pending') THEN RAISE EXCEPTION 'Quotation cannot be submitted in this state'; END IF;
  SELECT * INTO p FROM public.crm_approval_policies WHERE is_active AND minimum_amount<=q.total ORDER BY minimum_amount DESC,id LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Configure an active approval policy for this amount first'; END IF;
  IF uid=ANY(p.approver_ids) OR q.owner_id=ANY(p.approver_ids) THEN RAISE EXCEPTION 'The requester and sales owner cannot approve their own quotation'; END IF;
  IF EXISTS(SELECT 1 FROM unnest(p.approver_ids) x WHERE NOT EXISTS(SELECT 1 FROM public.profiles f WHERE f.id=x AND f.is_active AND (f.role='admin' OR EXISTS(SELECT 1 FROM public.role_permissions rp WHERE rp.role_key=CASE WHEN f.role='custom' THEN f.custom_role_key ELSE f.role END AND rp.module='quotations' AND rp.can_approve)))) THEN RAISE EXCEPTION 'Every approver must be active and have quotation approval permission'; END IF;
  INSERT INTO public.crm_approval_requests(quotation_id,submitted_by,approver_ids,snapshot) VALUES(q.id,uid,p.approver_ids,to_jsonb(q)) RETURNING * INTO r;
  next_user:=r.approver_ids[1];
 ELSIF p_action IN ('approve','reject','cancel') THEN
  IF r.id IS NULL THEN RAISE EXCEPTION 'No pending approval request'; END IF;
  IF p_action='cancel' THEN
   IF uid<>r.submitted_by AND NOT private.crm_is_admin() THEN RAISE EXCEPTION 'Only requester or administrator can withdraw' USING ERRCODE='42501'; END IF;
   r.status:='cancelled';
  ELSE
   IF NOT private.crm_can('quotations','approve') OR uid<>r.approver_ids[r.current_step] OR uid=r.submitted_by OR uid=q.owner_id THEN RAISE EXCEPTION 'Not the current approver' USING ERRCODE='42501'; END IF;
   IF p_action='reject' AND length(trim(coalesce(p_comment,'')))=0 THEN RAISE EXCEPTION 'Rejection reason required'; END IF;
   IF p_action='reject' THEN r.status:='rejected';
   ELSIF r.current_step=cardinality(r.approver_ids) THEN r.status:='approved';
   ELSE r.current_step:=r.current_step+1;next_user:=r.approver_ids[r.current_step]; END IF;
  END IF;
  UPDATE public.crm_approval_requests SET status=r.status,current_step=r.current_step,updated_at=clock_timestamp() WHERE id=r.id;
 ELSE RAISE EXCEPTION 'Unknown approval action'; END IF;
 INSERT INTO public.crm_approval_events(request_id,actor_id,step,decision,comment) VALUES(r.id,uid,CASE WHEN p_action='approve' AND r.status='pending' THEN r.current_step-1 ELSE r.current_step END,p_action,left(p_comment,2000));
 PERFORM set_config('crm.approval_transition','yes',true);
 UPDATE public.quotations SET approval_status=CASE WHEN r.status='cancelled' THEN NULL ELSE r.status END,status=CASE WHEN r.status='cancelled' THEN 'draft' WHEN r.status='pending' THEN 'submitted' ELSE r.status END,approval_comment=nullif(left(p_comment,2000),''),updated_at=clock_timestamp() WHERE id=q.id;
 PERFORM set_config('crm.approval_transition','',true);
 IF next_user IS NOT NULL THEN INSERT INTO public.notifications(user_id,type,title,body,related_module,related_id) VALUES(next_user,'approval','Quotation approval: '||q.code,'Step '||r.current_step,'quotations',q.id);
 ELSE INSERT INTO public.notifications(user_id,type,title,body,related_module,related_id) VALUES(r.submitted_by,'approval','Quotation '||r.status||': '||q.code,left(p_comment,2000),'quotations',q.id);END IF;
 INSERT INTO public.audit_logs(user_id,action,module,record_id,changes) VALUES(uid,'update','quotations',q.id,jsonb_build_object('approval_action',p_action,'request_id',r.id,'step',r.current_step));
 RETURN to_jsonb(r);
END $$;
REVOKE ALL ON FUNCTION private.crm_approval_transition(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.crm_approval_transition(uuid,text,text) TO authenticated;
CREATE FUNCTION public.crm_quotation_transition(p_quotation uuid,p_action text,p_comment text DEFAULT '') RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.crm_approval_transition(p_quotation,p_action,p_comment) $$;
REVOKE ALL ON FUNCTION public.crm_quotation_transition(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_quotation_transition(uuid,text,text) TO authenticated;
CREATE FUNCTION private.crm_quote_approval_guard() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF coalesce(current_setting('crm.approval_transition',true),'')='yes' THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' THEN
  IF coalesce(NEW.approval_status,'')<>'' THEN RAISE EXCEPTION 'Save a draft, then submit through the approval workflow'; END IF;
 ELSIF NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN RAISE EXCEPTION 'Use the approval workflow';
 ELSIF OLD.approval_status IN ('pending','approved') AND (to_jsonb(NEW)-ARRAY['updated_at','status','approval_comment']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['updated_at','status','approval_comment']) THEN RAISE EXCEPTION 'Withdraw pending approval or create a new draft before editing';
 END IF;
 IF NEW.status IN ('approved','accepted','sent') AND coalesce(NEW.approval_status,'')<>'approved' THEN RAISE EXCEPTION 'Approval required'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.crm_quote_approval_guard() FROM PUBLIC;
CREATE TRIGGER crm_quote_approval_guard BEFORE INSERT OR UPDATE ON public.quotations FOR EACH ROW EXECUTE FUNCTION private.crm_quote_approval_guard();
CREATE FUNCTION public.crm_convert_lead(p_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE src public.leads;cid uuid;
BEGIN
 IF NOT(private.crm_can('leads','view') AND private.crm_can('leads','edit') AND private.crm_can('customers','create')) THEN RAISE EXCEPTION 'Lead conversion permission required' USING ERRCODE='42501'; END IF;
 SELECT * INTO src FROM public.leads WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Lead not found'; END IF;
 IF src.status='converted' THEN IF src.customer_id IS NULL THEN RAISE EXCEPTION 'Converted lead has no linked customer'; END IF; RETURN src.customer_id; END IF;
 IF length(trim(src.company_name))=0 THEN RAISE EXCEPTION 'Company name required'; END IF;
 cid:=src.customer_id;
 IF cid IS NULL THEN INSERT INTO public.customers(name,phone,email,owner_id,owner_name,status) VALUES(src.company_name,src.phone,src.email,src.owner_id,src.owner_name,'Active') RETURNING id INTO cid; END IF;
 IF length(trim(coalesce(src.contact_name,'')))>0 THEN
  IF NOT private.crm_can('contacts','create') THEN RAISE EXCEPTION 'Contact creation permission required' USING ERRCODE='42501'; END IF;
  INSERT INTO public.contacts(name,customer_id,company,phone,email,position,owner_id,owner_name,status,is_primary) VALUES(src.contact_name,cid,src.company_name,src.phone,src.email,src.position,src.owner_id,src.owner_name,'active',true);
 END IF;
 UPDATE public.leads SET status='converted',customer_id=cid,converted_at=clock_timestamp(),updated_at=clock_timestamp() WHERE id=p_id;
 INSERT INTO public.audit_logs(user_id,action,module,record_id,changes) VALUES(auth.uid(),'update','leads',p_id,jsonb_build_object('converted_customer_id',cid));
 RETURN cid;
END $$;
REVOKE ALL ON FUNCTION public.crm_convert_lead(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_convert_lead(uuid) TO authenticated;
CREATE FUNCTION private.crm_policy_validate() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NOT private.crm_is_admin() THEN RAISE EXCEPTION 'Admin required' USING ERRCODE='42501';END IF;
 IF cardinality(NEW.approver_ids)<>(SELECT count(DISTINCT x) FROM unnest(NEW.approver_ids) x) THEN RAISE EXCEPTION 'Approvers must be distinct and ordered'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(NEW.approver_ids) x WHERE NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=x AND is_active)) THEN RAISE EXCEPTION 'Approvers must be active users'; END IF;
 NEW.updated_at:=clock_timestamp();RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.crm_policy_validate() FROM PUBLIC;
CREATE TRIGGER crm_policy_validate BEFORE INSERT OR UPDATE ON public.crm_approval_policies FOR EACH ROW EXECUTE FUNCTION private.crm_policy_validate();
CREATE TRIGGER crm_policy_audit AFTER INSERT OR UPDATE ON public.crm_approval_policies FOR EACH ROW EXECUTE FUNCTION private.crm_settings_audit();
CREATE TABLE public.crm_branches(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 200),customer_id uuid NOT NULL REFERENCES public.customers(id),customer_name text DEFAULT '',code text NOT NULL DEFAULT '',address text DEFAULT '',phone text DEFAULT '',status text NOT NULL DEFAULT 'active',created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX crm_branch_code ON public.crm_branches(customer_id,code) WHERE code<>'';
CREATE TABLE public.crm_price_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 200),code text NOT NULL UNIQUE,category text DEFAULT '',unit text NOT NULL DEFAULT 'Unit',price numeric NOT NULL DEFAULT 0 CHECK(price>=0 AND price<1e15),cost numeric NOT NULL DEFAULT 0 CHECK(cost>=0 AND cost<1e15),description text DEFAULT '',status text NOT NULL DEFAULT 'active',created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.crm_templates(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 200),type text NOT NULL DEFAULT 'Quotation',description text DEFAULT '',header text DEFAULT '',footer text DEFAULT '',status text NOT NULL DEFAULT 'active',created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.crm_knowledge_articles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 200),category text DEFAULT '',description text NOT NULL DEFAULT '',status text NOT NULL DEFAULT 'draft',created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
DO $$DECLARE tbl text; mod text;BEGIN
 FOR tbl,mod IN SELECT * FROM (VALUES('crm_branches','customers'),('crm_price_items','quotations'),('crm_templates','documents'),('crm_knowledge_articles','tickets')) t(a,b) LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tbl);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE ON public.%I TO authenticated',tbl);
  EXECUTE format('CREATE POLICY crm_internal_read ON public.%I FOR SELECT TO authenticated USING(private.crm_can(%L,%L))',tbl,mod,'view');
  EXECUTE format('CREATE POLICY crm_internal_create ON public.%I FOR INSERT TO authenticated WITH CHECK(private.crm_can(%L,%L))',tbl,mod,'create');
  EXECUTE format('CREATE POLICY crm_internal_edit ON public.%I FOR UPDATE TO authenticated USING(private.crm_can(%L,%L)) WITH CHECK(private.crm_can(%L,%L))',tbl,mod,'edit',mod,'edit');
  EXECUTE format('CREATE TRIGGER crm_internal_audit AFTER INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.crm_settings_audit()',tbl);
 END LOOP;
END $$;
REVOKE ALL ON public.crm_approval_policies,public.crm_approval_requests,public.crm_approval_events,public.crm_branches,public.crm_price_items,public.crm_templates,public.crm_knowledge_articles FROM PUBLIC,anon;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.crm_approval_requests,public.crm_approval_events FROM authenticated;
-- Existing documents retain their values. New choices also accept active master values.
ALTER TABLE public.customers DROP CONSTRAINT customers_type_check;
ALTER TABLE public.customers DROP CONSTRAINT customers_tier_check;
ALTER TABLE public.opportunities DROP CONSTRAINT opportunities_stage_check;
ALTER TABLE public.assets DROP CONSTRAINT assets_category_check;
ALTER TABLE public.assets DROP CONSTRAINT assets_status_check;
CREATE FUNCTION private.crm_reference_guard() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE key text;reference_category text;allowed text[];value text;old_doc jsonb:='{}';i integer;
BEGIN
 IF TG_OP='UPDATE' THEN old_doc:=to_jsonb(OLD);END IF;
 FOR i IN 0..(TG_NARGS/3-1) LOOP
  key:=TG_ARGV[i*3];reference_category:=TG_ARGV[i*3+1];allowed:=string_to_array(TG_ARGV[i*3+2],'|');value:=to_jsonb(NEW)->>key;
  IF value IS NOT DISTINCT FROM old_doc->>key THEN CONTINUE;END IF;
  IF value IS NOT NULL AND NOT(value=ANY(allowed)) AND NOT EXISTS(SELECT 1 FROM public.master_data_items m WHERE m.category=reference_category AND m.status='active' AND (m.name_en=value OR m.name_th=value OR m.code=value)) THEN RAISE EXCEPTION 'Invalid reference: %',key;END IF;
 END LOOP;RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.crm_reference_guard() FROM PUBLIC;
CREATE TRIGGER crm_customer_references BEFORE INSERT OR UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION private.crm_reference_guard('type','customer_type','Company|Individual|Government|NGO','tier','tier','Platinum|Gold|Silver|Standard');
CREATE TRIGGER crm_opportunity_references BEFORE INSERT OR UPDATE ON public.opportunities FOR EACH ROW EXECUTE FUNCTION private.crm_reference_guard('stage','sales_stage','Lead|Qualified|Requirement|Solution Design|Proposal|Negotiation|Verbal Commit|Won|Lost');
CREATE TRIGGER crm_asset_references BEFORE INSERT OR UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION private.crm_reference_guard('category','asset_type','Server|Network|Security|Storage|Software|Endpoint|Printer|UPS|Other|POS|Firewall|Cloud|Industrial PC|Room Booking|Rental','status','asset_status','active|inactive|expired|maintenance|inuse|spare|retired|replaced');
