-- Additive settings storage; preserve company and permission data.
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS company_details jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.company_settings ADD CONSTRAINT crm_company_details_object CHECK (jsonb_typeof(company_details)='object' AND octet_length(company_details::text)<=30000);
CREATE TABLE public.crm_teams (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name_th text NOT NULL CHECK (length(btrim(name_th)) BETWEEN 1 AND 120),
 name_en text NOT NULL CHECK (length(btrim(name_en)) BETWEEN 1 AND 120),
 department text NOT NULL DEFAULT '' CHECK(length(department)<=120),
 leader_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
 member_ids uuid[] NOT NULL DEFAULT '{}',
 is_active boolean NOT NULL DEFAULT true,
 updated_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(name_th), UNIQUE(name_en)
);
ALTER TABLE public.crm_teams ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crm_teams FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.crm_teams TO authenticated;
CREATE POLICY crm_teams_read ON public.crm_teams FOR SELECT TO authenticated USING(private.crm_is_admin() OR private.crm_can('settings','view'));
CREATE POLICY crm_teams_insert ON public.crm_teams FOR INSERT TO authenticated WITH CHECK(private.crm_is_admin());
CREATE POLICY crm_teams_update ON public.crm_teams FOR UPDATE TO authenticated USING(private.crm_is_admin()) WITH CHECK(private.crm_is_admin());
CREATE FUNCTION private.crm_team_validate() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF cardinality(NEW.member_ids)>200 THEN RAISE EXCEPTION 'Maximum 200 team members'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(NEW.member_ids) x WHERE NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=x AND p.is_active)) THEN RAISE EXCEPTION 'Team members must be active CRM users'; END IF;
 IF NEW.leader_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=NEW.leader_id AND is_active) THEN RAISE EXCEPTION 'Team leader must be an active CRM user'; END IF;
 NEW.updated_at=clock_timestamp(); RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.crm_team_validate() FROM PUBLIC;
CREATE TRIGGER crm_team_validate BEFORE INSERT OR UPDATE ON public.crm_teams FOR EACH ROW EXECUTE FUNCTION private.crm_team_validate();
CREATE FUNCTION private.crm_settings_audit() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE before_doc jsonb; after_doc jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' THEN before_doc=to_jsonb(OLD)-'logo_url'; END IF;
 after_doc=to_jsonb(NEW)-'logo_url';
 INSERT INTO public.audit_logs(user_id,action,module,category,changes,before_state,after_state)
 VALUES(auth.uid(),CASE WHEN TG_OP='INSERT' THEN 'create' ELSE 'update' END,'settings','admin_activity',jsonb_build_object('table',TG_TABLE_NAME),before_doc,after_doc);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.crm_settings_audit() FROM PUBLIC;
CREATE TRIGGER crm_team_audit AFTER INSERT OR UPDATE ON public.crm_teams FOR EACH ROW EXECUTE FUNCTION private.crm_settings_audit();
CREATE TRIGGER crm_company_audit AFTER UPDATE ON public.company_settings FOR EACH ROW EXECUTE FUNCTION private.crm_settings_audit();
-- One request / transaction for the role matrix; invoker rights retain table RLS.
CREATE FUNCTION public.crm_save_permissions(p_role text,p_rows jsonb) RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE item jsonb; n integer=0;
BEGIN
 IF NOT private.crm_is_admin() THEN RAISE EXCEPTION 'Admin required' USING ERRCODE='42501'; END IF;
 IF p_role='admin' THEN RAISE EXCEPTION 'Administrator permissions are protected'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.custom_roles WHERE role_key=p_role) THEN RAISE EXCEPTION 'Unknown role'; END IF;
 IF jsonb_typeof(p_rows)<>'array' OR jsonb_array_length(p_rows)>30 THEN RAISE EXCEPTION 'Invalid permission matrix'; END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
  IF item->>'module' NOT IN ('dashboard','leads','customers','contacts','opportunities','quotations','contracts','assets','tickets','activities','documents','reports','ai','settings') THEN RAISE EXCEPTION 'Unknown module'; END IF;
  INSERT INTO public.role_permissions(role_key,module,can_view,can_create,can_edit,can_delete,can_export,can_approve,can_assign,can_import,can_manage_settings)
  VALUES(p_role,item->>'module',coalesce((item->>'can_view')::boolean,false),coalesce((item->>'can_create')::boolean,false),coalesce((item->>'can_edit')::boolean,false),coalesce((item->>'can_delete')::boolean,false),coalesce((item->>'can_export')::boolean,false),coalesce((item->>'can_approve')::boolean,false),coalesce((item->>'can_assign')::boolean,false),coalesce((item->>'can_import')::boolean,false),coalesce((item->>'can_manage_settings')::boolean,false))
  ON CONFLICT(role_key,module) DO UPDATE SET can_view=EXCLUDED.can_view,can_create=EXCLUDED.can_create,can_edit=EXCLUDED.can_edit,can_delete=EXCLUDED.can_delete,can_export=EXCLUDED.can_export,can_approve=EXCLUDED.can_approve,can_assign=EXCLUDED.can_assign,can_import=EXCLUDED.can_import,can_manage_settings=EXCLUDED.can_manage_settings,updated_at=clock_timestamp();
  n=n+1;
 END LOOP;
 INSERT INTO public.audit_logs(user_id,action,module,category,changes) VALUES(auth.uid(),'update','settings','permission_change',jsonb_build_object('role_key',p_role,'permissions',p_rows));
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.crm_save_permissions(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_save_permissions(text,jsonb) TO authenticated;
CREATE TRIGGER crm_roles_audit AFTER INSERT OR UPDATE ON public.custom_roles FOR EACH ROW EXECUTE FUNCTION private.crm_settings_audit();
CREATE TRIGGER crm_workflow_audit AFTER UPDATE ON public.approval_rules FOR EACH ROW EXECUTE FUNCTION private.crm_settings_audit();
CREATE TRIGGER crm_users_audit AFTER UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION private.crm_settings_audit();
CREATE FUNCTION private.crm_preserve_own_admin() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF auth.uid()=OLD.id AND OLD.role='admin' AND OLD.is_active AND (NEW.role<>'admin' OR NOT NEW.is_active) THEN RAISE EXCEPTION 'Cannot disable or demote your own administrator account'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.crm_preserve_own_admin() FROM PUBLIC;
CREATE TRIGGER crm_preserve_own_admin BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION private.crm_preserve_own_admin();
