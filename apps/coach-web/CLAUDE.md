# Coach Web — Engineering Standards

The coach desktop app for RecBuddy. **Vite + React 18 + TypeScript (strict) + Tailwind v4**, server state via **TanStack Query**, backend is **Supabase** (Postgres + RLS + RPCs). These standards keep the app easy to work in and prevent cascading tech debt — follow them for all new code, and nudge existing code toward them when you touch it.

## Stack (non-negotiable)

- **TypeScript only.** Every file is `.ts`/`.tsx`; no `.js` in `src/`. Avoid `any` except at narrow, tested boundaries (e.g. `onError: (err: any)` from mutations).
- **Tailwind for all styling**, driven by tokens in `src/styles/theme.css` (`@theme` colors/fonts + `.rb-*` helper classes). No inline `style`, no CSS modules, no raw hex in components except one-off status tints.
- **Routing** React Router v6 · **Drag/drop** dnd-kit · **Tests** Vitest + React Testing Library.

## Layered architecture (one-way dependencies)

```
routes/        page screens (compose features; own page-level state)
   ↓
features/<domain>/   domain UI, grouped by feature (roster, plan-grid, editor, library, team)
   ↓
components/ui/       reusable presentational primitives (Button, Modal, Stepper, PaceField, NumberField…)

lib/           non-UI: supabase client, queries/, pure helpers, shared hooks, types
auth/          AuthProvider + route gating
styles/        theme.css (Tailwind tokens + helpers)
```

- `components/ui/` must **not** import from `features/` or `routes/`.
- `features/` must **not** import from `routes/`.
- Cross-feature sharing goes **down** into `components/ui/` or `lib/`, never sideways via deep imports.

## Data & state

- **Server state lives in TanStack Query.** Components never call `supabase` directly — always go through a hook in `lib/queries/*` (one file per table/domain). Mutations `invalidateQueries` their key on success.
- **The Supabase client is a singleton** (`lib/supabase.ts`). Don't construct clients elsewhere.
- **Local UI state only** (selection, view toggle, toast) uses `useState` in the owning screen. Anything reused or stateful becomes a **custom hook** (`useMe`, `useClipboard`, `useRealtimePlan`, `useAthleteDnd`).
- Pure logic (dates, formatting, estimates) goes in `lib/*.ts` as **pure, unit-tested functions** (`week.ts`, `estMinutes.ts`, `fmtDur.ts`).

## Component standards

- **Small & single-purpose.** Soft cap **~150 lines** per component. When a screen grows past it, extract a section component (e.g. `PlanToolbar`), a presentational piece (`DragGhost`), or a hook (`useAthleteDnd`) — see `CoachPage.tsx` as the worked example.
- **Reusable inputs are primitives.** Shared widgets live in `components/ui/` and are used everywhere — never re-implement them inline. The pace/distance fields share one `Stepper`; copy that pattern.
- **Accessibility = test anchor.** Every interactive control has an accessible name (`aria-label` or visible label). Tests target controls by role/label, so good a11y and good tests come together.

## Testing

- Co-locate tests as `*.test.tsx` / `*.test.ts` next to the unit. Every component with logic and every pure helper is tested.
- Mock query hooks (`vi.spyOn(mod, 'useX')`) rather than the network. Keep the suite green before every commit: `npm test && npm run build && npm run lint`.

## Backend touchpoints (see `/supabase`)

- RLS is enabled on **every** table; privileged operations are `SECURITY DEFINER` RPCs with `set search_path = public, pg_temp`. Never widen access from the client.
- Schema changes are migrations in `supabase/migrations/` (timestamped). The service-role key is server-only — never imported into this app.

## Commands

```
npm run dev      # vite dev server
npm test         # vitest
npm run build    # tsc + vite build
npm run lint     # eslint
```
