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

- 175 automated tests passed. Added coverage for ordinary users with independently granted Inventory actions, Super Admin-only routes, blocked account states and ordinary Admin denial.
- Live database transaction tests exercised authenticated RLS, attempted matrix/user escalation, direct RPC denial, immediate matrix grant/revoke, suspension, deletion and onboarding. All test changes were rolled back.
- JavaScript and changed Edge TypeScript syntax checks passed.
- Security advisor: no ERROR findings; remaining password leak-protection warning is an existing Auth configuration item. No-policy INFO findings are outside this change or intentionally private/service-only tables.
- Production browser was signed out. Full interactive workflows with real accounts of every role have not been certified in this session. Automated component tests and live database tests are separate evidence, not a claim of that browser coverage.

## Boundaries

View permission necessarily allows reading data; disabling the application Export action cannot prevent a viewer from copying information already authorized for reading. Existing business rules (approval sequencing, preventing self-approval, stock integrity) remain enforced. This change does not grant new roles to users or alter customer records.
