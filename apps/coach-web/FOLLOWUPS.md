# Coach Web — known follow-ups (post-MVP)

Non-blocking items deferred from the B build, with rationale:

- **Transactional move RPC.** `moveWorkout` does a 3-step swap via a temp date (`1900-01-01`);
  a crash mid-swap could strand a workout on the sentinel date. Replace with a single
  `SECURITY DEFINER` Postgres function (or a deferrable unique constraint) for atomicity.
- **Generate Supabase DB types.** `supabase gen types typescript` would remove the `as any` /
  `as unknown as` casts on nested-select responses (currently `no-explicit-any` is a warning).
- **Keyboard-drag a11y.** The grid uses PointerSensor only; add a KeyboardSensor for
  keyboard-accessible drag-move. Copy/paste already provide a keyboard path.
- **Clickable-div a11y.** DayCard is a clickable `<div>`; add role/tabIndex/keydown.
- **Login/Signup fetch hardening.** Wrap the network calls in try/catch so a non-JSON/transport
  error surfaces a friendly message instead of an unhandled rejection.
- **Modal focus-trap/Escape.** The generic Modal has no focus trap or Escape-to-close.
- **Search debounce.** The team popover searches on every keystroke; debounce it.
