// coach-app.jsx — coach dashboard shell (roster + plan grid + editor)
// Exports to window: CoachApp

function CoachApp({ theme }) {
  const { Icon, Avatar, CLIENTS, PlanGrid, WorkoutEditor, CoachLogin, CoachChat, COACH, ASSISTANTS, AddClientModal, ConfirmDialog } = window;

  const [authed, setAuthed] = React.useState(false);
  // editable copy of clients (weeks mutate)
  const [clients, setClients] = React.useState(() => JSON.parse(JSON.stringify(CLIENTS)));
  const [clientId, setClientId] = React.useState(clients[0].id);
  const [dayId, setDayId] = React.useState(null);
  const [toast, setToast] = React.useState(null);
  const [library, setLibrary] = React.useState(() => window.LIBRARY.map((t, i) => ({ ...JSON.parse(JSON.stringify(t)), _id: 'lib' + i })));
  const [editTplId, setEditTplId] = React.useState(null);
  const dragRef = React.useRef(null);
  const [dragKind, setDragKind] = React.useState(null);
  const [chatOpen, setChatOpen] = React.useState(false);
  const [teamOpen, setTeamOpen] = React.useState(false);
  const [clipboard, setClipboard] = React.useState(null);
  const [teamQuery, setTeamQuery] = React.useState('');
  const [addClientOpen, setAddClientOpen] = React.useState(false);
  const [removeId, setRemoveId] = React.useState(null);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const beginDrag = (payload) => { dragRef.current = payload; setDragKind(payload.kind); };
  const endDrag = () => { dragRef.current = null; setDragKind(null); };

  const client = clients.find(c => c.id === clientId);
  const day = client.week.find(d => d.id === dayId) || null;

  const flash = (msg) => { setToast(msg); clearTimeout(window.__rbToast); window.__rbToast = setTimeout(() => setToast(null), 2200); };

  const updateWeek = (fn) => setClients(cs => cs.map(c => c.id === clientId ? { ...c, week: fn(c.week) } : c));

  const changeDay = (newW) => updateWeek(week => week.map(d => {
    if (d.id !== dayId) return d;
    const isRest = !newW || newW.type === 'rest';
    let status = d.status;
    if (isRest) status = 'rest';
    else if (status === 'rest') status = 'planned';
    return { ...d, w: newW, status };
  }));

  const clearDay = () => { updateWeek(week => week.map(d => d.id === dayId ? { ...d, w: null, status: 'rest' } : d)); flash('Day cleared'); };

  const copyToDay = (targetIdx) => {
    const src = day && day.w;
    if (!src) return;
    updateWeek(week => week.map((d, i) => i === targetIdx
      ? { ...d, w: JSON.parse(JSON.stringify(src)), status: src.type === 'rest' ? 'rest' : 'planned' }
      : d));
    flash(`Copied to ${client.week[targetIdx].dow}`);
  };

  const copyWorkout = (w) => { setClipboard(JSON.parse(JSON.stringify(w))); flash(`${w.title} copied`); };
  const pasteToDay = (targetIdx) => {
    if (!clipboard) return;
    updateWeek(week => week.map((d, i) => i === targetIdx
      ? { ...d, w: JSON.parse(JSON.stringify(clipboard)), status: clipboard.type === 'rest' ? 'rest' : 'planned' }
      : d));
    flash(`${clipboard.title} pasted to ${client.week[targetIdx].dow}`);
  };

  const moveWorkout = (srcIdx, dstIdx) => {
    updateWeek(week => {
      const next = week.map(d => ({ ...d }));
      const a = next[srcIdx], b = next[dstIdx];
      const aw = a.w, bw = b.w;
      a.w = bw; b.w = aw;
      a.status = a.w ? (a.w.type === 'rest' ? 'rest' : 'planned') : 'rest';
      b.status = b.w ? (b.w.type === 'rest' ? 'rest' : 'planned') : 'rest';
      return next;
    });
    flash('Workout moved');
  };

  const placeTemplate = (dstIdx, tpl) => {
    updateWeek(week => week.map((d, idx) => idx === dstIdx
      ? { ...d, w: JSON.parse(JSON.stringify(stripId(tpl))), status: tpl.type === 'rest' ? 'rest' : 'planned' }
      : d));
    flash(`${tpl.title} added`);
  };

  // ── workout library editing ──
  const editingTpl = library.find(t => t._id === editTplId) || null;
  const newWorkout = () => {
    const id = 'lib' + Date.now();
    const tpl = { ...window.blankWorkout('easy'), title: 'New Workout', _id: id, custom: true };
    setLibrary(l => [tpl, ...l]);
    setDayId(null); setEditTplId(id);
  };
  const changeTpl = (newW) => setLibrary(l => l.map(t => t._id === editTplId ? { ...newW, _id: editTplId, custom: t.custom } : t));
  const deleteTpl = () => { setLibrary(l => l.filter(t => t._id !== editTplId)); setEditTplId(null); flash('Workout removed from library'); };

  const weekMiles = client.week.reduce((s, d) => s + (d.w && d.w.dist ? d.w.dist : 0), 0);
  const weekMinutes = client.week.reduce((s, d) => s + window.estMinutes(d.w), 0);
  const sessions = client.week.filter(d => d.w && d.w.type !== 'rest').length;
  const doneCount = client.week.filter(d => d.status === 'done').length;

  const statusColor = (s) => s === 'Needs check-in' ? theme.types.race.c : s === 'Crushing it' ? theme.accent2 : theme.accent;
  const avBg = theme.dark ? 'rgba(247,244,238,0.13)' : 'rgba(40,40,46,0.10)';

  const assistById = Object.fromEntries((ASSISTANTS || []).map(a => [a.id, a]));
  const team = client.team || [];
  const toggleAssistant = (id) => setClients(cs => cs.map(c => c.id === clientId
    ? { ...c, team: (c.team || []).includes(id) ? (c.team || []).filter(x => x !== id) : [...(c.team || []), id] }
    : c));

  // ── add / remove athletes ──
  const blankWeek = () => {
    const D = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dates = ['Jun 1', 'Jun 2', 'Jun 3', 'Jun 4', 'Jun 5', 'Jun 6', 'Jun 7'];
    return D.map((dow, i) => ({ id: 'd' + i, dow, date: dates[i], w: null, status: 'rest' }));
  };
  const addClient = (f) => {
    const initials = f.name.trim().split(/\s+/).map(s => s[0]).slice(0, 2).join('').toUpperCase();
    const id = 'c' + Date.now();
    const nc = { id, name: f.name.trim(), initials, goal: f.goal || 'No goal set', goalDate: f.goalDate || '—',
      goalTime: f.goalTime || '—', level: f.level, status: 'On track', planWeek: 1, planWeeks: 12, team: [], week: blankWeek() };
    setClients(cs => [...cs, nc]);
    setClientId(id); setDayId(null); setEditTplId(null); setAddClientOpen(false);
    flash(`${nc.name} added`);
  };
  const removeClient = (id) => {
    const removed = clients.find(c => c.id === id);
    setClients(cs => {
      const next = cs.filter(c => c.id !== id);
      if (id === clientId && next.length) { setClientId(next[0].id); setDayId(null); setEditTplId(null); }
      return next;
    });
    setRemoveId(null);
    flash(`${removed ? removed.name : 'Athlete'} removed`);
  };

  if (!authed) return <CoachLogin theme={theme} onLogin={() => setAuthed(true)} />;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', background: theme.bg, color: theme.text, overflow: 'hidden' }}>
      {/* ── SIDEBAR ── */}
      <div style={{ width: 264, flexShrink: 0, background: theme.surface, borderRight: `1px solid ${theme.line}`, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '24px 20px 16px', borderBottom: `1px solid ${theme.line}` }}>
          <div style={{ fontFamily: theme.display, fontStyle: 'italic', fontWeight: 800, fontSize: 27, letterSpacing: -0.8, lineHeight: 1 }}>
            <span className="rb-metal-lime">Rec</span><span className="rb-metal-silver">Buddy</span>
          </div>
          <div style={{ fontFamily: theme.font, fontSize: 10.5, color: theme.textMute, fontWeight: 700, letterSpacing: 2.4, marginTop: 4 }}>COACH</div>
        </div>
        <div style={{ padding: '14px 14px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: theme.font, fontSize: 11, fontWeight: 700, color: theme.textFaint, textTransform: 'uppercase', letterSpacing: 0.7 }}>Athletes · {clients.length}</span>
          <button onClick={() => setAddClientOpen(true)} title="Add athlete" style={{ width: 24, height: 24, borderRadius: 8, cursor: 'pointer',
            border: `1px solid ${theme.line}`, background: 'transparent', color: theme.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="plus" size={15} stroke={2.6} color={theme.accent} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {clients.map(c => {
            const on = c.id === clientId;
            return (
              <div key={c.id} role="button" tabIndex={0} onClick={() => { setClientId(c.id); setDayId(null); setEditTplId(null); }} style={{
                display: 'flex', alignItems: 'center', gap: 11, padding: '10px 11px', borderRadius: 12, cursor: 'pointer',
                background: on ? theme.surface2 : 'transparent', textAlign: 'left', width: '100%',
                outline: on ? `1px solid ${theme.line}` : 'none', position: 'relative',
              }}
                onMouseEnter={e => { const t = e.currentTarget.querySelector('.rb-rm'); if (t) t.style.opacity = 1; }}
                onMouseLeave={e => { const t = e.currentTarget.querySelector('.rb-rm'); if (t) t.style.opacity = 0; }}>
                <Avatar theme={theme} initials={c.initials} size={38} accent={avBg} textColor={theme.text} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: theme.font, fontSize: 13.5, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                  <div style={{ fontFamily: theme.font, fontSize: 11.5, color: theme.textMute, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.level} · {c.goalDate}</div>
                </div>
                {c.status === 'Needs check-in' && <span style={{ width: 7, height: 7, borderRadius: 7, background: theme.textMute, flexShrink: 0 }} title="Needs check-in" />}
                <button className="rb-rm" onClick={e => { e.stopPropagation(); setRemoveId(c.id); }} title="Remove athlete" style={{
                  width: 26, height: 26, borderRadius: 8, flexShrink: 0, cursor: 'pointer', opacity: 0, transition: 'opacity .15s',
                  border: 'none', background: theme.chip, color: theme.types.race.c, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="trash" size={15} stroke={2} />
                </button>
              </div>
            );
          })}
          <button onClick={() => setAddClientOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 11px', borderRadius: 12, cursor: 'pointer',
            border: `1.5px dashed ${theme.line}`, background: 'transparent', color: theme.textMute, marginTop: 4,
            fontFamily: theme.font, fontSize: 13, fontWeight: 600, width: '100%' }}>
            <span style={{ width: 38, height: 38, borderRadius: 38, flexShrink: 0, border: `1.5px dashed ${theme.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="plus" size={18} stroke={2.4} color={theme.accent} />
            </span>
            Add athlete
          </button>
        </div>
        <div style={{ padding: 12, borderTop: `1px solid ${theme.line}`, display: 'flex', flexDirection: 'column', gap: 8, position: 'relative' }}>
          <button onClick={() => setProfileOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 6px', borderRadius: 11, cursor: 'pointer',
            border: 'none', background: profileOpen ? theme.surface2 : 'transparent', width: '100%', textAlign: 'left' }}>
            <Avatar theme={theme} initials={COACH.initials} size={34} accent={avBg} textColor={theme.text} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: theme.font, fontSize: 13, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{COACH.name}</div>
              <div style={{ fontFamily: theme.font, fontSize: 11, color: theme.textMute }}>{COACH.role}</div>
            </div>
            <Icon name="ellipsis" size={18} stroke={2} color={theme.textMute} />
          </button>
          <a href="RecBuddy.html" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, textDecoration: 'none',
            border: `1px solid ${theme.line}`, borderRadius: 11, padding: '11px', color: theme.text,
            fontFamily: theme.font, fontSize: 13, fontWeight: 600 }}>
            <Icon name="run" size={16} stroke={2} color={theme.accent} /> Preview as athlete
          </a>

          {/* profile / settings menu */}
          {profileOpen && (
            <React.Fragment>
              <div onClick={() => setProfileOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 80 }} />
              <div style={{ position: 'absolute', bottom: 'calc(100% - 4px)', left: 12, right: 12, zIndex: 81,
                background: theme.surface, border: `1px solid ${theme.line}`, borderRadius: 16, boxShadow: theme.cardShadow, padding: 8, marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '8px 8px 12px', borderBottom: `1px solid ${theme.hairline}`, marginBottom: 4 }}>
                  <Avatar theme={theme} initials={COACH.initials} size={40} accent={theme.accent} textColor={theme.onAccent} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: theme.font, fontSize: 14, fontWeight: 700, color: theme.text }}>{COACH.name}</div>
                    <div style={{ fontFamily: theme.font, fontSize: 12, color: theme.textMute }}>mara@recbuddy.app</div>
                  </div>
                </div>
                {[['edit', 'Profile'], ['target', 'Coaching preferences'], ['heart', 'Notifications'], ['lock', 'Account & security']].map(([ic, lbl]) => (
                  <button key={lbl} onClick={() => { setProfileOpen(false); flash(lbl); }} style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', padding: '10px 8px', borderRadius: 9,
                    border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                    <Icon name={ic} size={17} stroke={2} color={theme.textMute} />
                    <span style={{ fontFamily: theme.font, fontSize: 13.5, fontWeight: 600, color: theme.text }}>{lbl}</span>
                  </button>
                ))}
                <div style={{ borderTop: `1px solid ${theme.hairline}`, marginTop: 4, paddingTop: 4 }}>
                  <button onClick={() => { setProfileOpen(false); setAuthed(false); }} style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', padding: '10px 8px', borderRadius: 9,
                    border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                    <Icon name="logout" size={17} stroke={2} color={theme.types.race.c} />
                    <span style={{ fontFamily: theme.font, fontSize: 13.5, fontWeight: 600, color: theme.types.race.c }}>Log out</span>
                  </button>
                </div>
              </div>
            </React.Fragment>
          )}
        </div>
      </div>

      {/* ── MAIN ── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* top bar */}
        <div style={{ flexShrink: 0, padding: '20px 28px', borderBottom: `1px solid ${theme.line}`,
          display: 'flex', alignItems: 'center', gap: 18 }}>
          <Avatar theme={theme} initials={client.initials} size={46} accent={avBg} textColor={theme.text} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ margin: 0, fontFamily: theme.display, fontSize: 23, fontWeight: 700, letterSpacing: -0.4, whiteSpace: 'nowrap' }}>{client.name}</h1>
              <span style={{ fontFamily: theme.font, fontSize: 11.5, fontWeight: 700, color: theme.textMute, whiteSpace: 'nowrap',
                background: theme.chip, padding: '3px 9px', borderRadius: 20 }}>{client.status}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, fontFamily: theme.font, fontSize: 13, color: theme.textMute, whiteSpace: 'nowrap' }}>
              <Icon name="trophy" size={14} stroke={2} color={theme.accent2} />
              <span style={{ fontWeight: 600, color: theme.text }}>{client.goal}</span>
              <span>· {client.goalDate}</span><span>·</span>
              <span>Week {client.planWeek} of {client.planWeeks}</span>
            </div>
          </div>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {/* coaching team */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div title={COACH.name + ' · Head coach'} style={{ width: 30, height: 30, borderRadius: 30, background: avBg, color: theme.text,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.font, fontWeight: 700, fontSize: 11.5,
                border: `2px solid ${theme.bg}`, position: 'relative', zIndex: 5 }}>{COACH.initials}</div>
              {team.map((id, i) => assistById[id] && (
                <div key={id} title={assistById[id].name + ' · ' + assistById[id].role} style={{ width: 30, height: 30, borderRadius: 30, background: avBg, color: theme.text,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.font, fontWeight: 700, fontSize: 11.5,
                  border: `2px solid ${theme.bg}`, marginLeft: -8, zIndex: 4 - i }}>{assistById[id].initials}</div>
              ))}
              <button onClick={() => { setTeamOpen(o => !o); setTeamQuery(''); }} title="Add assistant coach" style={{ width: 30, height: 30, borderRadius: 30, marginLeft: -8, cursor: 'pointer',
                background: theme.bg, border: `1.5px dashed ${teamOpen ? theme.accent : theme.line}`, color: teamOpen ? theme.accent : theme.textMute,
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="plus" size={15} stroke={2.4} />
              </button>
            </div>

            <button onClick={() => setChatOpen(true)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, border: 'none', cursor: 'pointer', borderRadius: 11, padding: '10px 14px',
              background: theme.accent, color: theme.onAccent, fontFamily: theme.font, fontSize: 13, fontWeight: 700 }}>
              <Icon name="chat" size={16} stroke={2.2} color={theme.onAccent} /> Message
            </button>
            <button onClick={() => flash('Week duplicated to Jun 8 – 14')} style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, border: `1px solid ${theme.line}`, background: theme.surface,
              cursor: 'pointer', borderRadius: 11, padding: '10px 14px', fontFamily: theme.font, fontSize: 13, fontWeight: 600, color: theme.text }}>
              <Icon name="plus" size={15} stroke={2.2} color={theme.accent} /> Duplicate week
            </button>

            {/* team picker popover */}
            {teamOpen && (
              <React.Fragment>
                <div onClick={() => setTeamOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 60 }} />
                <div style={{ position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: 300, zIndex: 61,
                  background: theme.surface, border: `1px solid ${theme.line}`, borderRadius: 16, boxShadow: theme.cardShadow, padding: 14 }}>
                  <div style={{ fontFamily: theme.font, fontSize: 11, fontWeight: 700, color: theme.textMute, textTransform: 'uppercase', letterSpacing: 0.6 }}>Coaching team</div>
                  <div style={{ fontFamily: theme.font, fontSize: 12, color: theme.textFaint, margin: '4px 0 12px', lineHeight: 1.45 }}>
                    Assistants can edit {client.name.split(' ')[0]}'s workouts and follow the chat.
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0 12px', borderBottom: `1px solid ${theme.hairline}` }}>
                    <div style={{ width: 32, height: 32, borderRadius: 32, background: theme.accent, color: theme.onAccent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.font, fontWeight: 700, fontSize: 12 }}>{COACH.initials}</div>
                    <div style={{ flex: 1 }}><div style={{ fontFamily: theme.font, fontSize: 13.5, fontWeight: 700, color: theme.text }}>{COACH.name}</div><div style={{ fontFamily: theme.font, fontSize: 11.5, color: theme.textMute }}>Head coach · you</div></div>
                  </div>
                  <div style={{ position: 'relative', margin: '10px 0 6px' }}>
                    <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: theme.textFaint }}><Icon name="search" size={15} stroke={2} /></span>
                    <input value={teamQuery} onChange={e => setTeamQuery(e.target.value)} placeholder="Search directory…" autoFocus
                      style={{ width: '100%', boxSizing: 'border-box', background: theme.surface2, border: `1px solid ${theme.line}`, borderRadius: 9,
                        padding: '9px 10px 9px 32px', color: theme.text, fontFamily: theme.font, fontSize: 13, outline: 'none' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4, maxHeight: 220, overflowY: 'auto' }}>
                    {ASSISTANTS.filter(a => (a.name + ' ' + a.role).toLowerCase().includes(teamQuery.trim().toLowerCase())).map(a => {
                      const on = team.includes(a.id);
                      return (
                        <button key={a.id} onClick={() => toggleAssistant(a.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 6px', borderRadius: 10,
                          border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                          <div style={{ width: 32, height: 32, borderRadius: 32, background: avBg, color: theme.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.font, fontWeight: 700, fontSize: 12 }}>{a.initials}</div>
                          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontFamily: theme.font, fontSize: 13.5, fontWeight: 600, color: theme.text }}>{a.name}</div><div style={{ fontFamily: theme.font, fontSize: 11.5, color: theme.textMute }}>{a.role}</div></div>
                          <span style={{ width: 24, height: 24, borderRadius: 24, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: on ? theme.accent : 'transparent', border: on ? 'none' : `1.5px solid ${theme.line}`, color: theme.onAccent }}>
                            {on ? <Icon name="check" size={14} stroke={3} color={theme.onAccent} /> : <Icon name="plus" size={14} stroke={2.4} color={theme.textMute} />}
                          </span>
                        </button>
                      );
                    })}
                    {ASSISTANTS.filter(a => (a.name + ' ' + a.role).toLowerCase().includes(teamQuery.trim().toLowerCase())).length === 0 && (
                      <div style={{ fontFamily: theme.font, fontSize: 12.5, color: theme.textFaint, padding: '12px 6px', textAlign: 'center' }}>No coaches match "{teamQuery}"</div>
                    )}
                  </div>
                </div>
              </React.Fragment>
            )}
          </div>
        </div>

        {/* week summary + nav */}
        <div style={{ flexShrink: 0, padding: '16px 28px', display: 'flex', alignItems: 'center', gap: 26, borderBottom: `1px solid ${theme.line}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button style={navBtn(theme)}><Icon name="back" size={17} stroke={2.2} color={theme.textMute} /></button>
            <span style={{ fontFamily: theme.display, fontSize: 15, fontWeight: 700 }}>Jun 1 – Jun 7</span>
            <button style={navBtn(theme)}><Icon name="chevron" size={17} stroke={2.2} color={theme.textMute} /></button>
            <span style={{ fontFamily: theme.font, fontSize: 12, color: theme.textFaint, marginLeft: 4 }}>This week</span>
          </div>
          <div style={{ flex: 1 }} />
          <SummaryStat theme={theme} label="Est. weekly vol." value={weekMiles.toFixed(1)} unit="mi" />
          <SummaryStat theme={theme} label="Time on feet" value={window.fmtDur(weekMinutes)} />
          <SummaryStat theme={theme} label="Completed" value={`${doneCount}/${sessions}`} />
        </div>

        {/* grid */}
        <div onClick={(e) => { if (e.target === e.currentTarget) { setDayId(null); setEditTplId(null); } }}
          style={{ flex: 1, overflowY: 'auto', padding: '22px 28px 32px' }}>
          <PlanGrid theme={theme} week={client.week} selectedId={dayId} onSelect={(id) => { setEditTplId(null); setDayId(id); }} onMove={moveWorkout}
            dragRef={dragRef} dragActive={!!dragKind} onPlace={placeTemplate}
            clipboard={clipboard} onCopy={copyWorkout} onPaste={pasteToDay} />
          <PlanLegend theme={theme} />
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, fontFamily: theme.font, fontSize: 12.5, color: theme.textFaint }}>
            <Icon name="route" size={15} stroke={2} color={theme.textFaint} />
            Drag from the workout library or move cards between days · Click any day to edit
          </div>
        </div>
      </div>

      {/* ── EDITOR / RIGHT PANEL ── */}
      <div style={{ width: 360, flexShrink: 0 }}>
        {day ? (
          <WorkoutEditor theme={theme} day={day} onChange={changeDay} onClear={clearDay} onClose={() => setDayId(null)} />
        ) : editingTpl ? (
          <WorkoutEditor theme={theme}
            day={{ w: editingTpl, contextLabel: editingTpl.custom ? 'New workout · library' : 'Library workout', clearLabel: 'Delete' }}
            onChange={changeTpl} onClear={deleteTpl} onClose={() => setEditTplId(null)} />
        ) : (
          <ClientPanel theme={theme} client={client} weekMiles={weekMiles} weekMinutes={weekMinutes}
            library={library} beginDrag={beginDrag} endDrag={endDrag}
            onNew={newWorkout} onEditTpl={(id) => { setDayId(null); setEditTplId(id); }} />
        )}
      </div>

      {/* coach ↔ client chat drawer */}
      {chatOpen && <CoachChat theme={theme} client={client} onClose={() => setChatOpen(false)} />}

      {/* add athlete + remove confirmation */}
      {addClientOpen && <AddClientModal theme={theme} onAdd={addClient} onClose={() => setAddClientOpen(false)} />}
      {removeId && (() => { const c = clients.find(x => x.id === removeId); return (
        <ConfirmDialog theme={theme} danger title={`Remove ${c ? c.name : 'athlete'}?`}
          message={`This permanently deletes ${c ? c.name.split(' ')[0] : 'their'}'s plan, history, and chat. This can't be undone.`}
          confirmLabel="Remove athlete" onConfirm={() => removeClient(removeId)} onCancel={() => setRemoveId(null)} />
      ); })()}

      {/* toast */}
      {toast && (
        <div style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 200,
          background: theme.text, color: theme.bg, fontFamily: theme.font, fontSize: 13.5, fontWeight: 600,
          padding: '11px 18px', borderRadius: 12, boxShadow: '0 12px 30px rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="check" size={16} stroke={2.6} color={theme.accent} /> {toast}
        </div>
      )}
    </div>
  );
}

function stripId(t) { const c = { ...t }; delete c._id; delete c.custom; return c; }

function navBtn(theme) {
  return { width: 30, height: 30, borderRadius: 9, border: `1px solid ${theme.line}`, background: theme.surface, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center' };
}

function SummaryStat({ theme, label, value, unit }) {
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontFamily: theme.font, fontSize: 10.5, fontWeight: 700, color: theme.textFaint, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ marginTop: 2 }}>
        <span style={{ fontFamily: theme.num, fontSize: 20, fontWeight: 700, color: theme.text, fontFeatureSettings: theme.numFeat }}>{value}</span>
        {unit && <span style={{ fontFamily: theme.font, fontSize: 12, color: theme.textMute, marginLeft: 2 }}>{unit}</span>}
      </div>
    </div>
  );
}

function ClientPanel({ theme, client, weekMiles, weekMinutes, library, beginDrag, endDrag, onNew, onEditTpl }) {
  const { Icon, typeColor, WTYPES, TYPE_ICON, estMinutes, fmtDur } = window;
  return (
    <div style={{ height: '100%', background: theme.surface, borderLeft: `1px solid ${theme.line}`, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* workout library */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontFamily: theme.font, fontSize: 11, fontWeight: 700, color: theme.textMute, textTransform: 'uppercase', letterSpacing: 0.6 }}>Workout library</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: theme.font, fontSize: 11, color: theme.textFaint }}>
              <Icon name="route" size={13} stroke={2} color={theme.textFaint} /> drag to a day
            </div>
          </div>

          {/* new workout button */}
          <button onClick={onNew} style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10,
            border: `1.5px dashed ${theme.accent}`, background: theme.accent + '14', cursor: 'pointer', borderRadius: 13, padding: '11px',
            fontFamily: theme.font, fontSize: 13.5, fontWeight: 700, color: theme.accent }}>
            <Icon name="plus" size={17} stroke={2.6} color={theme.accent} /> New workout
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {library.map((tpl) => {
              const mins = estMinutes(tpl);
              const meta = tpl.type === 'rest' ? 'Recovery day'
                : tpl.dist ? `${tpl.dist} mi · ${tpl.pace}`
                : tpl.dur ? `${tpl.dur} min` : WTYPES[tpl.type].label;
              return (
                <div key={tpl._id}
                  draggable
                  onClick={() => onEditTpl(tpl._id)}
                  onDragStart={e => { beginDrag({ kind: 'template', tpl }); e.dataTransfer.effectAllowed = 'copy'; e.dataTransfer.setData('text/plain', tpl.title); }}
                  onDragEnd={endDrag}
                  title="Click to edit · drag onto a day"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 13,
                    background: theme.surface2, border: `1px solid ${theme.line}`, cursor: 'grab', userSelect: 'none',
                  }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: theme.chip, color: theme.textMute, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={TYPE_ICON[tpl.type]} size={18} stroke={2} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontFamily: theme.font, fontSize: 13.5, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tpl.title}</span>
                      {tpl.custom && <span style={{ fontFamily: theme.font, fontSize: 9, fontWeight: 700, color: theme.textMute, border: `1px solid ${theme.line}`, padding: '1px 6px', borderRadius: 6, textTransform: 'uppercase', letterSpacing: 0.4, flexShrink: 0 }}>Custom</span>}
                    </div>
                    <div style={{ fontFamily: theme.font, fontSize: 11.5, color: theme.textMute, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{meta}</div>
                  </div>
                  {mins > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
                      fontFamily: theme.num, fontSize: 12, fontWeight: 600, color: theme.textMute, fontFeatureSettings: theme.numFeat }}>
                      <Icon name="clock" size={13} stroke={2} color={theme.textFaint} />{fmtDur(mins)}
                    </div>
                  )}
                  <Icon name="edit" size={15} stroke={2} color={theme.textFaint} style={{ flexShrink: 0, opacity: 0.55 }} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function PanelStat({ theme, label, value, unit }) {
  return (
    <div style={{ flex: 1, background: theme.surface2, borderRadius: 14, padding: '13px 15px' }}>
      <div style={{ fontFamily: theme.font, fontSize: 10.5, fontWeight: 700, color: theme.textFaint, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ marginTop: 3 }}>
        <span style={{ fontFamily: theme.num, fontSize: 22, fontWeight: 700, fontFeatureSettings: theme.numFeat }}>{value}</span>
        {unit && <span style={{ fontFamily: theme.font, fontSize: 12, color: theme.textMute, marginLeft: 2 }}>{unit}</span>}
      </div>
    </div>
  );
}

Object.assign(window, { CoachApp });
