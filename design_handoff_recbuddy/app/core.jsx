// core.jsx — themes, mock training-plan data, helpers for RecBuddy
// Exports to window: THEMES, PLAN, GOAL, COACH, WEEKLY, PACE_TREND, HR_ZONES, PRS, ADHERENCE, fmt helpers

// ─────────────────────────────────────────────────────────────
// Workout type meta (label + glyph key). Colors come from theme.
// ─────────────────────────────────────────────────────────────
const WTYPES = {
  easy:     { label: 'Easy Run',   short: 'Easy' },
  long:     { label: 'Long Run',   short: 'Long' },
  speed:    { label: 'Intervals',  short: 'Speed' },
  tempo:    { label: 'Tempo',      short: 'Tempo' },
  recovery: { label: 'Recovery',   short: 'Recov' },
  cross:    { label: 'Cross-Train',short: 'Cross' },
  rest:     { label: 'Rest Day',   short: 'Rest' },
  race:     { label: 'Race',       short: 'Race' },
};

// Map a workout type -> {c: solid color, soft: tint bg} for a given theme
function typeColor(theme, type) {
  return theme.types[type] || theme.types.easy;
}

// ─────────────────────────────────────────────────────────────
// THEMES — 3 looks, all anchored on cream / forest green / gold
// ─────────────────────────────────────────────────────────────
const THEMES = {
  // A — Clinical: Apple-Health-like, light, soft, airy
  clinical: {
    id: 'clinical', name: 'Clinical', mode: 'light', dark: false,
    font: '-apple-system, "SF Pro Text", system-ui, sans-serif',
    display: '-apple-system, "SF Pro Display", system-ui, sans-serif',
    num: '-apple-system, "SF Pro Display", system-ui, sans-serif',
    numFeat: '"tnum" 1',
    bg: '#EFEEF3', surface: '#FFFFFF', surface2: '#F6F6F9',
    text: '#1B1B1F', textMute: 'rgba(40,40,46,0.55)', textFaint: 'rgba(40,40,46,0.32)',
    line: 'rgba(40,40,46,0.10)', hairline: 'rgba(40,40,46,0.07)',
    accent: '#177D45', accent2: '#B6810E', onAccent: '#FFFFFF',
    radius: 22, radiusSm: 14, cardShadow: '0 1px 2px rgba(20,20,30,0.04), 0 8px 22px rgba(20,20,30,0.05)',
    chip: 'rgba(40,40,46,0.05)',
    headerStyle: 'plain',
    types: {
      easy:     { c: '#177D45', soft: '#E6F2EA' },
      long:     { c: '#0E5C5A', soft: '#E0EFEE' },
      speed:    { c: '#C2410C', soft: '#FBEAE0' },
      tempo:    { c: '#B6810E', soft: '#F7EEDA' },
      recovery: { c: '#5B8C6A', soft: '#EAF1EC' },
      cross:    { c: '#4B5675', soft: '#EAECF2' },
      rest:     { c: '#9A9AA2', soft: '#F0F0F2' },
      race:     { c: '#B42318', soft: '#FBE9E7' },
    },
  },

  // B — Athletic: bold, high-contrast warm-dark, energetic, big numerals
  athletic: {
    id: 'athletic', name: 'Athletic', mode: 'dark', dark: true,
    font: '-apple-system, "SF Pro Text", system-ui, sans-serif',
    display: '"Saira Condensed", -apple-system, system-ui, sans-serif',
    num: '"Space Grotesk", -apple-system, system-ui, sans-serif',
    numFeat: '"tnum" 1',
    bg: '#0A0C08',
    surface: 'linear-gradient(157deg, #23271B 0%, #181B12 46%, #0E100A 100%)',
    surface2: 'linear-gradient(157deg, #262B1C 0%, #181C11 100%)',
    surfaceFlat: '#15170F',
    text: '#F3FBE8', textMute: 'rgba(243,251,232,0.56)', textFaint: 'rgba(243,251,232,0.30)',
    line: 'rgba(243,251,232,0.12)', hairline: 'rgba(243,251,232,0.07)',
    accent: '#ADFF2F', accent2: '#7CCB00', onAccent: '#0A0C08',
    metal: true,
    radius: 24, radiusSm: 14,
    cardShadow: 'inset 0 1px 0 rgba(243,251,232,0.16), inset 0 -1.5px 2px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(243,251,232,0.045), 0 1px 2px rgba(0,0,0,0.5), 0 16px 34px rgba(0,0,0,0.55)',
    chip: 'rgba(243,251,232,0.08)',
    headerStyle: 'bold',
    types: {
      easy:     { c: '#ADFF2F', soft: 'rgba(173,255,47,0.15)' },
      long:     { c: '#3FD9C8', soft: 'rgba(63,217,200,0.14)' },
      speed:    { c: '#FF7A45', soft: 'rgba(255,122,69,0.16)' },
      tempo:    { c: '#F4C13D', soft: 'rgba(244,193,61,0.15)' },
      recovery: { c: '#8FD8A6', soft: 'rgba(143,216,166,0.13)' },
      cross:    { c: '#8FA0E0', soft: 'rgba(143,160,224,0.14)' },
      rest:     { c: '#6E6A63', soft: 'rgba(243,251,232,0.06)' },
      race:     { c: '#FF5A52', soft: 'rgba(255,90,82,0.16)' },
    },
  },

  // C — Calm: warm cream, muted, editorial serif headers, lots of air
  calm: {
    id: 'calm', name: 'Calm', mode: 'light', dark: false,
    font: '-apple-system, "SF Pro Text", system-ui, sans-serif',
    display: '"Newsreader", Georgia, serif',
    num: '"Newsreader", Georgia, serif',
    numFeat: '"tnum" 1',
    bg: '#F6F1E8', surface: '#FFFDF8', surface2: '#F1EADC',
    text: '#322C22', textMute: 'rgba(50,44,34,0.52)', textFaint: 'rgba(50,44,34,0.30)',
    line: 'rgba(50,44,34,0.12)', hairline: 'rgba(50,44,34,0.07)',
    accent: '#3E6B47', accent2: '#9A7416', onAccent: '#FFFDF8',
    radius: 18, radiusSm: 12, cardShadow: '0 1px 2px rgba(80,60,20,0.04), 0 10px 26px rgba(80,60,20,0.06)',
    chip: 'rgba(50,44,34,0.05)',
    headerStyle: 'serif',
    types: {
      easy:     { c: '#3E6B47', soft: '#E8EFE7' },
      long:     { c: '#2E5E5B', soft: '#E3EDEB' },
      speed:    { c: '#A8531E', soft: '#F3E6DA' },
      tempo:    { c: '#9A7416', soft: '#F1E9D5' },
      recovery: { c: '#6C8A6F', soft: '#EAF0E8' },
      cross:    { c: '#5A6275', soft: '#E9EAEF' },
      rest:     { c: '#A39A88', soft: '#EFEADF' },
      race:     { c: '#A23A2E', soft: '#F3E2DD' },
    },
  },
};

