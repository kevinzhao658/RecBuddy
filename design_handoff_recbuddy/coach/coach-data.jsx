// coach-data.jsx — coach-side roster + per-client week plans
// Exports to window: CLIENTS, WTYPE_LIST, blankWorkout

// Workout type options for the editor (order matters for chips)
const WTYPE_LIST = ['easy', 'long', 'speed', 'tempo', 'recovery', 'cross', 'rest'];

function blankWorkout(type = 'easy') {
  const titles = { easy: 'Easy Run', long: 'Long Run', speed: 'Intervals', tempo: 'Tempo Run',
    recovery: 'Recovery Jog', cross: 'Cross-Train', rest: 'Rest Day' };
  return { type, title: titles[type] || 'Workout',
    dist: type === 'rest' || type === 'cross' ? null : 4,
    pace: type === 'rest' || type === 'cross' ? null : '9:30/mi',
    sets: [], note: '' };
}

// a compact week = 7 day slots (Mon..Sun). w = workout | null
const D = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const dates = ['Jun 1', 'Jun 2', 'Jun 3', 'Jun 4', 'Jun 5', 'Jun 6', 'Jun 7'];
function day(i, w, status) { return { id: 'd' + i, dow: D[i], date: dates[i], w: w || null, status: status || (w ? 'planned' : 'rest') }; }
function W(type, title, o = {}) { return { type, title, dist: null, pace: null, sets: [], note: '', ...o }; }

// Assistant-coach pool — can be assigned to athletes for plan help + chat access
const ASSISTANTS = [
  { id: 'sam', name: 'Sam Okafor', initials: 'SO', role: 'Assistant coach' },
  { id: 'lena', name: 'Lena Park', initials: 'LP', role: 'Strength coach' },
  { id: 'diego', name: 'Diego Ruiz', initials: 'DR', role: 'Assistant coach' },
  { id: 'nadia', name: 'Nadia Von', initials: 'NV', role: 'Physio' },
];

