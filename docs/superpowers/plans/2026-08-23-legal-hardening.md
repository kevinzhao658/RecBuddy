# Legal Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the Terms & Conditions from 10 to 17 sections (coach disclaimer, eligibility, warranties, damages cap, NY governing law, acceptable use, UGC license) and make two privacy-policy additions, across all three synchronized legal surfaces, before the iOS v1.0 archive.

**Architecture:** Pure content changes to existing components — `TermsPage.tsx` SECTIONS array, iOS `TermsView.swift` mirror, new `docs/appstore/terms.md` manuscript, small edits to the privacy policy pair and the signup legal sentence. No new components, routes, or dependencies.

**Tech Stack:** Existing (React/Vitest for web, SwiftUI for iOS, markdown manuscripts).

**Spec:** `docs/superpowers/specs/2026-08-23-legal-hardening-design.md`

## Global Constraints

- Branch `feat/legal-hardening` off `feat/legal-pages-footer` (PR #53 is open and owns the legal pages). PR base = `feat/legal-pages-footer`; retarget to `dev` after #53 merges. Never delete branches.
- The 17 sections' text must be **byte-identical** across TermsPage.tsx, TermsView.swift, and terms.md (modulo each format's syntax). The canonical text lives in Task 1 of this plan — copy it verbatim, including em dashes (—), en dash in "coach–athlete", arrows (→), and typographic quotes (“as is”/’).
- Governing law: **State of New York**. Eligibility: **13+, under-18 with parent/guardian consent**. Damages cap: greater of 12 months' fees or **US $100**.
- Contact email `support@recbuddy.app` everywhere; no `kevin@`.
- Terms "Last updated" → **August 2026**; Privacy "Last updated" → **August 23, 2026** (Effective date stays July 31, 2026).
- No emoji; existing theme tokens only; no new packages. coach-web commands run from `apps/coach-web/`.

---

### Task 1: Branch + Terms rewrite (web) — canonical text lives here

**Files:**
- Modify: `apps/coach-web/src/routes/legal/TermsPage.tsx`
- Modify: `apps/coach-web/src/routes/legal/TermsPage.test.tsx`

**Interfaces:**
- Consumes: `LegalPage`, `LegalSection` (unchanged).
- Produces: **THE canonical 17-section text** — Tasks 2 and 3 copy from this task's SECTIONS array verbatim.

- [ ] **Step 1: Create the branch**

```bash
cd /Users/kevinzhao/Documents/CodingProject/RecBuddy
git checkout feat/legal-pages-footer && git pull && git checkout -b feat/legal-hardening
```

- [ ] **Step 2: Write the failing test**

Replace the test in `apps/coach-web/src/routes/legal/TermsPage.test.tsx` with:

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TermsPage from './TermsPage'

