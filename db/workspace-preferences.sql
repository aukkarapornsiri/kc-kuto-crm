-- Per-account visual preferences; no company or document settings are changed.
CREATE TABLE public.crm_workspace_preferences (
 user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 enabled boolean NOT NULL DEFAULT false,
 "primary" text NOT NULL DEFAULT '#0AADA9' CHECK ("primary" ~ '^#[0-9A-Fa-f]{6}$'),
 sidebar text NOT NULL DEFAULT '#172033' CHECK (sidebar ~ '^#[0-9A-Fa-f]{6}$'),
 background text NOT NULL DEFAULT '#F7FAFA' CHECK (background ~ '^#[0-9A-Fa-f]{6}$'),
 surface text NOT NULL DEFAULT '#FFFFFF' CHECK (surface ~ '^#[0-9A-Fa-f]{6}$'),
 border text NOT NULL DEFAULT '#DCE6E7' CHECK (border ~ '^#[0-9A-Fa-f]{6}$'),
 radius text NOT NULL DEFAULT '12' CHECK (radius IN ('0','8','12','16','24')),
 shadow text NOT NULL DEFAULT 'soft' CHECK (shadow IN ('none','soft','raised')),
 version integer NOT NULL DEFAULT 1,
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_workspace_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crm_workspace_preferences FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.crm_workspace_preferences TO authenticated;
CREATE POLICY workspace_read_own ON public.crm_workspace_preferences FOR SELECT TO authenticated
 USING (user_id=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.is_active));
CREATE POLICY workspace_insert_own ON public.crm_workspace_preferences FOR INSERT TO authenticated
 WITH CHECK (user_id=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.is_active));
CREATE POLICY workspace_update_own ON public.crm_workspace_preferences FOR UPDATE TO authenticated
 USING (user_id=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.is_active))
 WITH CHECK (user_id=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.is_active));
CREATE FUNCTION private.crm_workspace_version() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.user_id<>OLD.user_id THEN RAISE EXCEPTION 'Workspace owner cannot change'; END IF;
  NEW.version=OLD.version+1;
 ELSE NEW.version=1; END IF;
 NEW.updated_at=clock_timestamp();RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.crm_workspace_version() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER crm_workspace_version BEFORE INSERT OR UPDATE ON public.crm_workspace_preferences FOR EACH ROW EXECUTE FUNCTION private.crm_workspace_version();
