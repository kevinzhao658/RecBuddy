// chat.jsx — athlete messaging: iOS-style conversation list (search) + 1:1 threads
// Exports to window: ChatView

const CONVERSATIONS = [
  {
    id: 'mara', coach: { name: 'Mara Whitlock', initials: 'MW', role: 'Head Coach' }, time: '12:20 PM', unread: false,
    messages: [
      { kind: 'day', text: 'Saturday, May 30' },
      { from: 'coach', kind: 'text', text: 'Morning! Big long run today — 9 miles, last 2 at goal pace. Fuel around mile 5 🥤', t: '7:42 AM' },
      { from: 'me', kind: 'runcard', t: '9:18 AM', run: { title: 'Long Run 9 mi', dist: '9.1 mi', pace: '9:22/mi', time: '1:25:14', hr: 152 } },
      { from: 'me', kind: 'text', text: 'Felt great honestly — negative split it like you said. Legs had more at the end.', t: '9:19 AM' },
      { from: 'coach', kind: 'text', text: 'That\u2019s exactly what I want to see. Your aerobic base is really coming together 💪', t: '10:05 AM' },
      { kind: 'day', text: 'Monday, June 1' },
      { from: 'coach', kind: 'text', text: 'Quick heads up — I bumped Tuesday\u2019s session. We\u2019re doing 800s instead of 400s this week to build strength at threshold.', t: '8:30 AM' },
      { from: 'coach', kind: 'adjust', t: '8:30 AM', adjust: { from: '6 × 400m', to: '5 × 800m @ 3:45', reason: 'Stronger threshold stimulus' } },
      { from: 'me', kind: 'text', text: 'Got it. The 800s always feel brutal but I know they work 😅', t: '12:14 PM' },
      { from: 'coach', kind: 'text', text: 'They\u2019re the secret sauce. Settle into rep rhythm and don\u2019t rush the recoveries. Text me how rep 4 feels tomorrow!', t: '12:20 PM' },
    ],
  },
  {
    id: 'sam', coach: { name: 'Sam Okafor', initials: 'SO', role: 'Assistant Coach' }, time: 'Yesterday', unread: true,
    messages: [
      { kind: 'day', text: 'Yesterday' },
      { from: 'coach', kind: 'text', text: 'Hey! Mara\u2019s got me helping with your strength work this block. Sending over a short routine.', t: '4:02 PM' },
      { from: 'coach', kind: 'text', text: '2 × 12 single-leg squats, calf raises, and hip bridges — twice a week after your easy runs.', t: '4:03 PM' },
      { from: 'me', kind: 'text', text: 'Perfect, my left calf has been a little tight so that timing helps.', t: '5:20 PM' },
      { from: 'coach', kind: 'text', text: 'Keep an eye on it. Roll it out and let me know if the tightness sticks around past a couple days.', t: '5:24 PM' },
    ],
  },
  {
    id: 'nadia', coach: { name: 'Nadia Von', initials: 'NV', role: 'Physio' }, time: 'Mon', unread: false,
    messages: [
      { kind: 'day', text: 'Monday' },
      { from: 'coach', kind: 'text', text: 'Following up on that calf niggle — how\u2019s it feeling after the long run?', t: '9:15 AM' },
      { from: 'me', kind: 'text', text: 'Much better! The mobility work is helping a lot. No pain on the 9-miler.', t: '11:40 AM' },
      { from: 'coach', kind: 'text', text: 'Great news. Keep up the eccentric calf raises and we\u2019ll keep it happy through the build.', t: '12:02 PM' },
    ],
  },
];

function lastText(msgs) { for (let i = msgs.length - 1; i >= 0; i--) { const m = msgs[i]; if (m.text && m.kind !== 'day') return m.text; if (m.kind === 'runcard') return 'Shared a run'; } return ''; }

