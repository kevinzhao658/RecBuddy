# Legal Pages + Footer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Public `/privacy`, `/terms`, `/support` pages in coach-web plus a slim footer on the public pages, so App Store Connect's Privacy Policy URL and Support URL fields resolve.

**Architecture:** Three static JSX route components sharing one `LegalPage` shell, registered in `App.tsx` outside the auth guards. One `Footer` component reused by the shell and the four existing public pages. Content is ported verbatim from `docs/appstore/privacy-policy.md` and iOS `TermsView.swift`; the web pages become canonical afterward.

**Tech Stack:** React 19 + react-router 7 + Tailwind v4 (existing tokens only, no new dependencies). Vitest + Testing Library for tests. Vercel SPA rewrite already covers routing.

**Spec:** `docs/superpowers/specs/2026-08-22-legal-pages-footer-design.md`

## Global Constraints

- Work on branch `feat/legal-pages-footer` off `dev`; PRs target `dev`.
- Contact email is `support@recbuddy.app` everywhere. No `kevin@recbuddy.app` may remain in shipped copy (iOS `TermsView.swift` included).
- New routes must be public: never wrapped in `RequireCoach` or `RedirectIfCoach`.
- Styling uses existing theme tokens only (`text-text-mute`, `text-text-faint`, `border-line`, `text-accent`, `bg-surface2`, `hairline`); no new CSS variables, no new packages.
- No emoji in UI (house rule — inline SVG only, but no icons are needed here).
- Footer copyright string is exactly `© 2026 RecBuddy`.
- No footer on the `/coach` dashboard.
- All coach-web commands run from `apps/coach-web/`.

---

### Task 1: Branch + `Footer` component

**Files:**
- Create: `apps/coach-web/src/components/ui/Footer.tsx`
- Test: `apps/coach-web/src/components/ui/Footer.test.tsx`

**Interfaces:**
- Consumes: `Link` from `react-router-dom`.
- Produces: `export function Footer({ className = '' }: { className?: string })` — renders a `<footer>` with `© 2026 RecBuddy` and `Privacy` → `/privacy`, `Terms` → `/terms`, `Support` → `/support` links. Later tasks import it as `import { Footer } from '../components/ui/Footer'` (adjust relative depth).

- [ ] **Step 1: Create the branch**

```bash
cd /Users/kevinzhao/Documents/CodingProject/RecBuddy
git checkout dev && git pull && git checkout -b feat/legal-pages-footer
```

- [ ] **Step 2: Write the failing test**

Create `apps/coach-web/src/components/ui/Footer.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Footer } from './Footer'

test('renders copyright and the three legal links', () => {
  render(<MemoryRouter><Footer /></MemoryRouter>)
  expect(screen.getByText('© 2026 RecBuddy')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy')
  expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms')
  expect(screen.getByRole('link', { name: 'Support' })).toHaveAttribute('href', '/support')
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/coach-web && npx vitest run src/components/ui/Footer.test.tsx`
Expected: FAIL — `Failed to resolve import "./Footer"`

- [ ] **Step 4: Write the component**

Create `apps/coach-web/src/components/ui/Footer.tsx`:

