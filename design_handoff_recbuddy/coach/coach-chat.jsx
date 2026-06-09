// coach-chat.jsx — coach-side 1:1 chat drawer with a client
// Exports to window: CoachChat

function coachSeed(client) {
  const f = client.name.split(' ')[0];
  return [
    { kind: 'day', text: 'Yesterday' },
    { from: 'them', text: `Morning! Got the long run done — felt strong the whole way 💪`, t: '8:12 AM' },
    { from: 'me', text: `Love it, ${f}. Your splits were even — exactly what I wanted to see.`, t: '8:30 AM' },
    { from: 'them', text: `Legs are a little tired today but nothing concerning.`, t: '8:34 AM' },
    { kind: 'day', text: 'Today' },
    { from: 'me', text: `Good — today's an easy recovery day. Keep it conversational, HR under 145.`, t: '7:05 AM' },
  ];
}

function CoachChat({ theme, client, onClose }) {
  const { Icon, Avatar } = window;
  const [msgs, setMsgs] = React.useState(() => coachSeed(client));
  const [draft, setDraft] = React.useState('');
  const scrollRef = React.useRef(null);
  const avBg = theme.dark ? 'rgba(247,244,238,0.13)' : 'rgba(40,40,46,0.10)';

  // reset thread when switching client
  React.useEffect(() => { setMsgs(coachSeed(client)); setDraft(''); }, [client.id]);
  React.useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [msgs]);

  const send = (text) => {
    const t = (text != null ? text : draft).trim();
    if (!t) return;
    setDraft('');
    const now = new Date();
    const stamp = `${((now.getHours() + 11) % 12) + 1}:${String(now.getMinutes()).padStart(2, '0')} ${now.getHours() < 12 ? 'AM' : 'PM'}`;
    setMsgs(m => [...m, { from: 'me', text: t, t: stamp }]);
    setTimeout(() => {
      setMsgs(m => [...m, { from: 'them', typing: true }]);
      setTimeout(() => setMsgs(m => m.filter(x => !x.typing).concat({
        from: 'them', t: stamp, text: 'Got it, coach — thanks! Will check in after the session. 👊',
      })), 1400);
    }, 500);
  };

  const quicks = ['Nice work 👊', 'How did that feel?', 'Take an extra rest day if needed'];

  return (
    <React.Fragment>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, zIndex: 120, background: 'rgba(0,0,0,0.5)' }} />
      <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 440, zIndex: 121,
        background: theme.surface, borderLeft: `1px solid ${theme.line}`, boxShadow: '-20px 0 50px rgba(0,0,0,0.5)',
        display: 'flex', flexDirection: 'column' }}>
        {/* header */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '18px 20px', borderBottom: `1px solid ${theme.line}` }}>
          <Avatar theme={theme} initials={client.initials} size={40} accent={avBg} textColor={theme.text} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: theme.display, fontSize: 18, fontWeight: 700, letterSpacing: -0.2 }}>{client.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: theme.font, fontSize: 12, color: theme.accent }}>
              <span style={{ width: 7, height: 7, borderRadius: 7, background: '#34C759' }} /> Active now
            </div>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 34, border: 'none', cursor: 'pointer',
            background: theme.chip, color: theme.textMute, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="cross" size={18} stroke={2} />
          </button>
        </div>

        {/* messages */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {msgs.map((m, i) => {
            if (m.kind === 'day') return <div key={i} style={{ textAlign: 'center', fontFamily: theme.font, fontSize: 11.5, fontWeight: 600, color: theme.textFaint, padding: '8px 0 4px' }}>{m.text}</div>;
            const mine = m.from === 'me';
            if (m.typing) return (
              <div key={i} style={{ alignSelf: 'flex-start', background: theme.surface2, borderRadius: 16, borderBottomLeftRadius: 5, padding: '12px 15px', display: 'flex', gap: 4 }}>
                {[0, 1, 2].map(d => <span key={d} style={{ width: 6, height: 6, borderRadius: 6, background: theme.textFaint, animation: `rbdot 1.2s ${d * 0.18}s infinite ease-in-out` }} />)}
              </div>
            );
            return (
              <div key={i} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                <div style={{ background: mine ? theme.accent : theme.surface2, color: mine ? theme.onAccent : theme.text,
                  borderRadius: 18, borderBottomRightRadius: mine ? 5 : 18, borderBottomLeftRadius: mine ? 18 : 5,
                  padding: '9px 13px', fontFamily: theme.font, fontSize: 14.5, lineHeight: 1.4, textWrap: 'pretty' }}>{m.text}</div>
                <div style={{ fontFamily: theme.font, fontSize: 10.5, color: theme.textFaint, marginTop: 3, textAlign: mine ? 'right' : 'left', padding: '0 4px' }}>{m.t}</div>
              </div>
            );
          })}
        </div>

        {/* quick replies */}
        <div style={{ flexShrink: 0, display: 'flex', gap: 7, padding: '4px 18px 6px', overflowX: 'auto' }}>
          {quicks.map(q => (
            <button key={q} onClick={() => send(q)} style={{ flexShrink: 0, border: `1px solid ${theme.line}`, background: theme.surface2, cursor: 'pointer',
              borderRadius: 18, padding: '7px 12px', fontFamily: theme.font, fontSize: 12.5, fontWeight: 500, color: theme.text, whiteSpace: 'nowrap' }}>{q}</button>
          ))}
        </div>

        {/* composer */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 9, padding: '8px 18px 18px', borderTop: `1px solid ${theme.line}` }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: theme.surface2, border: `1px solid ${theme.line}`, borderRadius: 21, padding: '4px 4px 4px 14px' }}>
            <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') send(); }}
              placeholder={`Message ${client.name.split(' ')[0]}…`} style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent',
                fontFamily: theme.font, fontSize: 14.5, color: theme.text, padding: '7px 0' }} />
            <button onClick={() => send()} disabled={!draft.trim()} style={{ width: 32, height: 32, borderRadius: 32, flexShrink: 0, border: 'none',
              cursor: draft.trim() ? 'pointer' : 'default', opacity: draft.trim() ? 1 : 0.4, background: theme.accent, color: theme.onAccent,
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="send" size={17} stroke={2} fill="currentColor" color={theme.onAccent} style={{ marginLeft: -1 }} />
            </button>
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}

Object.assign(window, { CoachChat });
