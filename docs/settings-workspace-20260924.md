# Settings workspace — 24 September 2026

This is a settings repair delivery, **not full CRM production acceptance**.

## Implemented

- Company: general information, bilingual addresses, tax ID, logo URL / raster upload, contact details, social links and regional defaults; validation, discard, reload and optimistic stale-write rejection.
- Teams: create, edit, active/inactive state, active CRM leader/member selection; database constraints and admin-only writes.
- Users: profile/role/department editing, active/inactive state, self-admin protection; invitation UI uses the existing authenticated invitation endpoint. No invitation email was sent during testing.
- Roles: custom role creation and editing; atomic module-permission matrix and dashboard visibility/default writes with protected administrator role. Existing RLS remains authoritative.
- Language: current-language controls, persistent globe toggle selection and company default for users without a stored preference.
- Notifications: account-scoped inbox with read/unread updates, filtering, pagination and CSV export.
- Audit: actual database records, search within each page, record details, pagination and CSV export. New company/team/role/user/workflow writes are audited atomically.
- Import/export: customers, contacts, leads and master references; downloadable templates, CSV validation, preview before insert, up to 500 new rows per import, formula-safe exports. Existing records are not overwritten.
- Security: actual Authenticator status, TOTP enrollment/verification, cancellation of pending enrollment and revocation of other refresh sessions. Existing issued access tokens can remain valid until expiry.
- Master references: 17 categories, including seven asset categories. Sales Stage and Asset Settings routes now open real reference editors instead of static example lists.
- Consolidated the duplicate Function Settings hub entry into Roles & Permissions; its old route remains usable.

## Validation

- 16 unit/access/CSV-validation tests passed; integration contract and JavaScript syntax passed.
- Real database rollback-only tests passed three times: company/team writes and read-back, team stale-write rejection, bad-member/invalid-input rejection, atomic permission updates, audit creation, self-admin protection, non-admin and anonymous denial.
- All eight stage/asset reference categories passed create/update/read-back tests three times; no test rows retained.
- Browser tests run as three independent GitHub Actions rounds, each on desktop and mobile. They cover existing navigation, design settings, 17 master categories, new company/team/role form flows, import/export, error handling, language persistence and typography.
- UI tests run in isolated demo mode. Database tests run separately under authenticated database roles. This is not authenticated browser-to-database acceptance testing.

## Remaining limits

- Multi-stage document approval routing is not implemented by the rule editor. The page states this explicitly.
- Stored master references are not yet substituted for all hardcoded business-form choices or pipeline rules. Existing documents are unchanged; the pages state this explicitly.
- External model AI, Email/LINE delivery, Intune, Microsoft/Google calendar, inventory synchronization, Stripe and Account 360/EAM synchronization still need their provider credentials/configuration and live acceptance tests. The connector sessions in this conversation do not automatically supply credentials to the CRM server.
- AI Settings now reports the actual rule-based fallback instead of nonfunctional model/enable switches; it is not an external model connection.
- Invitations and MFA enrollment are implemented against real Auth APIs but not tested with a live recipient or a user's authenticator. No password or MFA was changed during this task.
- Regional defaults are stored and language default is applied; legacy document formatters are not all converted to configurable date/currency formatting.
- Global notification delivery preferences still require delivery-service integration; the inbox shows actual stored account notifications.

## Existing shared-project security findings

`public.example` still has RLS disabled. Its ownership and intended access policy are unknown; it was not changed automatically. Candidate SQL, to be paired with the owning app's intended policies:

```sql
ALTER TABLE public.example ENABLE ROW LEVEL SECURITY;
```

Reference: https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public

The existing mutable-search-path function and disabled leaked-password protection also remain. No new security advisory was introduced by the new settings objects.

Full completion and shutdown conditions are not met. The user's Windows computer remains on.