function ChatView({ theme }) {
  const { Icon } = window;
  const [convos, setConvos] = React.useState(() => JSON.parse(JSON.stringify(CONVERSATIONS)));
  const [activeId, setActiveId] = React.useState(null);
  const [query, setQuery] = React.useState('');

  const active = convos.find(c => c.id === activeId) || null;

  const sendTo = (id, text) => {
    const now = new Date();
    const stamp = `${((now.getHours() + 11) % 12) + 1}:${String(now.getMinutes()).padStart(2, '0')} ${now.getHours() < 12 ? 'AM' : 'PM'}`;
    setConvos(cs => cs.map(c => c.id === id ? { ...c, time: stamp, messages: [...c.messages, { from: 'me', kind: 'text', text, t: stamp }] } : c));
    setTimeout(() => {
      setConvos(cs => cs.map(c => c.id === id ? { ...c, messages: [...c.messages, { from: 'coach', kind: 'typing' }] } : c));
      setTimeout(() => setConvos(cs => cs.map(c => c.id === id
        ? { ...c, messages: c.messages.filter(m => m.kind !== 'typing').concat({ from: 'coach', kind: 'text', t: stamp, text: 'Got it — thanks for the update! Keep it up. 👊' }) } : c)), 1400);
    }, 500);
  };

  if (active) return <Thread theme={theme} convo={active} onBack={() => setActiveId(null)} onSend={(t) => sendTo(active.id, t)} />;
  return <ConversationList theme={theme} convos={convos} query={query} setQuery={setQuery} onOpen={setActiveId} />;
}