```tsx
import { Link } from 'react-router-dom'

/** Slim legal footer for public pages. Not used on the /coach dashboard. */
export function Footer({ className = '' }: { className?: string }) {
  const link = 'hover:text-text-mute'
  return (
    <footer className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1 py-6 text-xs text-text-faint ${className}`}>
      <span>© 2026 RecBuddy</span>
      <span aria-hidden="true">·</span>
      <Link to="/privacy" className={link}>Privacy</Link>
      <span aria-hidden="true">·</span>
      <Link to="/terms" className={link}>Terms</Link>
      <span aria-hidden="true">·</span>
      <Link to="/support" className={link}>Support</Link>
    </footer>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/coach-web && npx vitest run src/components/ui/Footer.test.tsx`
Expected: PASS (1 test)

- [ ] **Step 6: Commit**

```bash
git add apps/coach-web/src/components/ui/Footer.tsx apps/coach-web/src/components/ui/Footer.test.tsx
git commit -m "feat(web): slim legal footer — Privacy · Terms · Support"
```

---

### Task 2: `LegalPage` shell

**Files:**
- Create: `apps/coach-web/src/routes/legal/LegalPage.tsx`
- Test: `apps/coach-web/src/routes/legal/LegalPage.test.tsx`

**Interfaces:**
- Consumes: `Footer` from `../../components/ui/Footer`, `Wordmark` from `../../components/ui/Wordmark` (signature: `Wordmark({ className }: { className?: string })`), `Link` from `react-router-dom`.
- Produces:
  - `export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode })` — full-page shell: Wordmark linking `/`, `<h1>{title}</h1>`, "Last updated {updated}", prose column, `Footer`.
  - `export function LegalSection({ title, children }: { title: string; children: React.ReactNode })` — `<h2>` + content block used by all three pages.
  - The prose column styles bare `<p>`, `<ul>`, `<li>`, `<strong>` via arbitrary variants — pages write plain HTML tags with no classes.

- [ ] **Step 1: Write the failing test**

Create `apps/coach-web/src/routes/legal/LegalPage.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LegalPage, LegalSection } from './LegalPage'

