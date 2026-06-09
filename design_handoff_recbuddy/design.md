# RecBuddy — Design System

**Direction:** Volt Lime (N1) · Athletic
**Surfaces:** RecBuddy (athlete app, iOS) · RecBuddy Coach (desktop plan-builder)
**Status:** v1 — living document. Tokens below are the live values in `app/core.jsx` → `THEMES.athletic`.

---

## 1. Brand personality

RecBuddy is a coach-to-athlete training platform. The brand should feel **fast, focused, and energetic** without being loud or cluttered.

| We are | We are not |
|---|---|
| Fast, athletic, hi-vis | Corporate, clinical, soft |
| Confident, direct | Gimmicky, emoji-heavy |
| Dark + one electric accent | Rainbow, multi-accent |
| Data you can trust at a glance | Dense, decorative dashboards |

**One-line:** *Night-run energy — near-black canvas, one volt-lime accent, condensed type that leans forward.*

---

## 2. Logo & wordmark

The brand is **wordmark-only** — there is no icon mark.

- **Wordmark:** `RecBuddy`, set in **Saira Condensed, 800, italic**, letter-spacing `-0.8px`.
- **Two-tone:** `Rec` in **Volt Lime** (`#ADFF2F`), `Buddy` in **text** (`#F3FBE8`).
- **Lockup label** (optional): `COACH` / `ATHLETE` below, SF Pro 700, 10.5px, letter-spacing `2.4px`, in `textMute`.

```
Rec Buddy        ← Rec = #ADFF2F, Buddy = #F3FBE8
COACH            ← uppercase, tracked, muted
```

**Rules**
- Always italic. Never upright, never un-skewed.
- Minimum size 18px cap height. Below that, keep `Rec`/`Buddy` two-tone — do not collapse to one color.
- Clear space = cap height on all sides.
- On lime backgrounds, set the entire wordmark in `onAccent` (`#0A0C08`); drop the two-tone.
- Do **not** reintroduce an icon/avatar mark alongside it.

---

## 3. Color

### Core palette

| Token | Hex | Use |
|---|---|---|
| `accent` | `#ADFF2F` | Primary actions, brand, completed state, active nav |
| `accent2` | `#7CCB00` | Deep-lime secondary (pressed, gradients, coach avatar) |
| `onAccent` | `#0A0C08` | Text/icons on top of lime fills |
| `bg` | `#0A0C08` | App background (near-black, faint lime cast) |
| `surface` | `#15170F` | Cards, sheets, sidebars |
| `surface2` | `#1E2114` | Inset fields, secondary tiles, segmented tracks |
| `text` | `#F3FBE8` | Primary text, today indicator |
| `textMute` | `rgba(243,251,232,0.56)` | Secondary text, labels |
| `textFaint` | `rgba(243,251,232,0.30)` | Tertiary text, planned-state dots |
| `line` | `rgba(243,251,232,0.12)` | Borders, dividers |
| `hairline` | `rgba(243,251,232,0.07)` | Subtle internal separators |
| `chip` | `rgba(243,251,232,0.08)` | Neutral pill/chip backgrounds |

### Semantic — workout completion (the only status colors)

| State | Color | Token |
|---|---|---|
| Planned | gray | `textFaint` dot / `surface` card |
| Completed | **lime** | `accent` + `easy.soft` tint `rgba(173,255,47,0.15)` |
| Missed | **red** | `#FF5A52` + tint `rgba(255,90,82,0.16)` |
| Today | **bright neutral** | `text` ring + `text`/`bg` "TODAY" pill |

**Critical rule:** color encodes **completion status only**. Workout *type* is never colored — it is a neutral icon (see §6). Do not invent new accent hues; the system is intentionally mono-accent + red for misses.

