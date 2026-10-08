# KC CuTo CRM permission boundary — 9 October 2026 (Asia/Bangkok)

Production target: https://kc-cuto.kaicomhub.com/
Source baseline: `50ba35d09cbe06ce7ab5a9563907dbc2dc38ea70` in `aukkarapornsiri/kc-kuto-crm`.
Database: `tocsxnprspiogawignib`. Applied migration: `20261008171808_unified_permission_boundary`.

## Confirmed issues corrected

- Delegated Settings edit/manage permission previously allowed role-matrix writes and changes to other users. Role/matrix/dashboard-access writes, invitations, user removal, password-reset API and protected profile fields now require the existing `is_super_admin` identity.
- Ordinary Admin no longer bypasses the matrix. Its existing grants are retained and its matrix is editable by Super Admin. Super Admin remains protected from lockout.
- A shared active-account check rejects suspended, deleted, deletion-pending, banned and incomplete-onboarding users. It is used by the permission helper, frontend access context and privileged Edge handlers. Sixty-four restrictive RLS policies cover CRM tables and permission configuration.
- Inventory was missing from the frontend matrix. It is now a first-class permission module; create/edit/delete/export/settings controls follow their respective grants.
- Direct route gates and settings cards respect restricted administration pages and scoped Inventory/import/export access. The unconditional sales-dashboard exception was removed.
- Import uses the permission-checked import RPC. The settings export workflow uses an explicit export RPC. Assignment changes on leads/opportunities have an additional Assign check.
- Six Edge Functions now consult database authorization: server, crm-invite, crm-user-admin, crm-ai, marketing-email and crm-experience.
- TRUNCATE/TRIGGER/REFERENCES grants were revoked from anon/authenticated for CRM tables; these grants are not needed by the application.

## Validation

- Initial hardening: 175 automated tests passed (superseded by the 258-test retest below). Added coverage for ordinary users with independently granted Inventory actions, Super Admin-only routes, blocked account states and ordinary Admin denial.
- Live database transaction tests exercised authenticated RLS, attempted matrix/user escalation, direct RPC denial, immediate matrix grant/revoke, suspension, deletion and onboarding. All test changes were rolled back.
- JavaScript and changed Edge TypeScript syntax checks passed.
- Security advisor: no ERROR findings; remaining password leak-protection warning is an existing Auth configuration item. No-policy INFO findings are outside this change or intentionally private/service-only tables.
- Production browser was signed out. Full interactive workflows with real accounts of every role have not been certified in this session. Automated component tests and live database tests are separate evidence, not a claim of that browser coverage.

## Boundaries

View permission necessarily allows reading data; disabling the application Export action cannot prevent a viewer from copying information already authorized for reading. Existing business rules (approval sequencing, preventing self-approval, stock integrity) remain enforced. This change does not grant new roles to users or alter customer records.

## Browser CI follow-up

The full browser suite found three failures also present at baseline commit 50ba35d: internal-workspace lead detail close, opportunity stage probability (60 vs 100), and settings-workspace outdated permission selector. These initial failures were subsequently addressed during the requested retest below. A fourth failure introduced by the permission change hid demo Customer 360 identity controls; restored the explicit demo allowance while retaining Super Admin enforcement for real sessions. Real-account browser coverage across every role remains outstanding.

## Requested retest, 9 October 2026

- Live production transaction: **33,075 permission assertions passed**, covering all 81 stored roles, 15 modules and 9 actions (current configuration, revocation, grants), Super Admin rights and disabled-account denial. Added `tests/permission-matrix-exhaustive.sql`. No login credentials or sessions created; every fixture and matrix change rolled back.
- Added all-role frontend tests for isolated action grants, inactive/deleted/pending account denial, menu filtering and direct-page denial.
- Corrected two stale browser selectors for the redesigned lead/contact details and the Roles tab. Fixed Opportunity Stage event handling to snapshot the selected value before React executes the queued update; regression test verifies Won stays at 100%.
- Browser role simulation and database-role assertions are distinct from interactive login as real employees. No real employee credentials used.

- Blocked-account live SQL: **320/320 table checks passed** across 64 tables and five states: inactive profile, removed profile, Auth ban, Auth deletion, incomplete onboarding. All changes rolled back.
- Seven live Edge endpoints rejected unauthenticated requests with HTTP 401. Service-only actor, archive and invitation RPCs are not executable by anon/authenticated roles.
- Full browser retest reached further into previously blocked suites. Updated remaining stale Opportunity close and access-management heading selectors; synchronized Stage assertions with React rendering. Split the same suite list into four CI groups so failures can be diagnosed independently.

- Follow-up tests found and fixed Lead assignment visibility (requires Edit and Assign), restored permitted linked-account navigation, and gated cross-module create actions. Price Book now uses Inventory permissions consistent with database policies; removed an unrelated approval prerequisite and supplied the shared access hook to its Inventory view.
- Local automated tests after these fixes: **258/258 passed**. Full browser CI rerun passed: all 23 suites in four groups, including desktop/mobile coverage.

## Final retest result

- Tested application commit: `88961b6dbb0b25b696752031feb5bb38fefe442a` (application fixes in `1e4e587a18e733f65cfd0d01d0c2e9d9888b7ef2`).
- Browser CI run `37821781076`: all four jobs passed, all 23 suites retained. Internal workspace verified 13 entity workflows at 1440px and 390px, ten bidirectional customer links, activity and opportunity dialogs, and nested Price Book → Inventory navigation without runtime errors.
- Validation CI run `37821780842`: passed code checks and database-role/sales-target integration jobs.
- Pages deployment run `37821780077`: success. Production browser loaded release `20261009-permission-retest`; Price Book → Products & Inventory opened successfully. Demo session was signed out after testing.
- Final counts: 258 automated code tests; 33,075 live matrix assertions across 81 roles; 320 blocked-account table checks across 64 tables; seven live unauthenticated endpoints rejected with HTTP 401; 23 browser suites passed.
- Live database fixtures were rolled back. Browser workflows used demo records; this report does not certify interactive login with each real employee account.