const CLIENTS = [
  {
    id: 'jordan', name: 'Jordan Reyes', initials: 'JR', accent: '#46E07A', team: ['sam'],
    goal: 'Riverside Half Marathon', goalDate: 'Aug 23', goalTime: '1:48',
    planWeek: 5, planWeeks: 16, status: 'On track', level: 'Half Marathon',
    weekMiles: 30, lastSync: '2h ago',
    week: [
      day(0, W('easy', 'Easy Run', { dist: 4.5, pace: '9:40/mi', note: 'Loosen up for the week. Keep HR under 145.' }), 'done'),
      day(1, W('speed', '5 × 800m', { dist: 6.0, pace: '7:30/mi',
        sets: [['Warm-up', '1.5 mi easy + 4 strides'], ['5 × 800m', '@ 3:45 each, 400m jog recovery'], ['Cool-down', '1.0 mi easy']],
        note: 'Big session this week. Settle into 800 rhythm — the recoveries matter as much as the reps.' }), 'today'),
      day(2, W('easy', 'Easy Run', { dist: 5.0, pace: '9:45/mi', note: 'Recovery from intervals. Flat route, easy effort.' })),
      day(3, W('tempo', 'Tempo 4 mi', { dist: 6.0, pace: '8:20/mi',
        sets: [['Warm-up', '1 mi easy'], ['Tempo', '4 mi @ 8:20/mi'], ['Cool-down', '1 mi easy']],
        note: 'Stretching the tempo to 4 miles. Hold form when it gets uncomfortable.' })),
      day(4, null),
      day(5, W('long', 'Long Run 11 mi', { dist: 11.0, pace: '9:25/mi',
        sets: [['Steady', '8 mi @ 9:30/mi'], ['Finish', '3 mi @ goal pace 8:14/mi']],
        note: 'Longest run of the block so far. Fuel every 4 miles.' })),
      day(6, W('cross', 'Cross-Train 45 min', { note: 'Bike or swim, easy aerobic. Active recovery.' })),
    ],
  },
  {
    id: 'priya', name: 'Priya Nair', initials: 'PN', accent: '#3FD9C8', team: [],
    goal: 'First 10K', goalDate: 'Jul 12', goalTime: '55:00',
    planWeek: 7, planWeeks: 10, status: 'Crushing it', level: '10K',
    weekMiles: 18, lastSync: '5h ago',
    week: [
      day(0, W('rest', 'Rest Day'), 'rest'),
      day(1, W('easy', 'Easy Run', { dist: 3.0, pace: '10:30/mi', note: 'Nice and relaxed.' }), 'done'),
      day(2, W('speed', '6 × 400m', { dist: 3.5, pace: '8:40/mi',
        sets: [['Warm-up', '1 mi easy'], ['6 × 400m', '@ 5K effort, 200m walk'], ['Cool-down', '0.5 mi']],
        note: 'First real speed session — focus on form, not heroics.' }), 'today'),
      day(3, W('rest', 'Rest Day'), 'rest'),
      day(4, W('easy', 'Easy Run', { dist: 3.5, pace: '10:20/mi' })),
      day(5, W('long', 'Long Run 5 mi', { dist: 5.0, pace: '10:45/mi', note: 'Time on feet. Walk breaks are fine.' })),
      day(6, W('cross', 'Yoga / Mobility', { note: '30 min, focus on hips.' })),
    ],
  },
  {
    id: 'marcus', name: 'Marcus Bell', initials: 'MB', accent: '#F4C13D', team: ['lena'],
    goal: 'Chicago Marathon', goalDate: 'Oct 11', goalTime: '3:25',
    planWeek: 9, planWeeks: 18, status: 'Needs check-in', level: 'Marathon',
    weekMiles: 44, lastSync: '1d ago',
    week: [
      day(0, W('easy', 'Easy Run', { dist: 6.0, pace: '8:50/mi' }), 'done'),
      day(1, W('tempo', 'Tempo 6 mi', { dist: 9.0, pace: '7:40/mi',
        sets: [['Warm-up', '1.5 mi'], ['Tempo', '6 mi @ 7:40/mi'], ['Cool-down', '1.5 mi']],
        note: 'Marathon-effort work. This is the bread and butter.' }), 'missed'),
      day(2, W('easy', 'Easy Run', { dist: 6.0, pace: '8:50/mi' })),
      day(3, W('speed', '5 × 1km', { dist: 8.0, pace: '7:05/mi',
        sets: [['Warm-up', '2 mi'], ['5 × 1km', '@ 10K effort, 90s jog'], ['Cool-down', '1.5 mi']] })),
      day(4, W('rest', 'Rest Day'), 'rest'),
      day(5, W('long', 'Long Run 18 mi', { dist: 18.0, pace: '8:40/mi',
        note: 'Peak long run. Practice race fueling — gel every 35 min.' })),
      day(6, W('recovery', 'Recovery Jog', { dist: 4.0, pace: '9:30/mi' })),
    ],
  },
  {
    id: 'sofia', name: 'Sofia Lindqvist', initials: 'SL', accent: '#8FA0E0', team: [],
    goal: 'Sub-20 5K', goalDate: 'Sep 6', goalTime: '19:45',
    planWeek: 3, planWeeks: 12, status: 'On track', level: '5K',
    weekMiles: 26, lastSync: '30m ago',
    week: [
      day(0, W('easy', 'Easy Run', { dist: 4.0, pace: '8:10/mi' }), 'done'),
      day(1, W('speed', '8 × 200m', { dist: 4.5, pace: '6:10/mi',
        sets: [['Warm-up', '1.5 mi + drills'], ['8 × 200m', '@ mile effort, full recovery'], ['Cool-down', '1 mi']],
        note: 'Pure speed. Stay relaxed and fast — quality over quantity.' }), 'today'),
      day(2, W('easy', 'Easy Run', { dist: 4.0, pace: '8:15/mi' })),
      day(3, W('tempo', 'Tempo 3 mi', { dist: 5.0, pace: '6:55/mi' })),
      day(4, W('rest', 'Rest Day'), 'rest'),
      day(5, W('long', 'Long Run 8 mi', { dist: 8.0, pace: '8:05/mi' })),
      day(6, W('recovery', 'Recovery Jog', { dist: 3.0, pace: '9:00/mi' })),
    ],
  },
];

Object.assign(window, { CLIENTS, WTYPE_LIST, blankWorkout });

// ─────────────────────────────────────────────────────────────
// Workout Library — draggable preset templates the coach customizes
// (time helpers paceToSec / estMinutes / fmtDur live in app/core.jsx)
// ─────────────────────────────────────────────────────────────
const LIBRARY = [
  W('easy', 'Easy Run', { dist: 5, pace: '9:45/mi', note: 'Conversational pace — keep it relaxed and honest.' }),
  W('long', 'Long Run', { dist: 10, pace: '9:30/mi',
    sets: [['Steady', '8 mi @ 9:30/mi'], ['Finish', '2 mi @ goal pace']],
    note: 'Steady aerobic effort. Fuel every 4 miles.' }),
  W('speed', 'Intervals', { dist: 6, pace: '7:30/mi',
    sets: [['Warm-up', '1.5 mi easy + 4 strides'], ['5 × 800m', '@ 3:45, 400m jog recovery'], ['Cool-down', '1 mi easy']],
    note: 'Quality session — settle into rep rhythm.' }),
  W('tempo', 'Tempo Run', { dist: 5, pace: '8:20/mi',
    sets: [['Warm-up', '1 mi easy'], ['Tempo', '3 mi @ 8:20/mi'], ['Cool-down', '1 mi easy']],
    note: 'Comfortably hard and controlled.' }),
  W('recovery', 'Recovery Jog', { dist: 3, pace: '10:15/mi', note: 'Super easy shakeout. Walk if needed.' }),
  W('cross', 'Cross-Train', { dur: 45, note: 'Bike or swim, easy aerobic. Active recovery.' }),
  W('rest', 'Rest Day', {}),
];

Object.assign(window, { LIBRARY, ASSISTANTS });