### Usage ratios
- ~80% near-black surfaces, ~15% text, ~5% lime. Lime is a spark, not a fill — reserve it for the single most important action/affordance per view.
- Never place lime text on `surface` smaller than 14px without weight 600+ (contrast).
- `onAccent` (#0A0C08) is the only text color allowed on lime.

---

## 4. Typography

| Role | Family | Weight / style | Notes |
|---|---|---|---|
| Display / headings | **Saira Condensed** | 700–800 | Condensed, athletic. Upright for headings. |
| Wordmark / hero | **Saira Condensed** | 800 **italic** | Forward lean = speed. |
| Body / UI | **SF Pro Text** / system | 400–600 | Legibility for dense UI & long text. |
| Numerals / data | **Space Grotesk** | 700 | `font-feature-settings: "tnum" 1` for aligned stats. |

### Scale (px)

| Token | Size | Family | Use |
|---|---|---|---|
| hero | 46–62 | Saira Cond. Italic | Wordmark, splash numbers |
| h1 | 29–34 | Saira Condensed 700 | Screen titles ("Your Plan") |
| h2 | 18–27 | Saira Condensed 700 | Sheet / section titles |
| h3 | 16 | Saira Condensed 700 | Card titles |
| body | 14–15 | SF Pro | Paragraphs, messages |
| label | 11–12 | SF Pro 700 | UPPERCASE, letter-spacing 0.5–2.4px, `textMute` |
| stat | 17–32 | Space Grotesk 700 | Distances, paces, times |

**Rules**
- Headings: upright Saira Condensed. Italic is reserved for the wordmark.
- Labels/eyebrows: uppercase + tracked, in `textMute` or `accent`.
- Minimum body size 14px; minimum touch label 11px.
- Numbers that align in columns/calendars must use `tnum`.

---

## 5. Spacing & layout

Base-4 scale: **4 · 8 · 12 · 16 · 20 · 24 · 32 · 40**.

- Card padding: 13–18px (mobile), 16–22px (desktop).
- Screen gutters: 16px (mobile), 28px (desktop).
- Gaps between sibling cards: 9–14px.
- Use `flex`/`grid` with `gap` for any group of siblings — never margin-chains or inline whitespace.
- iOS hit targets ≥ 44px.

---

## 6. Iconography

- **Line icons**, 1.9–2.2px stroke, rounded caps/joins, `currentColor`.
- **Workout-type icons are neutral** (`textMute`), small, and tucked in a corner — never colored, never labeled on cards. Decode them via a **legend** (icon → name) + **status key** (color → state).

| Type | Glyph |
|---|---|
| Easy | run |
| Long | mountain |
| Intervals | bolt |
| Tempo | stopwatch |
| Recovery | heart |
| Cross-train | cross |
| Rest | rest/zzz |

- Sync/provider, trophy (goal), flame (streak), chevrons, plus, send, camera, route — all neutral stroke unless they represent the single primary action (then `accent`).

---

## 7. Radii, borders, elevation

| Token | Value | Use |
|---|---|---|
| `radius` | 24px | Large cards, sheets |
| `radiusSm` | 14px | Compact cards, tiles |
| input | 10–12px | Fields, segmented |
| chip / pill | 20px | Chips, status pills |
| `line` border | 1px `rgba(243,251,232,0.12)` | Card outlines |
| `cardShadow` | `0 2px 8px rgba(0,0,0,0.45), 0 14px 30px rgba(0,0,0,0.4)` | Card elevation |
| accent glow | `0 0 22px rgba(173,255,47,0.45)` | Primary buttons only (optional, sparing) |

Selection/today ring: `0 0 0 2px var(--text)` (today) or `0 0 0 3px rgba(243,251,232,0.22)` (selected) — neutral, never lime.

---

## 8. Components

**Primary button** — lime fill, `onAccent` text, Saira Condensed italic uppercase optional, radius 9–16px, optional accent glow. One per view.

**Secondary / ghost** — transparent, 1px `line` border, `text` label.

**Card** — `surface`, 1px `line` (or transparent), `radius`, `cardShadow`. Completion tint (lime/red) only when reflecting status.

**Chip / pill** — `chip` bg, `textMute` or `accent` text, radius 20px. Status pills follow the completion colors.

**Input / textarea** — `surface2` bg, 1px `line`, radius 10px; focus border = `accent`.

**Segmented control** — `surface2` track, active thumb = `surface` with shadow, active label `text`.

**Tab bar** — solid `surface`, top hairline. Active = lime icon+label in a lime-tint pill; inactive = `textFaint`. Always solid (no translucency that can drop out).

**Bottom sheet** — `bg`, top radius 30px, grabber, mounts at rest position (visible end-state) and animates *from* a small offset so it never gets stuck off-screen if motion is disabled.

**Workout card (plan)** — gray by default; lime tint+border when completed, red when missed. Neutral type icon top-right. Status row at the bottom (dot/check + label). Today gets the bright ring + TODAY pill.

---

## 9. Motion

- Transitions 0.18–0.34s, `cubic-bezier(.32,.72,0,1)` for sheet/slide.
- Animate **from** hidden to a visible end-state; the resting style is the visible one (so print / reduced-motion / frozen-anim environments still show content).
- No infinite decorative loops on content. Typing-dots and progress rings excepted.
- Hover (desktop): border brightens to `rgba(243,251,232,0.22)`.

---

## 10. Voice & tone

- **Coach-to-athlete, encouraging, concise.** "Settle into rep rhythm." not "Commence interval protocol."
- Sentence case in UI. UPPERCASE only for tracked eyebrow labels.
- Numbers do the talking — surface pace, distance, time, adherence; avoid decorative stats.
- Emoji: sparingly, only inside coach/athlete *messages* — never in chrome, labels, or buttons.

---

## 11. Do / Don't

✅ One lime accent per view · neutral type icons + legend · completion = lime/red/gray · condensed headings · solid tab bar
🚫 Multiple accent hues · coloring workouts by type · lime body text · italic headings (italic = wordmark only) · reintroducing an icon/avatar logo mark · gradient-heavy backgrounds · emoji in UI chrome
