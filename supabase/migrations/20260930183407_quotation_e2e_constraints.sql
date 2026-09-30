-- Existing account relationships were audited: zero mismatches.
alter table public.opportunities validate constraint crm_opportunity_contact_account;
alter table public.quotations validate constraint crm_quotation_contact_account;
alter table public.quotations validate constraint crm_quotation_opportunity_account;
-- Keep old optional drafts readable, but do not allow new links with no account.
alter table public.opportunities add constraint crm_opportunity_link_requires_account
 check(contact_id is null or customer_id is not null) not valid;
alter table public.quotations add constraint crm_quote_link_requires_account
 check((contact_id is null and opportunity_id is null) or customer_id is not null) not valid;
alter table public.quotations add constraint crm_quote_validity_order
 check(issue_date is null or valid_until is null or valid_until>=issue_date) not valid;
notify pgrst,'reload schema';