// ─────────────────────────────────────────────────────────────
// iOS-style conversation list with search
// ─────────────────────────────────────────────────────────────
function ConversationList({ theme, convos, query, setQuery, onOpen }) {
  const { Icon } = window;
  const avBg = theme.dark ? 'rgba(243,251,232,0.13)' : 'rgba(40,40,46,0.10)';
  const q = query.trim().toLowerCase();

  // build rows; when searching, match on name or message text and surface a snippet
  const rows = convos.map(c => {
    const nameMatch = c.coach.name.toLowerCase().includes(q);
    const msgMatch = q ? c.messages.find(m => m.text && m.kind !== 'day' && m.text.toLowerCase().includes(q)) : null;
    return { c, show: !q || nameMatch || !!msgMatch, snippet: msgMatch ? msgMatch.text : lastText(c.messages) };
  }).filter(r => r.show);

  const highlight = (text) => {
    if (!q) return text;
    const idx = text.toLowerCase().indexOf(q);
    if (idx < 0) return text;
    return (<>{text.slice(0, idx)}<span style={{ color: theme.accent, fontWeight: 700 }}>{text.slice(idx, idx + q.length)}</span>{text.slice(idx + q.length)}</>);
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: theme.bg }}>
      {/* header */}
      <div style={{ flexShrink: 0, padding: '54px 18px 6px' }}>
        <h1 style={{ margin: 0, fontFamily: theme.display, fontSize: 30, fontWeight: 700, letterSpacing: -0.5, color: theme.text }}>Messages</h1>
        {/* search field */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, background: theme.surface2,
          border: `1px solid ${theme.line}`, borderRadius: 12, padding: '9px 12px' }}>
          <Icon name="search" size={17} stroke={2} color={theme.textFaint} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search messages"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: theme.font, fontSize: 15, color: theme.text }} />
          {query && <button onClick={() => setQuery('')} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: theme.textFaint, padding: 0, display: 'flex' }}><Icon name="cross" size={17} stroke={2} /></button>}
        </div>
      </div>

      {/* rows */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px 18px' }}>
        {q && <div style={{ fontFamily: theme.font, fontSize: 11.5, fontWeight: 700, color: theme.textFaint, textTransform: 'uppercase', letterSpacing: 0.6, padding: '6px 10px 8px' }}>
          {rows.length ? 'Results' : ''}
        </div>}
        {rows.map(({ c, snippet }) => (
          <button key={c.id} onClick={() => onOpen(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 13, width: '100%',
            padding: '11px 10px', borderRadius: 14, border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{ width: 50, height: 50, borderRadius: 50, background: avBg, color: theme.text,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.font, fontWeight: 700, fontSize: 17 }}>{c.coach.initials}</div>
              {c.unread && <span style={{ position: 'absolute', top: 0, left: -2, width: 10, height: 10, borderRadius: 10, background: theme.accent, border: `2px solid ${theme.bg}` }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ flex: 1, minWidth: 0, fontFamily: theme.font, fontSize: 16, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.coach.name}</span>
                <span style={{ fontFamily: theme.font, fontSize: 12, color: theme.textFaint, flexShrink: 0 }}>{c.time}</span>
                <Icon name="chevron" size={15} stroke={2.4} color={theme.textFaint} style={{ flexShrink: 0 }} />
              </div>
              <div style={{ fontFamily: theme.font, fontSize: 12, color: theme.accent, fontWeight: 600, marginTop: 1 }}>{c.coach.role}</div>
              <div style={{ fontFamily: theme.font, fontSize: 13.5, color: theme.textMute, marginTop: 2, lineHeight: 1.35,
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{highlight(snippet)}</div>
            </div>
          </button>
        ))}
        {q && rows.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', fontFamily: theme.font, fontSize: 14, color: theme.textFaint }}>
            No messages found for “{query}”
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Thread
// ─────────────────────────────────────────────────────────────
function Thread({ theme, convo, onBack, onSend }) {
  const { Icon } = window;
  const [draft, setDraft] = React.useState('');
  const scrollRef = React.useRef(null);
  const avBg = theme.dark ? 'rgba(243,251,232,0.13)' : 'rgba(40,40,46,0.10)';

  React.useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [convo.messages.length]);

  const send = (text) => { const t = (text != null ? text : draft).trim(); if (!t) return; setDraft(''); onSend(t); };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: theme.bg }}>
      {/* header */}
      <div style={{ flexShrink: 0, paddingTop: 50, background: theme.dark ? 'rgba(20,22,15,0.9)' : 'rgba(255,255,255,0.9)',
        backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)', borderBottom: `0.5px solid ${theme.line}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px 12px' }}>
          <button onClick={onBack} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: theme.accent,
            display: 'flex', alignItems: 'center', padding: 4, flexShrink: 0 }}>
            <Icon name="back" size={26} stroke={2.4} color={theme.accent} />
          </button>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ width: 38, height: 38, borderRadius: 38, background: avBg, color: theme.text,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.font, fontWeight: 700, fontSize: 14 }}>{convo.coach.initials}</div>
            <span style={{ position: 'absolute', bottom: 0, right: 0, width: 11, height: 11, borderRadius: 11, background: '#34C759', border: `2px solid ${theme.bg}` }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: theme.display, fontSize: 17, fontWeight: 700, color: theme.text, letterSpacing: -0.2, lineHeight: 1.1 }}>{convo.coach.name}</div>
            <div style={{ fontFamily: theme.font, fontSize: 12, color: theme.accent, fontWeight: 500 }}>{convo.coach.role} · Active now</div>
          </div>
        </div>
      </div>

      {/* messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {convo.messages.map((m, i) => <Bubble key={i} theme={theme} m={m} />)}
      </div>

      {/* composer */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 9, padding: '6px 14px 30px',
        background: theme.dark ? 'rgba(20,22,15,0.85)' : 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderTop: `0.5px solid ${theme.line}` }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: theme.surface, border: `1px solid ${theme.line}`, borderRadius: 21, padding: '4px 4px 4px 14px' }}>
          <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') send(); }}
            placeholder={`Message ${convo.coach.name.split(' ')[0]}…`} style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: theme.font, fontSize: 15, color: theme.text, padding: '6px 0' }} />
          <button onClick={() => send()} disabled={!draft.trim()} style={{ width: 32, height: 32, borderRadius: 32, flexShrink: 0, border: 'none',
            cursor: draft.trim() ? 'pointer' : 'default', opacity: draft.trim() ? 1 : 0.4, background: theme.accent, color: theme.onAccent,
            display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'opacity .2s' }}>
            <Icon name="send" size={17} stroke={2} fill="currentColor" color={theme.onAccent} style={{ marginLeft: -1 }} />
          </button>
        </div>
      </div>
    </div>
  );
}

