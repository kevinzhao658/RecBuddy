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

In the **prod** project dashboard → Authentication:

- **URL Configuration** → Site URL = your Vercel prod domain; add it to Redirect URLs (so confirmation/reset links return to the app). Dev uses `http://localhost:5176`.
- **Email** → keep **Confirm email** ON (coach signup relies on it for email-ownership verification).
- **SMTP**: the built-in email sender is rate-limited and not for production. Configure **custom SMTP** (Resend / Postmark / SendGrid) under Auth → SMTP so confirmation/reset emails are reliable.

## 4. Pre-prod hardening checklist

- [ ] Custom SMTP configured (above)
- [ ] Abuse protection on `coach-signup` (captcha/app-check) — see TODO in `supabase/config.toml`
- [ ] GitHub secrets set; first prod deploy CI run green
- [ ] Vercel prod env vars point at prod Supabase
- [ ] Auth Site URL / redirect URLs set for the prod domain

## CI workflows

- `test.yml` — lint + build + test on PRs and dev/main (no secrets).
- `supabase-prod-deploy.yml` — migrations + functions → prod on merge to main (needs the 3 secrets above).
