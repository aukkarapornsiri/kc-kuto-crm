# Shared sales targets

Settings → Organization → Sales Targets stores one plan per starting year, with an inclusive 1–12 month period that can cross a year boundary. Company and employee amounts are independent totals for their selected periods. Blank employee amounts mean unassigned; zero is an explicit zero target. Amounts are divided equally by month with the rounding remainder in the final month.

Dashboard and Reports → Sales target report use the same authenticated `crm_get_sales_targets({p_year})` RPC. Its response includes the plan, permitted people and employee targets, monthly target/actual amounts, scope, and export permission. No target amounts are seeded on deployment.

Actuals are converted Sales Orders in `kc_dw_sales_order_facts`, using `period_month`, `net_amount` excluding VAT, `status = converted` and `currency = THB`. Employee attribution matches profile email to sales_email case-insensitively. A plan without source orders displays zero actuals. It does not substitute opportunity pipeline values for sales.

Active administrators edit through `crm_save_sales_targets({p_year,p_start,p_end,p_company,p_employees,p_expected})`. Employee entries contain profile_id, start_month, end_month, amount. Existing plans require their latest updated_at as p_expected. A transaction validates all rows, prevents overlapping plans, replaces assignments atomically, and writes an audit entry. The UI reads back and compares the saved result before showing success.

The database scopes reads: sales see themselves, managers see themselves and direct reports or members of teams they lead, executives/admins see all. Company totals are hidden from personal/team readers. Browser table writes are disabled. External apps are not connected in this release; future consumers should call this authenticated API under the same access rules rather than copy target data or use a service key in a browser.

Model and database regressions cover rounding, invalid periods, stale updates, atomicity and access boundaries. Browser CI covers desktop/mobile save/readback, shared dashboard/report values, month filters and CSV downloads.
