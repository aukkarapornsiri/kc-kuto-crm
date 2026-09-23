-- Additive settings extension. Existing CRM IDs, business records and policies are preserved.
-- Account reference: KC-Account-360 a926cbe, lib/personal-appearance.ts and company-experience API.
-- EAM reference: kc-asem-production, infra/postgres/001_init.sql (company-scoped UUIDs).
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS ui_design jsonb,
  ADD COLUMN IF NOT EXISTS ecosystem_scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS experience_version integer NOT NULL DEFAULT 0;

ALTER TABLE public.company_settings ADD CONSTRAINT crm_ui_design_valid CHECK (
 ui_design IS NULL OR COALESCE(
  jsonb_typeof(ui_design)='object'
  AND ui_design ?& ARRAY['primary','sidebar','background','font','fontSize','radius','density']
  AND ui_design - ARRAY['primary','sidebar','background','font','fontSize','radius','density']='{}'::jsonb
  AND (ui_design->>'primary') ~ '^#[0-9a-fA-F]{6}$'
  AND (ui_design->>'sidebar') ~ '^#[0-9a-fA-F]{6}$'
  AND (ui_design->>'background') ~ '^#[0-9a-fA-F]{6}$'
  AND ui_design->>'font' IN ('IBM Plex Sans Thai','Anuphan','Inter','system')
  AND ui_design->'fontSize' IN ('"14"'::jsonb,'"16"'::jsonb,'"18"'::jsonb)
  AND ui_design->'radius' IN ('"8"'::jsonb,'"12"'::jsonb,'"16"'::jsonb)
  AND ui_design->>'density' IN ('comfortable','compact'),false)
);
ALTER TABLE public.company_settings ADD CONSTRAINT crm_ecosystem_scope_valid CHECK (
 jsonb_typeof(ecosystem_scope)='object'
 AND ecosystem_scope - ARRAY['account_tenant_id','account_company_id','eam_company_id','branch_code']='{}'::jsonb
 AND COALESCE(ecosystem_scope->>'account_tenant_id','') ~ '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})?$'
 AND COALESCE(ecosystem_scope->>'account_company_id','') ~ '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})?$'
 AND COALESCE(ecosystem_scope->>'eam_company_id','') ~ '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})?$'
 AND COALESCE(ecosystem_scope->>'branch_code','') ~ '^[A-Z0-9_-]{0,30}$'
 AND (COALESCE(ecosystem_scope->>'account_tenant_id','')='')=(COALESCE(ecosystem_scope->>'account_company_id','')='')
);
ALTER TABLE public.company_settings ADD CONSTRAINT crm_experience_version_valid CHECK (experience_version>=0);
COMMENT ON COLUMN public.company_settings.ecosystem_scope IS 'Reference IDs only. Not verified and does not enable cross-system sync. Current CRM is singleton-company, not tenant-isolated.';
