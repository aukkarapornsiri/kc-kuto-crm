-- Microsoft sign-in links only to accounts already provisioned in CRM.
-- Keep email provisioning and other apps sharing Auth unchanged.
CREATE FUNCTION private.crm_block_unprovisioned_microsoft_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
 IF NEW.raw_app_meta_data->>'provider' = 'azure' THEN
  RAISE EXCEPTION 'Ask your administrator to create your CRM account before Microsoft sign-in' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.crm_block_unprovisioned_microsoft_user() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER crm_block_unprovisioned_microsoft_user
BEFORE INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION private.crm_block_unprovisioned_microsoft_user();