function Bubble({ theme, m }) {
  const { Icon } = window;
  if (m.kind === 'day') {
    return <div style={{ textAlign: 'center', fontFamily: theme.font, fontSize: 11.5, fontWeight: 600, color: theme.textFaint, padding: '8px 0 4px' }}>{m.text}</div>;
  }
  const mine = m.from === 'me';

  if (m.kind === 'typing') {
    return (
      <div style={{ alignSelf: 'flex-start', background: theme.surface, borderRadius: 18, borderBottomLeftRadius: 5,
        padding: '12px 16px', display: 'flex', gap: 4, boxShadow: theme.cardShadow }}>
        {[0, 1, 2].map(i => <span key={i} style={{ width: 7, height: 7, borderRadius: 7, background: theme.textFaint, animation: `rbdot 1.2s ${i * 0.18}s infinite ease-in-out` }} />)}
      </div>
    );
  }

  if (m.kind === 'adjust') {
    const a = m.adjust;
    return (
      <div style={{ alignSelf: 'flex-start', maxWidth: '88%', width: '88%', background: theme.surface,
        borderRadius: 18, borderBottomLeftRadius: 5, padding: 14, boxShadow: theme.cardShadow, border: `1px solid ${theme.accent2}40` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
          <Icon name="edit" size={15} stroke={2} color={theme.accent2} />
          <span style={{ fontFamily: theme.font, fontSize: 12, fontWeight: 700, color: theme.accent2, textTransform: 'uppercase', letterSpacing: 0.5 }}>Plan adjusted · Tue Jun 2</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, textAlign: 'center', padding: '9px 6px', borderRadius: 11, background: theme.chip }}>
            <div style={{ fontFamily: theme.font, fontSize: 10, color: theme.textFaint, textTransform: 'uppercase', fontWeight: 600 }}>Was</div>
            <div style={{ fontFamily: theme.font, fontSize: 13, fontWeight: 650, color: theme.textMute, textDecoration: 'line-through' }}>{a.from}</div>
          </div>
          <Icon name="chevron" size={16} stroke={2.4} color={theme.textFaint} />
          <div style={{ flex: 1, textAlign: 'center', padding: '9px 6px', borderRadius: 11, background: theme.accent2 + '1f' }}>
            <div style={{ fontFamily: theme.font, fontSize: 10, color: theme.accent2, textTransform: 'uppercase', fontWeight: 700 }}>Now</div>
            <div style={{ fontFamily: theme.font, fontSize: 13, fontWeight: 700, color: theme.text }}>{a.to}</div>
          </div>
        </div>
        <div style={{ fontFamily: theme.font, fontSize: 12.5, color: theme.textMute, marginTop: 10, textAlign: 'center' }}>{a.reason}</div>
        <div style={{ fontFamily: theme.font, fontSize: 10.5, color: theme.textFaint, textAlign: 'right', marginTop: 6 }}>{m.t}</div>
      </div>
    );
  }

  if (m.kind === 'runcard') {
    const r = m.run;
    return (
      <div style={{ alignSelf: 'flex-end', maxWidth: '82%', borderRadius: 18, borderBottomRightRadius: 5, background: theme.accent, padding: 14, color: theme.onAccent }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9, opacity: 0.85 }}>
          <Icon name="run" size={16} stroke={2} color={theme.onAccent} />
          <span style={{ fontFamily: theme.font, fontSize: 12, fontWeight: 700, letterSpacing: 0.3 }}>{r.title} · synced</span>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <RunStat label="Dist" value={r.dist} c={theme.onAccent} f={theme} />
          <RunStat label="Pace" value={r.pace.replace('/mi', '')} c={theme.onAccent} f={theme} />
          <RunStat label="Time" value={r.time} c={theme.onAccent} f={theme} />
          <RunStat label="HR" value={r.hr} c={theme.onAccent} f={theme} />
        </div>
        <div style={{ fontFamily: theme.font, fontSize: 10.5, opacity: 0.7, textAlign: 'right', marginTop: 8 }}>{m.t}</div>
      </div>
    );
  }

  return (
    <div style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
      <div style={{ background: mine ? theme.accent : theme.surface, color: mine ? theme.onAccent : theme.text,
        borderRadius: 19, borderBottomRightRadius: mine ? 5 : 19, borderBottomLeftRadius: mine ? 19 : 5,
        padding: '9px 14px', fontFamily: theme.font, fontSize: 15, lineHeight: 1.4, boxShadow: mine ? 'none' : theme.cardShadow, textWrap: 'pretty' }}>{m.text}</div>
      <div style={{ fontFamily: theme.font, fontSize: 10.5, color: theme.textFaint, marginTop: 3, textAlign: mine ? 'right' : 'left', padding: '0 4px' }}>{m.t}</div>
    </div>
  );
}

function RunStat({ label, value, c, f }) {
  return (
    <div>
      <div style={{ fontFamily: f.font, fontSize: 10, opacity: 0.75, fontWeight: 600, textTransform: 'uppercase', color: c }}>{label}</div>
      <div style={{ fontFamily: f.num, fontSize: 17, fontWeight: 700, color: c, fontFeatureSettings: f.numFeat, whiteSpace: 'nowrap' }}>{value}</div>
    </div>
  );
}

Object.assign(window, { ChatView });
