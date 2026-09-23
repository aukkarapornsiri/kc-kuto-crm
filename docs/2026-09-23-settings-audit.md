# KC KuTo CRM: verified changes and remaining work

## Baseline

- Public site: https://aukkarapornsiri.github.io/kc-kuto-crm/
- Repository baseline: `0f71d83b3bcd57ad849824d9b200cdb227f0d343`.
- Backup branch: `backup-before-settings-foundation-20260923`.
- Repository contains a compiled frontend bundle and backend sources, but no original frontend source or source map. Both historical backup branches also contain compiled assets.
- Remote Desktop `DESKTOP-9788QRV` was offline during inspection. Its unsynced source and local Account/EAM databases were not accessed.

## Delivered implementation

- Searchable Settings center with all existing settings routes retained, six groups and dedicated Design / Ecosystem Reference pages.
- Editable source in `src/experience.mjs` and `src/experience.css`, with small, explicit integration points in the legacy bundle.
- Admin-only persisted design configuration, input validation and optimistic version checks. Discard/reload controls. Demo configuration is memory-only and explicitly labeled.
- Account 360 design defaults: teal `#0AADA9`, sidebar `#172033`, background `#F7FAFA`, IBM Plex Sans Thai, radius 12.
- Additive `company_settings` columns: `ui_design`, `ecosystem_scope`, `experience_version`. Existing business records, IDs and RLS policies preserved.
- `crm-experience` Edge Function verifies the user's Auth token and active CRM profile before returning appearance only. It does not expose company details, mapping IDs, or server credentials. Admin write policies remain unchanged.
- Ecosystem references accept Account tenant/company UUID pairs, EAM company UUID, and a branch code. **Reference configuration is not a working API integration.** No IDs were invented, no synchronization was enabled, and no external records were overwritten.
- Fixed Package page making unauthenticated Billing reads in demo mode; disabled demo checkout and stopped swallowing real Billing read errors.

## Reference sources

- `KC-Account-360` at `a926cbe36e552512e460e232a28224d9cc040cb1`: `lib/personal-appearance.ts`, `lib/settings-center.ts`, `app/api/company-experience/route.ts`.
- `kc-asem-production`: `infra/postgres/001_init.sql`, including company-scoped UUIDs and asset ownership.
- Current CRM uses a singleton company settings row. Adding reference IDs **does not establish multi-tenant isolation**.

## Verification and its limits

- Seven input-validation/access tests cover design values, UUID pairing, active-profile checks and appearance-only output.
- Existing integration contract tests and JavaScript syntax checks pass.
- Database transaction tests passed for admin writes, stale version rejection, malformed input rejection, ordinary-member denial and anonymous denial. All test writes were rolled back.
- Existing desktop/mobile navigation smoke checks open top-level/submenu screens. This does not prove every button or business workflow is complete.
- New settings browser tests check search, demo save/read-back, discard and invalid reference rejection.
- Authenticated end-to-end UI writes and cross-system integration tests still require an authorized signed-in session and configured destination services.

## Confirmed remaining work

1. Master Data: the visible Add button has no effect; source renders fixed rows through a shared static table component.
2. Original bundle contains seven `Under Development` markers and a two-factor-authentication preference labeled coming soon. These markers are code findings, not seven independently verified broken screens.
3. AI `handleAi` currently calls `localInsight`, a deterministic summary formatter; it does not invoke an AI model provider.
4. Microsoft Intune, Microsoft Calendar, Google Calendar, Inventory and Stripe all have `status=not_configured`, `enabled=false` in the actual integration table.
5. Account 360 and EAM company IDs, reachable API endpoints, authentication, contracts and reconciliation remain unverified. Do not treat the new reference form as connected status.
6. No claim of complete CRUD, scheduling, approval, reporting, tenant isolation, or full production readiness is made by this change.

## Existing shared-project security findings

- `public.example` has RLS disabled. It was not modified because its ownership and expected policies were not established. Proposed restriction for owner review: `ALTER TABLE public.example ENABLE ROW LEVEL SECURITY;` (requires appropriate policies for legitimate access).
- Existing `public.set_updated_at` has a mutable search path; leaked-password protection is disabled.
- These predate the settings extension. See https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public and https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.

## Rollback

Revert the frontend commits to the backup branch through a normal new revert commit. The added nullable/defaulted database columns can remain without affecting the old frontend; do not drop columns or reset the database. The new appearance function is independent of the existing `server` function.
