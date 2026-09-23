# KC KuTo CRM — delivery and verification checkpoint

Status: **partial delivery; not all-function production acceptance**.

## Deployed

PR https://github.com/aukkarapornsiri/kc-kuto-crm/pull/2 merged as `140319e3d586318b2581860c2fbec3bd38281171`.

- Replaced the static Master Data page with create/edit/deactivate/search/reload across ten categories, Thai/English labels, explicit demo mode and real database errors.
- Added `master_data_items` to the existing cloud CRM with admin-only writes, active-profile reads, duplicate-code checks, input constraints, version-based stale-write rejection, and atomic audit logging. Hard deletion is not granted to client roles.
- No business sample records were seeded. Test writes and audit rows were rolled back.
- Existing Design, Ecosystem reference settings and other routes were preserved.
- Live module content matches the tested source. Live browser demo create/read-back was verified after publication.

## Three-round evidence and limits

| Verification | Round 1 | Round 2 | Round 3 | Scope |
|---|---|---|---|---|
| Browser regression | Pass | Pass | Pass | Desktop/mobile demo navigation, Design save/discard, ten-category Master Data create/edit/deactivate/duplicate/search/reload |
| Live database transaction tests | Pass | Pass | Pass | Admin create/update/read-back; duplicate, invalid-input and stale-write rejection; audit; non-admin write denial; non-CRM and anonymous read denial |
| Unit/contract/syntax tests | Pass | Pass | Pass | 10 unit tests, existing static integration contract assertions, bundle syntax |
| Recovered local source typecheck/build | Pass | Pass | Pass | Separate local source branch; not the deployed cloud frontend |

Browser run: https://github.com/aukkarapornsiri/kc-kuto-crm/actions/runs/35904181359
Validation run: https://github.com/aukkarapornsiri/kc-kuto-crm/actions/runs/35904181066

**These are not three complete authenticated end-to-end passes over every CRM function.** UI tests use demo data; backend tests exercise the real database separately. External integrations were not exercised against provider accounts.

## Recovered source

The Windows source repository is at `C:\Users\User\OneDrive - Netcube-Online\Desktop\KC Application\KC KuTo`, baseline `504853d`. It has no Git remote configured and differs materially from the deployed bundle: company-scoped local Supabase versus the cloud CRM's singleton-company model.

An isolated worktree at `C:\Temp\kc-kuto-source-20260924`, branch `fix/source-checks-20260924`, commit `b3c861b`, repairs seven source files:

- Unsupported CSS ring properties and undefined color references.
- String chart values where numbers are required.
- Missing nullable fields in customer demo fixtures.
- Contract audit payload types and a missing check for failure to read the original contract.

A portable code patch is retained at `source-recovery/typecheck-fixes.patch`, against baseline `504853d`. This is a source-repair checkpoint, not a replacement for the deployed bundle. The original working tree was preserved.

Scoped ESLint still reports **115 errors and 9 warnings**, both before and after the patch. The source project's AGENTS.md prohibits merge before lint passes, so this branch is not merged or deployed. TASKS.md and its HTML report record Needs Review, with no active file locks.

## Remaining work

1. Reconcile the recovered source, published integration/settings fixes, and the two database scopes. Do not replace production wholesale with the local build.
2. Repair source lint and verify authenticated create/edit/delete/approval/import/export workflows across the remaining modules. Static screens and Under Development paths remain in the deployed legacy bundle.
3. Wire master references into each applicable business form. Saving reference categories currently does not change hardcoded pipeline states or historical documents.
4. Contract renewal in the recovered source still performs two writes without one database transaction. The read-error guard does not solve atomicity or duplicate-renewal races.
5. Microsoft Intune, Microsoft Calendar, Google Calendar, Inventory and Stripe remain `not_configured`, disabled in the live database. Provider credentials, destination settings and real provider verification remain required. No emails, billing charges or provider writes were performed.
6. Account 360/EAM company mapping and synchronization are not verified. AI still has a deterministic local summary fallback, not a verified model-provider connection.
7. Existing shared-project findings remain: `public.example` has RLS disabled, `public.set_updated_at` has a mutable search path, and leaked-password protection is disabled. New master-data objects produced no additional security advisory.

For the existing unrelated example table, the candidate restriction is `ALTER TABLE public.example ENABLE ROW LEVEL SECURITY;`, but the owning application's intended policies must be decided before applying it. It was not changed automatically.

References: https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public and https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.

## Shutdown condition

The user authorized shutdown after the full work is finished. That condition is not met. The machine has not been shut down, and this checkpoint must not be described as full completion.
