create index if not exists crm_quotation_templates_updated_by_idx
  on public.crm_quotation_templates(updated_by)
  where updated_by is not null;

create index if not exists quotations_template_id_idx
  on public.quotations(template_id)
  where template_id is not null;
