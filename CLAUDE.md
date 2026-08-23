# RecBuddy — Repo-Wide Precedents

Monorepo: `apps/athlete-ios` (SwiftUI athlete app), `apps/coach-web` (React coach
app — see its own CLAUDE.md for engineering standards), `supabase/` (backend),
`docs/appstore/` (App Store + legal manuscripts).

## Legal-documentation release gate (non-negotiable)

Every feature that changes what RecBuddy collects, shares, charges, or promises
**must ship its legal-document updates in the same PR** — the docs may never lag
the product (precedent: the HealthKit privacy section shipped alongside the
HealthKit integration; the gap before that fix is the failure mode this rule
prevents).

Before merging any feature PR, check whether it touches:

- **Data collection or new data sources** (device integrations like Garmin/Coros,
  SSO identity providers, analytics, new profile fields) → update the Privacy
  Policy (`docs/appstore/privacy-policy.md` + `apps/coach-web/src/routes/legal/PrivacyPage.tsx`)
  and re-check the App Store privacy nutrition label.
- **Money** (subscriptions, purchases, refunds) → add billing/auto-renewal/refund
  sections to the Terms; material changes to paid terms need affirmative
  re-consent from existing users, not just continued-use acceptance.
- **Sharing or visibility changes** (who can see whose data) → Privacy Policy
  "How your information is shared."
- **Auth changes** (SSO, passwordless) → Privacy Policy sign-in-provider
  disclosure, and verify the delete-account flow still works for the new auth
  type (Apple requires deletion for all account types; the current flow
  re-verifies a password, which SSO users don't have).
- **User content types** (new media in chat, new user-generated content) →
  Privacy Policy "Communications" and the Terms' content/license language.

Canonical legal docs live in three synchronized places — update all together:
`docs/appstore/*.md` (manuscripts), `apps/coach-web/src/routes/legal/*.tsx`
(live pages at recbuddy.app), `apps/athlete-ios/RecBuddy/Views/Account/TermsView.swift`
(iOS terms). Bump the "Last updated" date on every revision.

Still-deferred legal items (attorney-level, tracked in the product backlog —
deliberately deferred by the owner, not forgotten): arbitration/class-waiver
clause, WA My-Health-My-Data analysis, entity naming (pending LLC formation).
Do not silently drop these when related features land. The 2026-08-23 legal
hardening shipped everything else (coach disclaimer, eligibility, warranties,
damages cap, NY governing law, termination rights, UGC license).
