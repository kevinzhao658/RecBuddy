# Deploy / Production Runbook

Two independent tracks make up a release (see also `apps/coach-web/CLAUDE.md`):

- **Connection** — which Supabase a build talks to, via env vars (Vercel for prod, `.env.local` for dev).
- **Schema + functions** — applied to a Supabase project via migrations / function deploys (CI for prod).

Environments = **one Supabase project each**: `dev` (`bawezljwxehadmkjeydw`) and a separate `prod` project.

---

## 1. Frontend hosting (Vercel) — coach web app

The app lives in `apps/coach-web` (a standalone npm project, not a workspace).

1. Vercel → **New Project** → import this GitHub repo.
2. **Root Directory** = `apps/coach-web` (so Vercel builds the right package). Framework preset auto-detects **Vite** (build `vite build`, output `dist`).
3. SPA routing is handled by `apps/coach-web/vercel.json` (rewrites all paths to `index.html`), so deep links like `/coach` survive refresh.
4. **Environment Variables** (Production = prod Supabase; Preview can point at dev):
   - `VITE_SUPABASE_URL` = `https://<PROD_REF>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = prod **anon/public** key (never the service_role key)
5. Set production branch = `main`. Each push to `main` deploys; PRs get preview deploys.

> Vite bakes env vars at **build** time — change a value in Vercel → redeploy to apply.

## 2. Prod Supabase schema + functions (CI)

`.github/workflows/supabase-prod-deploy.yml` runs `db push` + `functions deploy` against prod on merge to `main` (paths: migrations / functions / config.toml). Set these **GitHub repo secrets** (Settings → Secrets and variables → Actions) — these are independent of Vercel:

- `SUPABASE_ACCESS_TOKEN` — Supabase dashboard → Account → Access Tokens
- `SUPABASE_PROD_PROJECT_REF` — the prod project ref
- `SUPABASE_PROD_DB_PASSWORD` — the prod database password

First-time bootstrap (before the first `main` merge), apply once manually:

```bash
supabase link --project-ref <PROD_REF>
supabase db push
supabase functions deploy
supabase link --project-ref bawezljwxehadmkjeydw   # re-link to dev
```

## 3. Supabase Auth settings (per project)

Apply these on **each** project (dev and prod) — they're per-project. Authentication →

- **URL Configuration** → Site URL = your Vercel prod domain; add it to Redirect URLs (so confirmation/reset links return to the app). Dev uses `http://localhost:5176`.
- **Confirm email** → keep **ON** (coach signup relies on it for email-ownership verification).
- **SMTP**: the built-in sender is rate-limited and not for production. Configure **custom SMTP** (Resend / Postmark / SendGrid) under Auth → SMTP so confirmation/reset/email-change messages are reliable.

**Email change uses an in-app OTP code** (Settings modal — no link/redirect). For it to work:
- **Secure email change → OFF.** When ON, Supabase requires confirming from *both* the old and new address, so a single code can't complete the change. Off = only the new address's code is needed.
- **Email template → "Change Email Address"** must include the code token, e.g. `Your email change code is {{ .Token }}`. The default template sends a `{{ .ConfirmationURL }}` link instead of a code; without `{{ .Token }}` the modal has no code to verify.

**Password protection** (Authentication → Sign In / Providers → Email):
- **Prevent use of leaked passwords → ON.** Checks new passwords against HaveIBeenPwned (k-anonymity) and rejects breached ones. No code change — our signup/settings already surface the rejection message.
- **Secure password change / "Require current password when updating"** — optional, server-side enforcement. The Settings modal already verifies the current password client-side (re-auth before `updateUser`). If you enable the toggle, **smoke-test the change-password flow**: it relies on the fresh re-auth counting as recent; if `updateUser` errors with "reauthentication required", switch the modal to the official `supabase.auth.reauthenticate()` → nonce flow (an emailed code) instead of the current-password field.

## 4. Pre-prod hardening checklist

- [ ] Custom SMTP configured (above)
- [ ] Abuse protection on `coach-signup` (captcha/app-check) — see TODO in `supabase/config.toml`
- [ ] GitHub secrets set; first prod deploy CI run green
- [ ] Vercel prod env vars point at prod Supabase
- [ ] Auth Site URL / redirect URLs set for the prod domain
- [ ] Secure email change OFF + "Change Email Address" template includes `{{ .Token }}` (in-app code flow)
- [ ] Prevent use of leaked passwords ON; change-password flow smoke-tested if "secure password change" is on

## CI workflows

- `test.yml` — lint + build + test on PRs and dev/main (no secrets).
- `supabase-prod-deploy.yml` — migrations + functions → prod on merge to main (needs the 3 secrets above).
