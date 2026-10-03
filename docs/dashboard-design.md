# Dashboard design, October 2026

Design direction: https://www.figma.com/design/8pSD6OrrySa2kY4WAFtkHp?node-id=2-2

Eight role views share a Navy/Cyan/Violet header, readable metric cards, role accents and subtle motion. Existing dashboard access checks and server data scopes remain authoritative. Motion can be disabled and respects the operating system reduced-motion preference.

Personal and sales views retain activity, lead, opportunity and quotation queries. Manager and executive live views use the sales target summary. Service uses existing tickets/SLA; renewal uses contracts; administration uses user and audit queries; AI retains its existing insight source. This redesign does not add an AI recommendation engine.

The new target chart and attainment ring consume the exact targetMetrics result used by the existing summary/table. Actual = successfully converted Sales Order net amount, THB, excluding VAT. Target = selected monthly allocation from the company/employee plan. A missing target remains unknown, not zero. Clicking a month updates the existing period controls; Full period restores the plan period. The full numerical table remains available below the chart. No production targets or sample sales are seeded.

Visual review: all eight role headers, desktop/mobile layout, Thai/English, filters, motion pause, sales-target month selection/reset. CI also verifies existing CRM flows and role/database contracts.

## Current sales attainment ring

The hero ring reads the same sales-target reader as Settings and Summary (crm_get_sales_targets in live mode). It shows net converted SO actuals divided by the complete current-year plan target, using personal scope on My Dashboard and the server-authorized company/team/self scope elsewhere. This annual figure is independent of the Summary period filters. Refresh occurs every 30 seconds, on window focus, and after target changes. Demo mode remains isolated from production.

The center shows the actual percentage, including values over 100%; only ring fill is capped. No positive target or a read failure displays an em dash with an explanatory caption. Ring fill animates to attainment while the value remains readable; pause and reduced-motion settings show the final fill immediately. Mobile also displays the ring.