// ─────────────────────────────────────────────────────────────
// Plan + meta. "Today" is Tue Jun 2, 2026.
// ─────────────────────────────────────────────────────────────
const TODAY = '2026-06-02';

const COACH = { name: 'Mara Whitlock', role: 'Head Coach', initials: 'MW' };
const ATHLETE = { name: 'Jordan', initials: 'J' };

const GOAL = {
  race: 'Riverside Half Marathon',
  date: '2026-08-23',
  distance: '13.1 mi',
  goalTime: '1:48:00',
  goalPace: '8:14/mi',
  weeksToGo: 12,
  planWeek: 5, planWeeks: 16,
};

// helper to assemble a workout
function W(type, title, o = {}) { return { type, title, ...o }; }

// PLAN keyed by ISO date. status: done | today | planned | missed | rest
const PLAN = {
  // ── Week of May 25 (completed) ──
  '2026-05-25': W('rest', 'Rest Day', { status: 'rest', note: 'Full rest — let the legs absorb last week. Hydrate well.' }),
  '2026-05-26': W('speed', '6 × 400m', { dist: 5.2, pace: '7:38/mi', status: 'done',
    sets: [ ['Warm-up', '1.5 mi easy @ 9:40/mi'], ['6 × 400m', '@ 5K effort, 200m jog recovery'], ['Cool-down', '1.0 mi easy'] ],
    note: 'Smooth and controlled — don\u2019t blow the first rep. Aim for even splits.',
    actual: { dist: 5.4, pace: '7:42/mi', hr: 159, time: '41:36', feel: 4 } }),
  '2026-05-27': W('easy', 'Easy Run', { dist: 4.0, pace: '9:45/mi', status: 'missed',
    note: 'Conversational pace. Keep it honest — easy means easy.' }),
  '2026-05-28': W('tempo', 'Tempo 3 mi', { dist: 5.0, pace: '8:25/mi', status: 'done',
    sets: [ ['Warm-up', '1 mi easy'], ['Tempo', '3 mi @ 8:25/mi (comfortably hard)'], ['Cool-down', '1 mi easy'] ],
    note: 'Lock into rhythm. This is your half-marathon engine work.',
    actual: { dist: 5.0, pace: '8:21/mi', hr: 168, time: '41:45', feel: 3 } }),
  '2026-05-29': W('rest', 'Rest Day', { status: 'rest' }),
  '2026-05-30': W('long', 'Long Run 9 mi', { dist: 9.0, pace: '9:30/mi', status: 'done',
    sets: [ ['Steady', '7 mi @ 9:35/mi'], ['Finish', '2 mi @ goal pace 8:14/mi'] ],
    note: 'Negative-split it. Fuel at mile 5. Last two should feel strong, not desperate.',
    actual: { dist: 9.1, pace: '9:22/mi', hr: 152, time: '1:25:14', feel: 4 } }),
  '2026-05-31': W('recovery', 'Recovery Jog', { dist: 3.0, pace: '10:15/mi', status: 'done',
    note: 'Shake out the long run. Super easy, walk if you need to.',
    actual: { dist: 3.0, pace: '10:08/mi', hr: 138, time: '30:24', feel: 5 } }),

  // ── Week of Jun 1 — current week ──
  '2026-06-01': W('easy', 'Easy Run', { dist: 4.5, pace: '9:40/mi', status: 'done',
    note: 'Loosen up for the week. Keep HR under 145.',
    actual: { dist: 4.6, pace: '9:36/mi', hr: 141, time: '44:09', feel: 4 } }),
  '2026-06-02': W('speed', '5 × 800m', { dist: 6.0, pace: '7:30/mi', status: 'today',
    sets: [ ['Warm-up', '1.5 mi easy + 4 strides'], ['5 × 800m', '@ 3:45 each, 400m jog recovery'], ['Cool-down', '1.0 mi easy'] ],
    note: 'Big session this week. Settle into 800 rhythm — the recoveries matter as much as the reps. Text me how rep 4 feels.' }),
  '2026-06-03': W('easy', 'Easy Run', { dist: 5.0, pace: '9:45/mi', status: 'planned',
    note: 'Recovery from intervals. Flat route, easy effort.' }),
  '2026-06-04': W('tempo', 'Tempo 4 mi', { dist: 6.0, pace: '8:20/mi', status: 'planned',
    sets: [ ['Warm-up', '1 mi easy'], ['Tempo', '4 mi @ 8:20/mi'], ['Cool-down', '1 mi easy'] ],
    note: 'Stretching the tempo to 4 miles. Hold form when it gets uncomfortable around mile 3.' }),
  '2026-06-05': W('rest', 'Rest Day', { status: 'planned' }),
  '2026-06-06': W('long', 'Long Run 11 mi', { dist: 11.0, pace: '9:25/mi', status: 'planned',
    sets: [ ['Steady', '8 mi @ 9:30/mi'], ['Finish', '3 mi @ goal pace 8:14/mi'] ],
    note: 'Longest run of the block so far. Fuel every 4 miles. This builds the confidence for race day.' }),
  '2026-06-07': W('cross', 'Cross-Train 45 min', { status: 'planned',
    note: 'Bike or swim, easy aerobic. Active recovery, not a workout.' }),

  // ── Week of Jun 8 ──
  '2026-06-08': W('rest', 'Rest Day', { status: 'planned' }),
  '2026-06-09': W('speed', '4 × 1 km', { dist: 6.5, pace: '7:25/mi', status: 'planned',
    sets: [ ['Warm-up', '1.5 mi easy'], ['4 × 1km', '@ 10K effort, 90s jog'], ['Cool-down', '1 mi easy'] ],
    note: 'Longer reps, slightly slower than last week. Threshold development.' }),
  '2026-06-10': W('easy', 'Easy Run', { dist: 5.0, pace: '9:45/mi', status: 'planned' }),
  '2026-06-11': W('tempo', 'Tempo 4 mi', { dist: 6.0, pace: '8:18/mi', status: 'planned',
    note: 'Same as last week, a touch faster. You\u2019ve got this.' }),
  '2026-06-12': W('rest', 'Rest Day', { status: 'planned' }),
  '2026-06-13': W('long', 'Long Run 12 mi', { dist: 12.0, pace: '9:20/mi', status: 'planned',
    note: 'Peak-ish long run. Practice your race-morning breakfast.' }),
  '2026-06-14': W('recovery', 'Recovery Jog', { dist: 3.5, pace: '10:15/mi', status: 'planned' }),
};

