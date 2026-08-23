# Legal hardening (current product) — design

**Date:** 2026-08-23
**Status:** pending user approval
**Goal:** Close the liability gaps in the shipped product's Terms & Privacy Policy
before App Store v1 launch, so v1.0's binary and the reviewer-visible documents
carry the hardened language. Covers ONLY today's features (Bucket 1) — no
subscription/Garmin/SSO clauses (those ship with their features per the
CLAUDE.md legal-documentation release gate).

## Decisions (owner-made)

- **Governing law/venue:** State of New York.
- **Minors:** 13+ allowed; under-18 requires parent/guardian consent who agrees
  to the Terms on the minor's behalf.
- **Explicitly out of scope** (deferred to attorney consult, tracked in backlog):
  arbitration/class-waiver clause; WA My-Health-My-Data separate notice; entity
  naming (docs keep "RecBuddy" until the LLC exists, then "Who we are" updates).

## Terms & Conditions — new structure (17 sections, was 10)

| # | Section | Status |
|---|---|---|
| 1 | Acceptance of Terms | amended — incorporates Privacy Policy by reference |
| 2 | Eligibility | **NEW** — 13+, under-18 parental consent |
| 3 | Description of Service | unchanged |
| 4 | Role of RecBuddy; Coaches | **NEW** — coaches are independent third parties; RecBuddy does not vet/supervise; coach–athlete disputes are theirs; plans are coach content, not RecBuddy advice |
| 5 | Training Data Storage | unchanged |
| 6 | No Medical Advice; Assumption of Risk | amended — existing §4 retitled, risk sentence retained |
| 7 | Account Responsibility | unchanged (was §5) |
| 8 | Acceptable Use; Suspension | **NEW** — no harassment/unlawful content/interference; RecBuddy may suspend/terminate violators; may modify or discontinue features with reasonable notice |
| 9 | Your Content | **NEW** — user retains ownership; grants RecBuddy hosting/display/transmission license to operate the service |
| 10 | Account Deletion Rights | unchanged (was §6) |
| 11 | Intellectual Property | amended (was §7) — adds athlete's perpetual, personal, non-commercial license to delivered plans, surviving coach disconnect |
| 12 | Disclaimer of Warranties | **NEW** — AS IS / AS AVAILABLE, implied warranties disclaimed |
| 13 | Limitation of Liability | amended (was §8) — adds direct-damages cap (greater of 12-months' fees or US $100) + jurisdictional savings language |
| 14 | Governing Law & Venue | **NEW** — New York law; exclusive NY state/federal jurisdiction |
| 15 | Severability; Entire Agreement | **NEW** |
| 16 | Changes to Terms | unchanged (was §9) |
| 17 | Contact | unchanged (was §10) |

"Last updated" → August 2026.

## Privacy Policy — two additions

1. **Communications**: add "Photos and images you choose to share in chat."
2. "Last updated" → August 23, 2026 (Effective date unchanged).

Section count stays 12 on the web page (additions are bullet content), so the
existing 12-h2 test guard holds.

## Surfaces to update (synchronized set)

| Surface | Change |
|---|---|
| `apps/coach-web/src/routes/legal/TermsPage.tsx` | SECTIONS array → 17 sections |
| `apps/athlete-ios/RecBuddy/Views/Account/TermsView.swift` | mirror the 17 sections |
| `docs/appstore/terms.md` | **NEW** manuscript (fills the parity gap noted in review) with canonical-URL note |
| `docs/appstore/privacy-policy.md` + `apps/coach-web/src/routes/legal/PrivacyPage.tsx` | chat-images bullet + date bump |
| `apps/coach-web/src/routes/SignupPage.tsx` | legal sentence: "Terms of Service" → "Terms & Conditions" (name alignment with the document title) |

## Tests

- `TermsPage.test.tsx`: section count 10 → 17; new assertions: "Role of RecBuddy"
  and "Governing Law" headings render; eligibility text mentions 13.
- `PrivacyPage.test.tsx`: unchanged (12-h2 guard still passes); add chat-images
  text assertion.
- `SignupPage.test.tsx`: link-name assertion updated to "Terms & Conditions".

## Sequencing

Rides ahead of the iOS archive: merge before `RecBuddy Prod` is archived so
v1.0 ships the hardened `TermsView`. Web deploys via the normal Vercel flow.

## Error handling

None — static legal content; no runtime surface beyond existing pages.
