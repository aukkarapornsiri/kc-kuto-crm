-- Additive cloud schema, aligned with local category names. Current CRM scope is singleton-company.
CREATE TABLE public.master_data_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 category text NOT NULL CHECK(category IN ('customer_type','industry','lead_source','sales_stage','product_category','region','tier','unit','tag','loss_reason')),
 code text NOT NULL CHECK(code ~ '^[A-Z0-9][A-Z0-9_-]{0,39}$'),
 name_th text NOT NULL CHECK(length(btrim(name_th)) BETWEEN 1 AND 200),
 name_en text NOT NULL CHECK(length(btrim(name_en)) BETWEEN 1 AND 200),
 sort_order integer NOT NULL DEFAULT 0 CHECK(sort_order BETWEEN 0 AND 9999),
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(category,code)
);
CREATE INDEX crm_master_category_order ON public.master_data_items(category,sort_order,code);
ALTER TABLE public.master_data_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.master_data_items FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.master_data_items TO authenticated;
GRANT ALL ON public.master_data_items TO service_role;
CREATE POLICY crm_master_read ON public.master_data_items FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.is_active));
CREATE POLICY crm_master_insert ON public.master_data_items FOR INSERT TO authenticated
 WITH CHECK(private.crm_is_admin());
CREATE POLICY crm_master_update ON public.master_data_items FOR UPDATE TO authenticated
 USING(private.crm_is_admin()) WITH CHECK(private.crm_is_admin());
CREATE FUNCTION private.crm_master_before_write() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.id<>OLD.id OR NEW.category<>OLD.category THEN RAISE EXCEPTION 'Master data identity and category are immutable'; END IF;
  NEW.version:=OLD.version+1; NEW.created_at:=OLD.created_at;
 ELSE NEW.version:=1; NEW.created_at:=now(); END IF;
 NEW.updated_at:=now(); RETURN NEW;
END $$;
CREATE FUNCTION private.crm_master_audit() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 INSERT INTO public.audit_logs(user_id,action,module,category,record_id,before_state,after_state)
 VALUES(auth.uid(),CASE WHEN TG_OP='INSERT' THEN 'create' ELSE 'update' END,'settings','admin_activity',NEW.id,CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END,to_jsonb(NEW));
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.crm_master_before_write(),private.crm_master_audit() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.crm_master_before_write(),private.crm_master_audit() TO authenticated,service_role;
CREATE TRIGGER crm_master_before_write BEFORE INSERT OR UPDATE ON public.master_data_items FOR EACH ROW EXECUTE FUNCTION private.crm_master_before_write();
CREATE TRIGGER crm_master_audit AFTER INSERT OR UPDATE ON public.master_data_items FOR EACH ROW EXECUTE FUNCTION private.crm_master_audit();
COMMENT ON TABLE public.master_data_items IS 'Admin-maintained references; not automatic rewrites of historical documents or dynamic pipeline state definitions. No sample business records are seeded.';
