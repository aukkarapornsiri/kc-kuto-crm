# Service Desk

The Service section now opens the service overview. Use **Create case** for the large dialog; choose the existing customer and asset to load contact, site, serial number, warranty, contract and SLA information. No customer or asset master is copied into a new table.

## Workflow

New → Assigned → Acknowledged → Diagnosing → In progress / waiting / repair / claim / testing → Resolved → Customer confirmed → Closed.

- Assignment requires the existing `tickets.can_assign` permission. The new Service Engineer custom role only sees tickets assigned to that profile or naming it as backup.
- Resolution requires root cause, action, engineer, testing and resolution. Open repairs or claims block resolution; changed parts require a parts-used record.
- An out-of-warranty repair requires recorded customer approval. Linked quotations are drafts in the existing quotation module; its existing commercial approval process remains in place. The service approval flag records customer consent separately from internal quotation approval.
- RMA follows the ordered vendor/return/QC workflow. Completing a replacement claim updates the linked asset serial number and records its previous serial in immutable service history.
- Customer and asset details include an expandable Service history. Asset forms expose product/site/user, purchase/install dates, warranty provider and next maintenance; contracts can select an SLA policy.

## SLA and metrics

SLA snapshots are captured on case creation. Policies support 24×7 or Bangkok business hours, working weekdays, holidays and pause statuses. Acknowledgement stops response timing; resolution stops resolution timing. Timers refresh every second. The database checks for threshold alerts every five minutes and deduplicates them per case lifecycle.

Dashboard counts use all records visible under RLS. Open means not closed/cancelled; resolved cases awaiting customer confirmation remain open. Compliance uses resolved cases; response/resolution averages use the policy calendar and recorded pauses. First-time-fix uses the explicit “Fixed on first visit” answer, not an inferred claim of success. Repeat incidents count assets with multiple visible tickets. Repair cost includes repair costs plus parts quantity × cost. Empty denominators show —.

## Configuration and integrations

Service Settings manages request options, prefixes, problem symptoms, assignment rules, escalation thresholds, notification enablement and customer-update templates. SLA policies and teams have dedicated forms. Core workflow transitions remain enforced by the database.

In-app notifications are enabled. Service email content is stored as a **draft**, explicitly labelled in the UI; there is no claim of delivery and the Service module does not invoke an email provider. Email, Teams, LINE and external inventory delivery require a separately configured transport. Phone, LINE and customer-message entries are communication logs. Attachments use the private `service-attachments` bucket, signed read URLs and ticket-scoped RLS (25 MB limit).

## Demo and verification

The existing demo session seeds 10 customers/contacts/sites/contracts, 20 assets, 20 linked tickets, 5 engineers, 5 repairs and 5 claims on first entry to Service. These records never write to production. Other regression suites explicitly isolate their own demo fixtures.

- `tests/service-model.test.mjs`: priority, Bangkok warranty boundary, business calendars, SLA pauses and stop times, combined filters and closure rules.
- `tests/service-desk-rls.sql`: rollback-only repair closure, RMA replacement, out-of-warranty/quotation, pause/escalation, immutable events and engineer restrictions. No fixture remains and no external message is sent.
- `tests/service-desk-smoke.mjs`: desktop/mobile overview/drilldown, linked create popup, repair-to-close, knowledge article, RMA replacement, quotation draft, views and CSV.
- Existing quote, contact, opportunity, marketing/map, navigation and settings browser suites run alongside the service suite.

Reads currently use the CRM's bounded paged loader (500 rows/request, 20,000/table cap); exceeding the cap gives an explicit load error rather than presenting partial totals.
