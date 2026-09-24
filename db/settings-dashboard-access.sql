CREATE FUNCTION public.crm_save_dashboard_access(p_role text,p_rows jsonb) RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE item jsonb; n integer=0;
BEGIN
 IF NOT private.crm_is_admin() THEN RAISE EXCEPTION 'Admin required' USING ERRCODE='42501'; END IF;
 IF p_role='admin' OR NOT EXISTS(SELECT 1 FROM public.custom_roles WHERE role_key=p_role) THEN RAISE EXCEPTION 'Role is protected or unknown'; END IF;
 IF jsonb_typeof(p_rows)<>'array' OR jsonb_array_length(p_rows)<>8 THEN RAISE EXCEPTION 'Eight dashboard types are required'; END IF;
 IF (SELECT count(DISTINCT x->>'dashboard_type') FROM jsonb_array_elements(p_rows) x)<>8 THEN RAISE EXCEPTION 'Duplicate dashboard type'; END IF;
 IF (SELECT count(*) FROM jsonb_array_elements(p_rows) x WHERE (x->>'is_default')::boolean)<>1 THEN RAISE EXCEPTION 'Choose exactly one default dashboard'; END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
  IF item->>'dashboard_type' NOT IN ('my','sales','manager','exec','service','renewal','admin','ai') THEN RAISE EXCEPTION 'Unknown dashboard'; END IF;
  IF coalesce((item->>'is_default')::boolean,false) AND NOT coalesce((item->>'visible')::boolean,false) THEN RAISE EXCEPTION 'Default dashboard must be visible'; END IF;
  INSERT INTO public.dashboard_type_access(role_key,dashboard_type,visible,is_default) VALUES(p_role,item->>'dashboard_type',coalesce((item->>'visible')::boolean,false),coalesce((item->>'is_default')::boolean,false))
  ON CONFLICT(role_key,dashboard_type) DO UPDATE SET visible=EXCLUDED.visible,is_default=EXCLUDED.is_default,updated_at=clock_timestamp();n=n+1;
 END LOOP;
 INSERT INTO public.audit_logs(user_id,action,module,category,changes) VALUES(auth.uid(),'update','settings','permission_change',jsonb_build_object('role_key',p_role,'dashboard_access',p_rows));RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.crm_save_dashboard_access(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_save_dashboard_access(text,jsonb) TO authenticated;