// ─────────────────────────────────────────────────────────────
// Metrics data
// ─────────────────────────────────────────────────────────────
// Weekly mileage — last 8 weeks (most recent last). planned vs done.
const WEEKLY = [
  { label: 'Apr 13', done: 18.2, planned: 18 },
  { label: 'Apr 20', done: 21.0, planned: 21 },
  { label: 'Apr 27', done: 19.4, planned: 23 },
  { label: 'May 4',  done: 24.1, planned: 24 },
  { label: 'May 11', done: 26.5, planned: 26 },
  { label: 'May 18', done: 22.0, planned: 28 },
  { label: 'May 25', done: 26.9, planned: 27 },
  { label: 'Jun 1',  done: 9.2,  planned: 30, partial: true },
];

// Pace trend — avg easy-run pace (sec/mi) over recent runs, lower = faster
const PACE_TREND = [
  { d: 'May 4',  sec: 600 }, { d: 'May 11', sec: 592 }, { d: 'May 15', sec: 588 },
  { d: 'May 20', sec: 583 }, { d: 'May 24', sec: 580 }, { d: 'May 27', sec: 576 },
  { d: 'May 31', sec: 608 }, { d: 'Jun 1',  sec: 576 },
];

// HR zones — % of time over last 7 days
const HR_ZONES = [
  { z: 'Z1', label: 'Recovery', pct: 14, bpm: '< 132' },
  { z: 'Z2', label: 'Aerobic',  pct: 48, bpm: '132\u2013149' },
  { z: 'Z3', label: 'Tempo',    pct: 22, bpm: '150\u2013163' },
  { z: 'Z4', label: 'Threshold',pct: 13, bpm: '164\u2013177' },
  { z: 'Z5', label: 'VO2 Max',  pct: 3,  bpm: '178+' },
];