test('renders title, updated line, home link, section, and footer', () => {
  render(
    <MemoryRouter>
      <LegalPage title="Test Page" updated="August 2026">
        <LegalSection title="First Section"><p>Body text</p></LegalSection>
      </LegalPage>
    </MemoryRouter>,
  )
  expect(screen.getByRole('heading', { level: 1, name: 'Test Page' })).toBeInTheDocument()
  expect(screen.getByText(/last updated august 2026/i)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /recbuddy/i })).toHaveAttribute('href', '/')
  expect(screen.getByRole('heading', { level: 2, name: 'First Section' })).toBeInTheDocument()
  expect(screen.getByText('Body text')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/coach-web && npx vitest run src/routes/legal/LegalPage.test.tsx`
Expected: FAIL — `Failed to resolve import "./LegalPage"`

- [ ] **Step 3: Write the component**

Create `apps/coach-web/src/routes/legal/LegalPage.tsx`:

```tsx
import { Link } from 'react-router-dom'
import { Footer } from '../../components/ui/Footer'
import { Wordmark } from '../../components/ui/Wordmark'

/** Shared shell for the public legal/support pages (/privacy, /terms, /support).
 *  Public — never wrap in RequireCoach or RedirectIfCoach.
 *  The prose column styles bare <p>/<ul>/<li>/<strong> so page content stays
 *  plain HTML with no per-element classes. */
export function LegalPage({ title, updated, children }: {
  title: string
  updated: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-hairline px-6 py-5">
        <Link to="/" aria-label="RecBuddy home"><Wordmark className="text-2xl" /></Link>
      </header>
      <main className="mx-auto w-full max-w-[720px] flex-1 px-6 py-10">
        <h1 className="text-[32px] font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-text-faint">Last updated {updated}</p>
        <div className="mt-8 [&_li]:mt-1.5 [&_li]:text-[15px] [&_li]:leading-relaxed [&_li]:text-text-mute [&_p]:mt-3 [&_p]:text-[15px] [&_p]:leading-relaxed [&_p]:text-text-mute [&_strong]:font-semibold [&_strong]:text-text [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
          {children}
        </div>
      </main>
      <Footer />
    </div>
  )
}

/** One titled block within a LegalPage. */
export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 first:mt-0">
      <h2 className="text-[19px] font-bold tracking-tight">{title}</h2>
      {children}
    </section>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/coach-web && npx vitest run src/routes/legal/LegalPage.test.tsx`
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add apps/coach-web/src/routes/legal/
git commit -m "feat(web): LegalPage shell for public legal/support pages"
```

---

### Task 3: Privacy page + route

**Files:**
- Create: `apps/coach-web/src/routes/legal/PrivacyPage.tsx`
- Modify: `apps/coach-web/src/App.tsx` (add import + route)
- Modify: `docs/appstore/privacy-policy.md` (canonical-URL note under the H1)
- Test: `apps/coach-web/src/routes/legal/PrivacyPage.test.tsx`

**Interfaces:**
- Consumes: `LegalPage`, `LegalSection` from `./LegalPage`.
- Produces: `export default function PrivacyPage()` — registered at `/privacy`.

Content is `docs/appstore/privacy-policy.md` ported 1:1 (Effective/Last updated July 31, 2026). The Apple Health section heading must read exactly **Apple Health (HealthKit)** — a test guards it because Apple checks this disclosure.

- [ ] **Step 1: Write the failing test**

Create `apps/coach-web/src/routes/legal/PrivacyPage.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PrivacyPage from './PrivacyPage'

test('renders the policy with the HealthKit disclosure and contact email', () => {
  render(<MemoryRouter><PrivacyPage /></MemoryRouter>)
  expect(screen.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 2, name: 'Apple Health (HealthKit)' })).toBeInTheDocument()
  expect(screen.getByText(/read-only/)).toBeInTheDocument()
  expect(screen.getAllByText(/support@recbuddy\.app/).length).toBeGreaterThanOrEqual(2)
  expect(screen.getByText(/last updated july 31, 2026/i)).toBeInTheDocument()
  // Guards that ALL markdown sections were ported, not just the ones shown in the plan:
  // Who we are, Information we collect, Apple Health, How we use, How shared, Retention,
  // Choices/rights, Security, Children's, International, Changes, Contact = 12 h2s.
  expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(12)
  expect(screen.getByRole('heading', { level: 2, name: /children/i })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/coach-web && npx vitest run src/routes/legal/PrivacyPage.test.tsx`
Expected: FAIL — `Failed to resolve import "./PrivacyPage"`

- [ ] **Step 3: Write the page**

Create `apps/coach-web/src/routes/legal/PrivacyPage.tsx`. Content is the full policy from `docs/appstore/privacy-policy.md` — port every section, don't paraphrase. Structure (abridged here only for the middle sections, which repeat the identical pattern — copy each remaining markdown section into a `LegalSection` the same way):

```tsx
import { LegalPage, LegalSection } from './LegalPage'

const EMAIL = <a href="mailto:support@recbuddy.app" className="font-semibold text-accent hover:brightness-110">support@recbuddy.app</a>

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="July 31, 2026">
      <p>
        RecBuddy (&ldquo;RecBuddy,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) provides a
        running-training app that connects athletes with their coaches. This Privacy Policy explains
        what we collect, how we use it, and the choices you have. It applies to the RecBuddy iOS app
        and related services.
      </p>
      <p>If you do not agree with this policy, please do not use RecBuddy.</p>

      <LegalSection title="Who we are">
        <p>RecBuddy is operated by an individual developer. For any privacy question or request, contact us at {EMAIL}.</p>
      </LegalSection>

      <LegalSection title="Information we collect">
        <p>We only collect information needed to run the coaching experience. We do <strong>not</strong> use third-party analytics, advertising, or tracking SDKs, and we do <strong>not</strong> sell your data.</p>
        <p><strong>Account information</strong></p>
        <ul>
          <li>Email address</li>
          <li>Name and initials</li>
          <li>Optional profile details you choose to add (title, avatar image)</li>
          <li>Account role (athlete or coach)</li>
        </ul>
        <p><strong>Training profile</strong></p>
        <ul><li>Experience level and primary running goal</li></ul>
        <p><strong>Training and fitness data</strong></p>
        <ul>
          <li>Training plans and goals (goal race, distance, target time and pace, dates)</li>
          <li>Scheduled workouts and workout details</li>
          <li>Workouts you log, including distance, pace, time, and optionally <strong>heart rate</strong> and a perceived-effort (&ldquo;feel&rdquo;) rating, plus any notes you add. You can enter this manually, or let RecBuddy import it from Apple Health (see below).</li>
        </ul>
        <p><strong>Communications</strong></p>
        <ul>
          <li>Messages and workout cards exchanged between an athlete and their coach</li>
          <li>Coach–athlete connections you create using invite codes</li>
        </ul>
        <p><strong>Technical information</strong></p>
        <ul>
          <li>Standard information needed to operate the app securely, such as authentication tokens and timestamps. We do not maintain advertising identifiers or a behavioral tracking profile.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Apple Health (HealthKit)">
        <p>With your explicit permission, RecBuddy reads the following from Apple Health to automatically log your completed workouts against your training plan:</p>
        <ul>
          <li>Workouts (your recorded runs and rides)</li>
          <li>Running and cycling distance</li>
          <li>Heart rate</li>
        </ul>
        <p>Access is <strong>read-only</strong> — RecBuddy never writes to or modifies your Apple Health data. You grant this access through Apple&rsquo;s standard Health permission prompt, and you can review or revoke it at any time in the Apple Health app or iOS Settings.</p>
        <p>When RecBuddy matches a Health workout to a planned workout, the resulting logged run (distance, pace, time, heart rate) is stored in our backend and shown to your connected coach as a completed workout — this is the purpose of the feature.</p>
        <p>We use Apple Health data <strong>only</strong> to provide this in-app functionality. We never use it for advertising or marketing, never sell it, and never share it with third parties for their own purposes. It is not shared with any third party other than our backend service provider (Supabase) acting on our behalf.</p>
      </LegalSection>

      {/* Port the remaining markdown sections identically, one LegalSection each:
          "How we use your information" (bullet list + closing p),
          "How your information is shared" (4 bold-led bullets + closing p),
          "Data retention", "Your choices and rights" (4 bold-led bullets),
          "Data security", "Children's privacy", "International users",
          "Changes to this policy" — text verbatim from docs/appstore/privacy-policy.md */}

      <LegalSection title="Contact us">
        <p>Questions or requests? Email {EMAIL}.</p>
      </LegalSection>
    </LegalPage>
  )
}
```

- [ ] **Step 4: Register the route**

In `apps/coach-web/src/App.tsx`, add the import and route (public — outside both guards):

```tsx
import PrivacyPage from './routes/legal/PrivacyPage'
```

```tsx
      <Route path="/confirmed" element={<ConfirmedPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/coach-web && npx vitest run src/routes/legal/PrivacyPage.test.tsx`
Expected: PASS (1 test)

- [ ] **Step 6: Add the canonical note to the manuscript**

In `docs/appstore/privacy-policy.md`, insert directly under the `# RecBuddy Privacy Policy` line:

```markdown
> Canonical copy: https://recbuddy.app/privacy — update this file and
> `apps/coach-web/src/routes/legal/PrivacyPage.tsx` together.
```

- [ ] **Step 7: Commit**

```bash
git add apps/coach-web/src/routes/legal/PrivacyPage.tsx apps/coach-web/src/routes/legal/PrivacyPage.test.tsx apps/coach-web/src/App.tsx docs/appstore/privacy-policy.md
git commit -m "feat(web): public /privacy page — App Store privacy policy URL"
```

---

### Task 4: Terms page + route + iOS email alignment

**Files:**
- Create: `apps/coach-web/src/routes/legal/TermsPage.tsx`
- Modify: `apps/coach-web/src/App.tsx` (import + route)
- Modify: `apps/athlete-ios/RecBuddy/Views/Account/TermsView.swift` (2 email strings)
- Test: `apps/coach-web/src/routes/legal/TermsPage.test.tsx`

**Interfaces:**
- Consumes: `LegalPage`, `LegalSection` from `./LegalPage`.
- Produces: `export default function TermsPage()` — registered at `/terms`.

- [ ] **Step 1: Write the failing test**

Create `apps/coach-web/src/routes/legal/TermsPage.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TermsPage from './TermsPage'

test('renders all ten sections with the support contact', () => {
  render(<MemoryRouter><TermsPage /></MemoryRouter>)
  expect(screen.getByRole('heading', { level: 1, name: 'Terms & Conditions' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 2, name: '1. Acceptance of Terms' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 2, name: '10. Contact' })).toBeInTheDocument()
  expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(10)
  expect(screen.getAllByText(/support@recbuddy\.app/).length).toBeGreaterThanOrEqual(2)
  expect(screen.queryByText(/kevin@recbuddy\.app/)).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/coach-web && npx vitest run src/routes/legal/TermsPage.test.tsx`
Expected: FAIL — `Failed to resolve import "./TermsPage"`

- [ ] **Step 3: Write the page**

Create `apps/coach-web/src/routes/legal/TermsPage.tsx` — the ten sections verbatim from iOS `TermsView.swift`, with `kevin@recbuddy.app` → `support@recbuddy.app` in sections 5 and 10:

```tsx
import { LegalPage, LegalSection } from './LegalPage'

const SECTIONS: { title: string; text: string }[] = [
  { title: '1. Acceptance of Terms', text: 'By creating a RecBuddy account and using the app, you agree to these Terms & Conditions. If you do not agree, please do not use the service.' },
  { title: '2. Description of Service', text: 'RecBuddy is an athletic training platform that connects athletes with coaches. The app stores training plans, workout logs, and coach–athlete communications to support your training.' },
  { title: '3. Training Data Storage', text: 'You agree that RecBuddy may store your training data (including workout logs, pace, distance, heart rate, and coach notes) on secure servers. This data is used solely to provide and improve the service. We do not sell your personal training data to third parties.' },
  { title: '4. No Medical Advice', text: 'RecBuddy is a training management tool and does not provide medical advice, diagnosis, or treatment. Always consult a qualified healthcare professional before beginning or modifying any exercise program. Running and athletic training carry inherent risks; you participate at your own risk.' },
  { title: '5. Account Responsibility', text: 'You are responsible for maintaining the confidentiality of your account credentials. You are responsible for all activity that occurs under your account. Notify us immediately at support@recbuddy.app if you believe your account has been compromised.' },
  { title: '6. Account Deletion Rights', text: 'You may delete your account at any time from Settings → Delete account. Upon deletion, your profile, training logs, plan data, and chat history will be permanently removed from our servers. Coach links will be severed. This action is irreversible.' },
  { title: '7. Intellectual Property', text: 'The RecBuddy app, its design, and all associated content are owned by RecBuddy and protected by applicable intellectual property laws. Training plans created by your coach remain the intellectual property of your coach.' },
  { title: '8. Limitation of Liability', text: 'To the maximum extent permitted by law, RecBuddy shall not be liable for any indirect, incidental, or consequential damages arising from your use of the service, including injury sustained during training.' },
  { title: '9. Changes to Terms', text: 'We may update these Terms from time to time. Continued use of the app after changes constitutes acceptance of the revised Terms. Material changes will be communicated via the app or email.' },
  { title: '10. Contact', text: 'Questions about these Terms? Contact us at support@recbuddy.app.' },
]

export default function TermsPage() {
  return (
    <LegalPage title="Terms & Conditions" updated="July 2026">
      {SECTIONS.map((s) => (
        <LegalSection key={s.title} title={s.title}><p>{s.text}</p></LegalSection>
      ))}
    </LegalPage>
  )
}
```

- [ ] **Step 4: Register the route**

In `apps/coach-web/src/App.tsx`:

```tsx
import TermsPage from './routes/legal/TermsPage'
```

```tsx
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/coach-web && npx vitest run src/routes/legal/TermsPage.test.tsx`
Expected: PASS (1 test)

- [ ] **Step 6: Align the iOS TermsView emails**

In `apps/athlete-ios/RecBuddy/Views/Account/TermsView.swift`, two Edit replacements:

Old: `Notify us immediately at kevin@recbuddy.app if you believe your account has been compromised.`
New: `Notify us immediately at support@recbuddy.app if you believe your account has been compromised.`

Old: `Questions about these Terms? Contact us at kevin@recbuddy.app.`
New: `Questions about these Terms? Contact us at support@recbuddy.app.`

Verify: `grep -rn "kevin@recbuddy.app" apps/` → no matches. (Text-only edit — no `xcodegen generate` needed, no files added/removed.)

- [ ] **Step 7: Commit**

```bash
git add apps/coach-web/src/routes/legal/TermsPage.tsx apps/coach-web/src/routes/legal/TermsPage.test.tsx apps/coach-web/src/App.tsx apps/athlete-ios/RecBuddy/Views/Account/TermsView.swift
git commit -m "feat(web): public /terms page; align iOS terms contact to support@"
```

---

### Task 5: Support manuscript + page + route + routes smoke test

**Files:**
- Create: `docs/appstore/support.md`
- Create: `apps/coach-web/src/routes/legal/SupportPage.tsx`
- Modify: `apps/coach-web/src/App.tsx` (import + route)
- Test: `apps/coach-web/src/routes/legal/SupportPage.test.tsx`
- Test: `apps/coach-web/src/App.test.tsx` (all three routes reachable logged-out)

**Interfaces:**
- Consumes: `LegalPage`, `LegalSection` from `./LegalPage`; `Link` from `react-router-dom`.
- Produces: `export default function SupportPage()` — registered at `/support`.

- [ ] **Step 1: Write the support manuscript**

Create `docs/appstore/support.md`:

```markdown
> Canonical copy: https://recbuddy.app/support — update this file and
> `apps/coach-web/src/routes/legal/SupportPage.tsx` together.

# RecBuddy Support

RecBuddy connects runners with their coaches: personalized training plans, a
weekly workout calendar, run logging (manual or via Apple Health), and in-app
coach messaging.

## Contact us

Email **support@recbuddy.app** — we typically reply within 2–3 business days.
Please include the email address on your RecBuddy account and, if relevant, a
screenshot of what you're seeing.

## Common questions

**How do I connect with my coach?**
Ask your coach for an invite code, then enter it in the app under
Settings → Coaches → Add coach.

**How does Apple Health syncing work?**
With your permission, RecBuddy reads completed workouts (runs and rides,
distance, heart rate) from Apple Health and logs them against your plan
automatically. Access is read-only, and you can revoke it any time in the
Apple Health app or iOS Settings. Manual logging always works too.

**How do I delete my account?**
In the app: Settings → Account → Delete account. Deletion is permanent and
removes your profile, training data, and messages.

**Where is the privacy policy?**
At [recbuddy.app/privacy](https://recbuddy.app/privacy). Terms are at
[recbuddy.app/terms](https://recbuddy.app/terms).
```

- [ ] **Step 2: Write the failing tests**

Create `apps/coach-web/src/routes/legal/SupportPage.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SupportPage from './SupportPage'

test('renders contact email and common questions', () => {
  render(<MemoryRouter><SupportPage /></MemoryRouter>)
  expect(screen.getByRole('heading', { level: 1, name: 'Support' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'support@recbuddy.app' })).toHaveAttribute('href', 'mailto:support@recbuddy.app')
  expect(screen.getByText(/2–3 business days/)).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 2, name: 'Common questions' })).toBeInTheDocument()
})
```

Create `apps/coach-web/src/App.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from './App'

// The legal pages must render logged-out (App Review has no coach account),
// so App is mounted with no auth session at these paths.
test.each([
  ['/privacy', 'Privacy Policy'],
  ['/terms', 'Terms & Conditions'],
  ['/support', 'Support'],
])('%s renders publicly', (path, heading) => {
  render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)
  expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd apps/coach-web && npx vitest run src/routes/legal/SupportPage.test.tsx src/App.test.tsx`
Expected: FAIL — `Failed to resolve import "./SupportPage"`; App test fails on the missing `/support` route (heading not found)

- [ ] **Step 4: Write the page and register the route**

Create `apps/coach-web/src/routes/legal/SupportPage.tsx`:

```tsx
import { Link } from 'react-router-dom'
import { LegalPage, LegalSection } from './LegalPage'

const EMAIL = <a href="mailto:support@recbuddy.app" className="font-semibold text-accent hover:brightness-110">support@recbuddy.app</a>
const inline = 'font-semibold text-accent hover:brightness-110'

export default function SupportPage() {
  return (
    <LegalPage title="Support" updated="August 2026">
      <p>
        RecBuddy connects runners with their coaches: personalized training plans, a weekly workout
        calendar, run logging (manual or via Apple Health), and in-app coach messaging.
      </p>

      <LegalSection title="Contact us">
        <p>
          Email {EMAIL} — we typically reply within 2–3 business days. Please include the email
          address on your RecBuddy account and, if relevant, a screenshot of what you&rsquo;re seeing.
        </p>
      </LegalSection>

      <LegalSection title="Common questions">
        <p><strong>How do I connect with my coach?</strong></p>
        <p>Ask your coach for an invite code, then enter it in the app under Settings → Coaches → Add coach.</p>
        <p><strong>How does Apple Health syncing work?</strong></p>
        <p>
          With your permission, RecBuddy reads completed workouts (runs and rides, distance, heart
          rate) from Apple Health and logs them against your plan automatically. Access is read-only,
          and you can revoke it any time in the Apple Health app or iOS Settings. Manual logging
          always works too.
        </p>
        <p><strong>How do I delete my account?</strong></p>
        <p>In the app: Settings → Account → Delete account. Deletion is permanent and removes your profile, training data, and messages.</p>
        <p><strong>Where is the privacy policy?</strong></p>
        <p>
          At <Link to="/privacy" className={inline}>recbuddy.app/privacy</Link>. Terms are at{' '}
          <Link to="/terms" className={inline}>recbuddy.app/terms</Link>.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
```

In `apps/coach-web/src/App.tsx`:

```tsx
import SupportPage from './routes/legal/SupportPage'
```

```tsx
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/support" element={<SupportPage />} />
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/coach-web && npx vitest run src/routes/legal/SupportPage.test.tsx src/App.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add docs/appstore/support.md apps/coach-web/src/routes/legal/SupportPage.tsx apps/coach-web/src/routes/legal/SupportPage.test.tsx apps/coach-web/src/App.tsx apps/coach-web/src/App.test.tsx
git commit -m "feat(web): public /support page — App Store support URL"
```

---

### Task 6: Footer on the existing public pages

**Files:**
- Modify: `apps/coach-web/src/routes/LoginPage.tsx`
- Modify: `apps/coach-web/src/routes/SignupPage.tsx` (also: legal sentence → links)
- Modify: `apps/coach-web/src/routes/ConfirmedPage.tsx`
- Modify: `apps/coach-web/src/routes/ResetPasswordPage.tsx`
- Test: extend `apps/coach-web/src/routes/LoginPage.test.tsx`, `apps/coach-web/src/routes/SignupPage.test.tsx`

**Interfaces:**
- Consumes: `Footer` from `../components/ui/Footer`.
- Produces: nothing new — layout-only change. Pattern for every page: wrap the existing root in `flex min-h-screen flex-col`, swap the old root's `min-h-screen` for `flex-1`, append `<Footer />` before the wrapper closes.

- [ ] **Step 1: Write the failing tests**

Append to `apps/coach-web/src/routes/LoginPage.test.tsx`:

```tsx
test('renders the legal footer', () => {
  renderPage() // use this file's existing render helper; if none, render(<MemoryRouter><LoginPage /></MemoryRouter>)
  expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy')
  expect(screen.getByRole('link', { name: 'Support' })).toHaveAttribute('href', '/support')
})
```

Append to `apps/coach-web/src/routes/SignupPage.test.tsx`:

```tsx
test('legal sentence links to terms and privacy', () => {
  renderPage() // same note as above
  expect(screen.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/terms')
  expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy')
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/coach-web && npx vitest run src/routes/LoginPage.test.tsx src/routes/SignupPage.test.tsx`
Expected: the two new tests FAIL (`Unable to find an accessible element with the role "link"`); pre-existing tests still pass

- [ ] **Step 3: Add the footer to each page**

All four pages, same mechanical change. `LoginPage.tsx` / `SignupPage.tsx` (root is `grid min-h-screen md:grid-cols-2`):

```tsx
import { Footer } from '../components/ui/Footer'
```

Old:
```tsx
    <div className="grid min-h-screen md:grid-cols-2">
```
New:
```tsx
    <div className="flex min-h-screen flex-col">
      <div className="grid flex-1 md:grid-cols-2">
```

And at each file's end, old:
```tsx
      </div>
    </div>
  )
}
```
New:
```tsx
      </div>
      </div>
      <Footer />
    </div>
  )
}
```

`ConfirmedPage.tsx` / `ResetPasswordPage.tsx` (root is `grid min-h-screen place-items-center p-8`): same wrap with inner class `grid flex-1 place-items-center p-8`.

In `SignupPage.tsx`, also replace the plain legal sentence. Old:

```tsx
              <p className="text-center text-xs leading-relaxed text-text-faint">
                By creating an account you agree to RecBuddy’s Terms of Service and Privacy Policy.
              </p>
```

New (add `Link` to the existing `react-router-dom` import if not present — it is already imported):

```tsx
              <p className="text-center text-xs leading-relaxed text-text-faint">
                By creating an account you agree to RecBuddy’s{' '}
                <Link to="/terms" className="underline hover:text-text-mute">Terms of Service</Link> and{' '}
                <Link to="/privacy" className="underline hover:text-text-mute">Privacy Policy</Link>.
              </p>
```

After editing, run ESLint on the four files — indentation shifted:
`cd apps/coach-web && npx eslint src/routes/LoginPage.tsx src/routes/SignupPage.tsx src/routes/ConfirmedPage.tsx src/routes/ResetPasswordPage.tsx`

- [ ] **Step 4: Run the full route tests to verify everything passes**

Run: `cd apps/coach-web && npx vitest run src/routes/`
Expected: PASS — all pre-existing route tests plus the two new ones (footer must not break ConfirmedPage's existing queries)

- [ ] **Step 5: Commit**

```bash
git add apps/coach-web/src/routes/LoginPage.tsx apps/coach-web/src/routes/SignupPage.tsx apps/coach-web/src/routes/ConfirmedPage.tsx apps/coach-web/src/routes/ResetPasswordPage.tsx apps/coach-web/src/routes/LoginPage.test.tsx apps/coach-web/src/routes/SignupPage.test.tsx
git commit -m "feat(web): legal footer on public pages; signup legal sentence links"
```

---

### Task 7: Full verification + PR

**Files:** none new.

- [ ] **Step 1: Full test suite**

Run: `cd apps/coach-web && npm run test`
Expected: all tests pass, including pre-existing suites

- [ ] **Step 2: Lint + build**

Run: `cd apps/coach-web && npm run lint && npm run build`
Expected: no lint errors; `tsc -b && vite build` completes

- [ ] **Step 3: Visual smoke check**

Run: `npm run dev:coach` (repo root) and open `http://localhost:5176/privacy`, `/terms`, `/support`, `/login`:
- three pages render dark-themed with Wordmark header + footer
- login shows the footer below both panels
- no horizontal scrollbar at mobile width (devtools, 390px)

Fix anything off, amend the relevant commit or add a `style(web):` commit.

- [ ] **Step 4: Push and open the PR**

```bash
git push -u origin feat/legal-pages-footer
gh pr create --base dev --title "feat(web): public legal pages (/privacy /terms /support) + footer" --body "$(cat <<'EOF'
## Summary
- Public /privacy, /terms, /support pages in coach-web (App Store Connect's Privacy Policy URL + Support URL)
- Shared LegalPage shell; slim footer (© 2026 RecBuddy · Privacy · Terms · Support) on all public pages
- Signup legal sentence now links to /terms and /privacy
- iOS TermsView contact aligned to support@recbuddy.app
- Manuscripts: docs/appstore/support.md added; canonical-URL notes on privacy/support docs

Spec: docs/superpowers/specs/2026-08-22-legal-pages-footer-design.md

## Test plan
- [x] Unit: Footer, LegalPage, 3 pages, App route smoke tests, login/signup footer tests
- [x] npm run lint && npm run build
- [x] Manual: /privacy /terms /support /login at desktop + 390px

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

After merge + Vercel deploy: verify `https://recbuddy.app/privacy` and `https://recbuddy.app/support` in a logged-out browser, then paste both URLs into App Store Connect (they're the values already listed in `docs/appstore/listing.md`).
