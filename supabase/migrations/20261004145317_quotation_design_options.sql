alter table public.crm_quotation_templates add column if not exists design_options jsonb not null default '{}'::jsonb;
alter table public.crm_quotation_templates add constraint crm_quotation_design_options_object check (jsonb_typeof(design_options) = 'object');