const PRS = [
  { dist: '1 mile', time: '6:42', when: 'May 26', fresh: true },
  { dist: '5K', time: '23:18', when: 'Apr 19' },
  { dist: '10K', time: '49:05', when: 'Mar 30' },
  { dist: 'Half', time: '1:52:40', when: 'Oct \u201925' },
];

const ADHERENCE = {
  pct: 92, completed: 23, planned: 25, streak: 6, // workouts done in a row
};

// ─────────────────────────────────────────────────────────────
// Date helpers
// ─────────────────────────────────────────────────────────────
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MON_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DOW1 = ['S','M','T','W','T','F','S'];

function iso(y, m, d) { return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }
function parseISO(s) { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); }
function fmtLong(s) { const dt = parseISO(s); return `${DOW[dt.getDay()]}, ${MON_SHORT[dt.getMonth()]} ${dt.getDate()}`; }

// ─────────────────────────────────────────────────────────────
// Estimated-time helpers (shared client + coach)
// Per-workout est. time: explicit w.est (min) overrides; else dist×pace; else dur.
// ─────────────────────────────────────────────────────────────
function paceToSec(pace) {
  if (!pace) return 0;
  const p = pace.split('/')[0].split(':').map(Number);
  return (p[0] || 0) * 60 + (p[1] || 0);
}
function estMinutes(w) {
  if (!w || w.type === 'rest') return 0;
  if (w.est != null && w.est !== '') return Number(w.est) || 0;
  if (w.dist && w.pace) return Math.round((w.dist * paceToSec(w.pace)) / 60);
  if (w.dur) return w.dur;
  if (w.type === 'cross') return 45;
  return 0;
}
function fmtDur(min) {
  if (!min) return '0m';
  const h = Math.floor(min / 60), m = min % 60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

Object.assign(window, {
  WTYPES, typeColor, THEMES, PLAN, GOAL, COACH, ATHLETE, TODAY,
  WEEKLY, PACE_TREND, HR_ZONES, PRS, ADHERENCE,
  MONTHS, MON_SHORT, DOW, DOW1, iso, parseISO, fmtLong,
  paceToSec, estMinutes, fmtDur,
});