test('renders all seventeen sections with the support contact', () => {
  render(<MemoryRouter><TermsPage /></MemoryRouter>)
  expect(screen.getByRole('heading', { level: 1, name: 'Terms & Conditions' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 2, name: '1. Acceptance of Terms' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 2, name: '2. Eligibility' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 2, name: '4. Role of RecBuddy; Coaches' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 2, name: '12. Disclaimer of Warranties' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 2, name: '14. Governing Law & Venue' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 2, name: '17. Contact' })).toBeInTheDocument()
  expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(17)
  expect(screen.getByText(/at least 13 years old/)).toBeInTheDocument()
  expect(screen.getByText(/State of New York/)).toBeInTheDocument()
  expect(screen.getAllByText(/support@recbuddy\.app/).length).toBeGreaterThanOrEqual(2)
  expect(screen.queryByText(/kevin@recbuddy\.app/)).not.toBeInTheDocument()
  expect(screen.getByText(/last updated august 2026/i)).toBeInTheDocument()
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/coach-web && npx vitest run src/routes/legal/TermsPage.test.tsx`
Expected: FAIL — heading `2. Eligibility` not found, h2 count 10 ≠ 17

- [ ] **Step 4: Replace the SECTIONS array**

In `apps/coach-web/src/routes/legal/TermsPage.tsx`, replace the entire `SECTIONS` constant with the following (and change the `updated` prop to `"August 2026"`). This is the **canonical text** for Tasks 2 and 3:

```tsx
const SECTIONS: { title: string; text: string }[] = [
  { title: '1. Acceptance of Terms', text: 'By creating a RecBuddy account and using the app, you agree to these Terms & Conditions and to our Privacy Policy at recbuddy.app/privacy, which is incorporated into these Terms by reference. If you do not agree, please do not use the service.' },
  { title: '2. Eligibility', text: 'You must be at least 13 years old to use RecBuddy. If you are under 18, you may use RecBuddy only with the consent of a parent or legal guardian who has reviewed and agreed to these Terms on your behalf.' },
  { title: '3. Description of Service', text: 'RecBuddy is an athletic training platform that connects athletes with coaches. The app stores training plans, workout logs, and coach–athlete communications to support your training.' },
  { title: '4. Role of RecBuddy; Coaches', text: 'Coaches on RecBuddy are independent third parties, not employees or agents of RecBuddy. RecBuddy does not vet, certify, endorse, or supervise coaches, and does not review or approve training plans. All training guidance comes from your coach, not from RecBuddy. Your relationship with your coach — and any dispute arising from it — is solely between you and your coach.' },
  { title: '5. Training Data Storage', text: 'You agree that RecBuddy may store your training data (including workout logs, pace, distance, heart rate, and coach notes) on secure servers. This data is used solely to provide and improve the service. We do not sell your personal training data to third parties.' },
  { title: '6. No Medical Advice; Assumption of Risk', text: 'RecBuddy is a training management tool and does not provide medical advice, diagnosis, or treatment. Always consult a qualified healthcare professional before beginning or modifying any exercise program. Running and athletic training carry inherent risks; you participate at your own risk.' },
  { title: '7. Account Responsibility', text: 'You are responsible for maintaining the confidentiality of your account credentials. You are responsible for all activity that occurs under your account. Notify us immediately at support@recbuddy.app if you believe your account has been compromised.' },
  { title: '8. Acceptable Use; Suspension', text: 'You agree not to use RecBuddy to harass, abuse, or harm others, to post unlawful or infringing content, or to interfere with or disrupt the service. We may suspend or terminate your account if you violate these Terms. We may modify or discontinue features of the service, with reasonable notice where practicable.' },
  { title: '9. Your Content', text: 'You retain ownership of the content you submit to RecBuddy, including messages, notes, photos, and logged workouts. You grant RecBuddy a non-exclusive, worldwide, royalty-free license to host, store, display, and transmit that content as needed to operate the service — for example, showing your logged runs and messages to your connected coach.' },
  { title: '10. Account Deletion Rights', text: 'You may delete your account at any time from Settings → Delete account. Upon deletion, your profile, training logs, plan data, and chat history will be permanently removed from our servers. Coach links will be severed. This action is irreversible.' },
  { title: '11. Intellectual Property', text: 'The RecBuddy app, its design, and all associated content are owned by RecBuddy and protected by applicable intellectual property laws. Training plans created by your coach remain the intellectual property of your coach. Your coach grants you a perpetual, personal, non-commercial license to use training plans delivered to you through RecBuddy, including after your coach connection ends.' },
  { title: '12. Disclaimer of Warranties', text: 'RecBuddy is provided “as is” and “as available,” without warranties of any kind, express or implied, including implied warranties of merchantability, fitness for a particular purpose, and non-infringement. We do not warrant that the service will be uninterrupted, error-free, or secure.' },
  { title: '13. Limitation of Liability', text: 'To the maximum extent permitted by law, RecBuddy shall not be liable for any indirect, incidental, or consequential damages arising from your use of the service, including injury sustained during training. RecBuddy’s total liability for any claim arising from or relating to the service will not exceed the greater of the amounts you paid to RecBuddy in the twelve months before the claim arose or US $100. Some jurisdictions do not allow the exclusion or limitation of certain warranties or damages, so some of the above limitations may not apply to you.' },
  { title: '14. Governing Law & Venue', text: 'These Terms are governed by the laws of the State of New York, without regard to its conflict-of-laws principles. You agree to the exclusive jurisdiction of the state and federal courts located in New York for any dispute that is not resolved informally.' },
  { title: '15. Severability; Entire Agreement', text: 'If any provision of these Terms is found unenforceable, the remaining provisions remain in full effect. These Terms, together with the Privacy Policy, are the entire agreement between you and RecBuddy regarding the service. Our failure to enforce any provision is not a waiver of it.' },
  { title: '16. Changes to Terms', text: 'We may update these Terms from time to time. Continued use of the app after changes constitutes acceptance of the revised Terms. Material changes will be communicated via the app or email.' },
  { title: '17. Contact', text: 'Questions about these Terms? Contact us at support@recbuddy.app.' },
]
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/coach-web && npx vitest run src/routes/legal/TermsPage.test.tsx`
Expected: PASS (1 test)

- [ ] **Step 6: Commit**

```bash
git add apps/coach-web/src/routes/legal/TermsPage.tsx apps/coach-web/src/routes/legal/TermsPage.test.tsx
git commit -m "feat(legal): Terms 10→17 sections — coach disclaimer, eligibility, warranties, NY law"
```

---

### Task 2: iOS TermsView mirror + terms.md manuscript

**Files:**
- Modify: `apps/athlete-ios/RecBuddy/Views/Account/TermsView.swift`
- Create: `docs/appstore/terms.md`

**Interfaces:**
- Consumes: the canonical 17-section text from Task 1's SECTIONS array (`apps/coach-web/src/routes/legal/TermsPage.tsx`) — copy each title/text **verbatim**.
- Produces: nothing downstream.

- [ ] **Step 1: Mirror the sections in TermsView.swift**

In `apps/athlete-ios/RecBuddy/Views/Account/TermsView.swift`:
- Change `Text("Last updated July 2026")` → `Text("Last updated August 2026")`.
- Replace the ten existing `termsSection(title:text:)` calls with seventeen, copying each `title`/`text` verbatim from Task 1's SECTIONS array. Swift string literals accept the typographic characters directly (—, –, →, “ ”, ’); escape nothing. Keep the surrounding `VStack` structure and the `termsSection` helper unchanged. (Text-only edit — no `xcodegen generate` needed.)

- [ ] **Step 2: Create the manuscript**

Create `docs/appstore/terms.md`:

```markdown
> Canonical copy: https://recbuddy.app/terms — update this file,
> `apps/coach-web/src/routes/legal/TermsPage.tsx`, and
> `apps/athlete-ios/RecBuddy/Views/Account/TermsView.swift` together.

# RecBuddy Terms & Conditions

**Last updated:** August 2026

## 1. Acceptance of Terms
[text verbatim from Task 1]
```

…and so on: one `## N. Title` heading + paragraph per section, all seventeen, text copied verbatim from Task 1's SECTIONS array. **Keep each section's paragraph on a single unwrapped line** — Step 3's sync check does exact substring matching and hard-wrapped lines would break it.

- [ ] **Step 3: Verify the three surfaces match**

```bash
cd /Users/kevinzhao/Documents/CodingProject/RecBuddy
# spot-check: every web section text appears in both the Swift file and the manuscript
node -e "
const src = require('fs').readFileSync('apps/coach-web/src/routes/legal/TermsPage.tsx','utf8');
const swift = require('fs').readFileSync('apps/athlete-ios/RecBuddy/Views/Account/TermsView.swift','utf8');
const md = require('fs').readFileSync('docs/appstore/terms.md','utf8');
const texts = [...src.matchAll(/text: '(.+?)' \},?\$/gm)].map(m => m[1].replace(/\\\\'/g, \"'\"));
if (texts.length !== 17) { console.error('parse failed:', texts.length); process.exit(1) }
const missing = texts.flatMap(t => [[t,'swift',swift],[t,'md',md]].filter(([txt,_,hay]) => !hay.includes(txt)).map(([txt,where]) => where+': '+txt.slice(0,50)));
console.log(missing.length ? 'MISSING:\n'+missing.join('\n') : 'all 17 sections present in swift + md');
process.exit(missing.length ? 1 : 0)
"
grep -c "termsSection(" apps/athlete-ios/RecBuddy/Views/Account/TermsView.swift   # expect 18 (17 calls + 1 helper definition)
grep -c "^## " docs/appstore/terms.md                                              # expect 17
```
Expected: `all 17 sections present in swift + md`, counts 18 and 17.

- [ ] **Step 4: Commit**

```bash
git add apps/athlete-ios/RecBuddy/Views/Account/TermsView.swift docs/appstore/terms.md
git commit -m "feat(legal): iOS TermsView mirrors 17 sections; terms.md manuscript"
```

---

### Task 3: Privacy additions + signup rename

**Files:**
- Modify: `docs/appstore/privacy-policy.md`
- Modify: `apps/coach-web/src/routes/legal/PrivacyPage.tsx`
- Modify: `apps/coach-web/src/routes/legal/PrivacyPage.test.tsx`
- Modify: `apps/coach-web/src/routes/SignupPage.tsx`
- Modify: `apps/coach-web/src/routes/SignupPage.test.tsx`

**Interfaces:** none new.

- [ ] **Step 1: Write the failing tests**

In `apps/coach-web/src/routes/legal/PrivacyPage.test.tsx`, change the date assertion and add the chat-images assertion:

```tsx
  expect(screen.getByText(/last updated august 23, 2026/i)).toBeInTheDocument()
  expect(screen.getByText(/photos and images you choose to share in chat/i)).toBeInTheDocument()
```
(The existing 12-h2 count and HealthKit assertions stay unchanged.)

In `apps/coach-web/src/routes/SignupPage.test.tsx`, update the legal-links test:

```tsx
  expect(screen.getByRole('link', { name: 'Terms & Conditions' })).toHaveAttribute('href', '/terms')
```
(The Privacy Policy link assertion stays unchanged.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/coach-web && npx vitest run src/routes/legal/PrivacyPage.test.tsx src/routes/SignupPage.test.tsx`
Expected: FAIL — date text not found; link name `Terms & Conditions` not found

- [ ] **Step 3: Make the edits**

`docs/appstore/privacy-policy.md`:
- `**Last updated:** July 31, 2026` → `**Last updated:** August 23, 2026`
- Under `**Communications**`, add a third bullet: `- Photos and images you choose to share in chat`

`apps/coach-web/src/routes/legal/PrivacyPage.tsx`:
- `updated="July 31, 2026"` → `updated="August 23, 2026"`
- In the Communications block of the "Information we collect" section, add `<li>Photos and images you choose to share in chat</li>` after the messages bullet.

`apps/coach-web/src/routes/SignupPage.tsx` — in the legal sentence, change the link text only:

```tsx
                <Link to="/terms" className="underline hover:text-text-mute">Terms & Conditions</Link> and{' '}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/coach-web && npx vitest run src/routes/legal/PrivacyPage.test.tsx src/routes/SignupPage.test.tsx`
Expected: PASS (all tests in both files)

- [ ] **Step 5: Commit**

```bash
git add docs/appstore/privacy-policy.md apps/coach-web/src/routes/legal/PrivacyPage.tsx apps/coach-web/src/routes/legal/PrivacyPage.test.tsx apps/coach-web/src/routes/SignupPage.tsx apps/coach-web/src/routes/SignupPage.test.tsx
git commit -m "feat(legal): privacy chat-images disclosure + date bump; signup names Terms & Conditions"
```

---

### Task 4: Verification + stacked PR

**Files:** none new.

- [ ] **Step 1: Full unit suite, lint, build**

Run: `cd apps/coach-web && npm run test:unit && npm run lint && npm run build`
Expected: all unit tests pass (lib/queries DB tests are excluded by test:unit — they need a live local Supabase); lint 0 errors; build completes.

- [ ] **Step 2: Push and open the stacked PR**

```bash
git push -u origin feat/legal-hardening
gh pr create --base feat/legal-pages-footer --title "feat(legal): harden Terms (10→17 sections) + privacy additions" --body "$(cat <<'EOF'
## Summary
Stacked on #53 (retarget to dev after it merges).

- Terms & Conditions 10→17 sections across all three surfaces (web page, iOS TermsView, new terms.md manuscript): coach-conduct/platform disclaimer, eligibility (13+, parental consent under 18), acceptable use + suspension rights, UGC license, athlete plan license, AS-IS warranty disclaimer, damages cap (12-mo fees or $100), New York governing law + venue, severability
- Privacy policy: chat photos/images disclosure; Last updated → Aug 23, 2026
- Signup sentence names "Terms & Conditions" (matches document title)

Deliberately excluded (attorney items, tracked in backlog): arbitration clause, WA MHMD analysis, entity naming (pending LLC).

Spec: docs/superpowers/specs/2026-08-23-legal-hardening-design.md
Plan: docs/superpowers/plans/2026-08-23-legal-hardening.md

## Test plan
- [x] TermsPage 17-h2 guard + NY/eligibility assertions; PrivacyPage 12-h2 guard + chat-images; signup link rename
- [x] npm run test:unit && npm run lint && npm run build
- [x] Cross-surface sync check (all 17 section texts byte-identical in web/iOS/manuscript)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Remind the owner**

After #53 merges: `gh pr edit <this-pr> --base dev`. This PR must merge **before the iOS v1.0 archive** so the binary ships the hardened TermsView.
