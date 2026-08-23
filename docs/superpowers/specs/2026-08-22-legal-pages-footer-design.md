# Legal pages + footer (coach-web) — design

**Date:** 2026-08-22
**Status:** approved
**Goal:** Live public URLs for `recbuddy.app/privacy`, `/terms`, and `/support` so
App Store Connect's Privacy Policy URL and Support URL fields resolve, plus a
slim footer linking them from the public pages.

## Why

Apple requires a live Privacy Policy URL (extra scrutiny with the HealthKit
entitlement) and a Support URL on the App Store listing. The content exists in
the repo (`docs/appstore/privacy-policy.md`, iOS `TermsView.swift`) but nothing
serves it at a URL. coach-web is what's deployed at `recbuddy.app`, so the pages
live there.

## Approach (chosen: static JSX)

Plain React route components with the content as JSX, sharing one layout shell.
Matches every existing route (`ConfirmedPage` et al.), no new dependencies, full
dark-theme styling control.

Rejected: markdown-sourced rendering (new dependency + prose styling for one of
three pages; terms comes from Swift, support has no markdown yet — YAGNI) and
static HTML in `public/` (off-brand, exits the SPA, Vercel `cleanUrls` fiddling).

**Source-of-truth flip:** once live, the web pages are canonical. The docs files
stay as manuscripts with a header note: "canonical copy lives at
recbuddy.app/<page> — update both together."

## Components

New, under `apps/coach-web/src/`:

| File | Purpose |
|---|---|
| `routes/legal/LegalPage.tsx` | Shared shell: Wordmark (links `/`), page title, "Last updated" line, centered prose column, footer |
| `routes/legal/PrivacyPage.tsx` | Privacy policy, ported 1:1 from `docs/appstore/privacy-policy.md` (incl. Apple Health/HealthKit section) |
| `routes/legal/TermsPage.tsx` | The 10 sections from iOS `TermsView.swift`, with `kevin@recbuddy.app` → `support@recbuddy.app` |
| `routes/legal/SupportPage.tsx` | New content (drafted in `docs/appstore/support.md` first): what RecBuddy is, contact `support@recbuddy.app`, response-time note, links to Privacy/Terms |
| `components/ui/Footer.tsx` | `© 2026 RecBuddy · Privacy · Terms · Support` — slim, muted, react-router `Link`s |

## Routing

Three public routes in `App.tsx`, outside `RequireCoach`/`RedirectIfCoach`:

```tsx
<Route path="/privacy" element={<PrivacyPage />} />
<Route path="/terms" element={<TermsPage />} />
<Route path="/support" element={<SupportPage />} />
```

`vercel.json` already rewrites everything to `index.html`, so the URLs resolve
with no deploy-config change. Pages must render logged-out (App Review has no
coach account).

## Footer placement

Public pages only: login, signup, confirmed, reset-password, and the three
legal pages (via `LegalPage`). **Not** on the `/coach` dashboard — full-height
working UI; coaches reach the pages by URL. Decided with user.

## Content details

- Contact email is `support@recbuddy.app` everywhere (Cloudflare forward is
  live/verified). This PR also updates the two `kevin@recbuddy.app` mentions in
  iOS `TermsView.swift` so platforms match. No other iOS changes.
- `docs/appstore/support.md` is drafted as the support-page manuscript, then
  ported to JSX like the others.
- Both existing docs files gain the canonical-URL header note.
- Styling: existing Tailwind tokens (`rb-surface`, `border-line`,
  `text-text-mute`, lime accent). No new design language.

## Error handling

None beyond the SPA's existing catch-all (`*` → `/coach` → login redirect).
Static pages have no failure modes; no data fetching.

## Testing

Vitest + Testing Library, matching existing route tests:

- Each legal page renders its heading and `support@recbuddy.app`
- Privacy page renders the Apple Health section heading (guards against
  regressing the HealthKit disclosure Apple checks)
- Footer renders links with `href` = `/privacy`, `/terms`, `/support`
- Public pages (e.g. login) render the footer

## Out of scope

- Footer on the `/coach` dashboard
- Serving markdown / content pipeline
- Any listing-copy changes in `docs/appstore/listing.md`
- App Store Connect field entry (user does this in the portal once URLs are live)
