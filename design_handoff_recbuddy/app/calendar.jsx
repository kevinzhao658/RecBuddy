// calendar.jsx — Calendar/Plan view + workout detail sheet
// Exports to window: CalendarView

function CalendarView({ theme, overrides, onComplete, onAccount }) {
  const { Icon, TypeDot, Segmented, Sheet, Ring } = window;
  const { PLAN, TODAY, WTYPES, TYPE_ICON, typeColor, MONTHS, DOW1, iso, parseISO, fmtLong, GOAL } = window;

  const [mode, setMode] = React.useState('month');
  const [cursor, setCursor] = React.useState({ y: 2026, m: 5 }); // June 2026
  const [sel, setSel] = React.useState(null); // selected ISO date for sheet
  const [weekAnchor, setWeekAnchor] = React.useState(TODAY);

  const statusOf = (d) => overrides[d] || (PLAN[d] && PLAN[d].status) || null;
  const workoutOf = (d) => PLAN[d];

  // ── month grid weeks ──
  const first = new Date(cursor.y, cursor.m, 1);
  const startDow = first.getDay();
  const gridStart = new Date(cursor.y, cursor.m, 1 - startDow);
  const weeks = [];
  for (let w = 0; w < 6; w++) {
    const row = [];
    for (let i = 0; i < 7; i++) {
      const dt = new Date(gridStart); dt.setDate(gridStart.getDate() + w * 7 + i);
      row.push(dt);
    }
    weeks.push(row);
    const last = row[6];
    if (last.getMonth() !== cursor.m && last > first) break;
  }

  const shiftMonth = (dir) => {
    let m = cursor.m + dir, y = cursor.y;
    if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; }
    setCursor({ y, m });
  };

  // week list dates
  const wa = parseISO(weekAnchor); const waStart = new Date(wa); waStart.setDate(wa.getDate() - wa.getDay());
  const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(waStart); d.setDate(waStart.getDate() + i); return d; });
  const shiftWeek = (dir) => { const d = parseISO(weekAnchor); d.setDate(d.getDate() + dir * 7); setWeekAnchor(iso(d.getFullYear(), d.getMonth(), d.getDate())); };

  const todayW = workoutOf(TODAY);
  const todayDone = statusOf(TODAY) === 'done';

  // ── weekly mileage progress (Mon–Sun week containing today) ──
  const wkStart = (() => { const d = parseISO(TODAY); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; })();
  let weekPlanned = 0, weekDone = 0;
  for (let i = 0; i < 7; i++) {
    const dt = new Date(wkStart); dt.setDate(wkStart.getDate() + i);
    const id = iso(dt.getFullYear(), dt.getMonth(), dt.getDate());
    const ww = workoutOf(id);
    if (ww && ww.dist) { weekPlanned += ww.dist; if (statusOf(id) === 'done') weekDone += ww.dist; }
  }
  const weekPct = weekPlanned ? Math.min(100, (weekDone / weekPlanned) * 100) : 0;

  // ────────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: theme.bg }}>
      {/* header */}
      <div style={{ flexShrink: 0, padding: '54px 20px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: theme.font, fontSize: 13, fontWeight: 600, color: theme.accent, letterSpacing: 0.3 }}>
              WEEK {GOAL.planWeek} OF {GOAL.planWeeks}
            </div>
            <h1 style={{ margin: '2px 0 0', fontFamily: theme.display, fontSize: 29, whiteSpace: 'nowrap',
              fontWeight: theme.headerStyle === 'bold' ? 700 : (theme.headerStyle === 'serif' ? 600 : 700),
              color: theme.text, letterSpacing: theme.headerStyle === 'bold' ? -0.5 : -0.3 }}>
              Your Plan
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: theme.textMute,
              fontFamily: theme.font, fontSize: 12.5, fontWeight: 500,
              background: theme.chip, padding: '6px 11px', borderRadius: 20 }}>
              <Icon name="sync" size={14} color={theme.accent} stroke={2.2} />
              Garmin
            </div>
            <button onClick={onAccount} style={{ width: 36, height: 36, borderRadius: 36, flexShrink: 0, cursor: 'pointer',
              border: `1px solid ${theme.line}`, background: theme.chip, color: theme.text,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.font, fontWeight: 700, fontSize: 14 }}>
              {window.ATHLETE.initials}
            </button>
          </div>
        </div>

        {/* weekly mileage progress */}
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 7 }}>
            <span style={{ fontFamily: theme.font, fontSize: 11.5, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: theme.textMute }}>Weekly mileage</span>
            <span style={{ fontFamily: theme.num, fontSize: 13, fontFeatureSettings: theme.numFeat, color: theme.textMute }}>
              <span style={{ color: theme.accent, fontWeight: 700 }}>{weekDone.toFixed(1)}</span> / {weekPlanned.toFixed(1)} mi
            </span>
          </div>
          <div style={{ height: 9, borderRadius: 9, background: theme.surface2, overflow: 'hidden', position: 'relative' }}>
            <div style={{ width: `${weekPct}%`, height: '100%', borderRadius: 9, background: theme.accent,
              boxShadow: `0 0 12px ${theme.accent}66`, transition: 'width .7s cubic-bezier(.32,.72,0,1)' }} />
          </div>
          <div style={{ fontFamily: theme.font, fontSize: 11.5, color: theme.textFaint, marginTop: 6 }}>
            {weekPlanned - weekDone > 0
              ? `${(weekPlanned - weekDone).toFixed(1)} mi to go this week`
              : 'Weekly mileage complete — nice work'}
          </div>
        </div>
      </div>

      {/* scroll body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 24px' }}>
        {/* ── TODAY hero ── */}
        {todayW && (
          <button onClick={() => setSel(TODAY)} style={{
            width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
            background: todayDone ? theme.types.easy.soft : theme.surface,
            borderRadius: theme.radius, padding: 16, marginBottom: 14,
            boxShadow: `0 0 0 2px ${theme.text}, ${theme.cardShadow}`, position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontFamily: theme.font, fontSize: 10.5, fontWeight: 800, letterSpacing: 0.8,
                background: theme.text, color: theme.bg, padding: '3px 9px', borderRadius: 6, textTransform: 'uppercase' }}>Today</span>
              <span style={{ fontFamily: theme.font, fontSize: 12.5, color: theme.textMute, fontWeight: 500 }}>{fmtLong(TODAY)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
              <div style={{ width: 50, height: 50, borderRadius: 15, flexShrink: 0,
                background: theme.chip, color: theme.textMute,
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={TYPE_ICON[todayW.type]} size={26} stroke={1.9} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: theme.font, fontSize: 12.5, fontWeight: 600, color: theme.textMute }}>{WTYPES[todayW.type].label}</div>
                <div style={{ fontFamily: theme.display, fontSize: 21, fontWeight: theme.headerStyle === 'serif' ? 600 : 700,
                  color: theme.text, letterSpacing: -0.2, lineHeight: 1.12 }}>{todayW.title}</div>
              </div>
            </div>
            {todayW.dist && (
              <div style={{ display: 'flex', gap: 22, marginTop: 13, paddingTop: 13, borderTop: `1px solid ${theme.hairline}` }}>
                <Metric theme={theme} label="Distance" value={`${todayW.dist} mi`} />
                <Metric theme={theme} label="Target pace" value={todayW.pace} />
                <div style={{ flex: 1 }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, alignSelf: 'flex-end',
                  color: todayDone ? theme.accent : theme.textMute, fontFamily: theme.font, fontSize: 13, fontWeight: 600 }}>
                  {todayDone ? <><Icon name="check" size={16} stroke={2.6} color={theme.accent} /> Done</> : <>Details <Icon name="chevron" size={15} stroke={2.4} /></>}
                </div>
              </div>
            )}
          </button>
        )}

        {/* segmented */}
        <div style={{ marginBottom: 14 }}>
          <Segmented theme={theme} value={mode} onChange={setMode}
            options={[{ value: 'month', label: 'Month' }, { value: 'week', label: 'Week' }]} />
        </div>

        {/* ── MONTH ── */}
        {mode === 'month' && (
          <div style={{ background: theme.surface, borderRadius: theme.radius, padding: '14px 12px 16px', boxShadow: theme.cardShadow }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 6px 10px' }}>
              <button onClick={() => shiftMonth(-1)} style={navBtn(theme)}><Icon name="chevronL" size={18} stroke={2.4} color={theme.textMute} /></button>
              <div style={{ fontFamily: theme.display, fontSize: 16.5, whiteSpace: 'nowrap', fontWeight: theme.headerStyle === 'serif' ? 600 : 700, color: theme.text, letterSpacing: -0.2 }}>
                {MONTHS[cursor.m]} {cursor.y}
              </div>
              <button onClick={() => shiftMonth(1)} style={navBtn(theme)}><Icon name="chevron" size={18} stroke={2.4} color={theme.textMute} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 4 }}>
              {DOW1.map((d, i) => <div key={i} style={{ textAlign: 'center', fontFamily: theme.font, fontSize: 11, fontWeight: 600, color: theme.textFaint, padding: '2px 0' }}>{d}</div>)}
            </div>
            {weeks.map((row, wi) => (
              <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
                {row.map((dt, di) => {
                  const isoD = iso(dt.getFullYear(), dt.getMonth(), dt.getDate());
                  const inMonth = dt.getMonth() === cursor.m;
                  const w = workoutOf(isoD); const st = statusOf(isoD);
                  const isToday = isoD === TODAY;
                  const tc = w ? typeColor(theme, w.type) : null;
                  const done = st === 'done'; const missed = st === 'missed';
                  return (
                    <button key={di} onClick={() => w && setSel(isoD)} disabled={!w} style={{
                      border: 'none', background: 'transparent', cursor: w ? 'pointer' : 'default',
                      padding: '3px 0 5px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                      opacity: inMonth ? 1 : 0.32,
                    }}>
                      <span style={{
                        width: 30, height: 30, borderRadius: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: theme.num, fontSize: 14.5, fontWeight: isToday ? 800 : 500, fontFeatureSettings: theme.numFeat,
                        background: isToday ? theme.text : 'transparent',
                        color: isToday ? theme.bg : theme.text,
                      }}>{dt.getDate()}</span>
                      <span style={{ height: 6, display: 'flex', alignItems: 'center', gap: 2 }}>
                        {w && w.type !== 'rest' && (
                          done
                            ? <Icon name="check" size={9} stroke={3.4} color={theme.accent} />
                            : missed
                              ? <span style={{ width: 6, height: 6, borderRadius: 6, background: theme.types.race.c }} />
                              : <span style={{ width: 6, height: 6, borderRadius: 6, background: theme.textFaint }} />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
            <Legend theme={theme} />
          </div>
        )}

        {/* ── WEEK ── */}
        {mode === 'week' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px 10px' }}>
              <button onClick={() => shiftWeek(-1)} style={navBtn(theme)}><Icon name="chevronL" size={18} stroke={2.4} color={theme.textMute} /></button>
              <div style={{ fontFamily: theme.display, fontSize: 15.5, whiteSpace: 'nowrap', fontWeight: theme.headerStyle === 'serif' ? 600 : 700, color: theme.text }}>
                {window.MON_SHORT[weekDays[0].getMonth()]} {weekDays[0].getDate()} – {window.MON_SHORT[weekDays[6].getMonth()]} {weekDays[6].getDate()}
              </div>
              <button onClick={() => shiftWeek(1)} style={navBtn(theme)}><Icon name="chevron" size={18} stroke={2.4} color={theme.textMute} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {weekDays.map((dt) => {
                const isoD = iso(dt.getFullYear(), dt.getMonth(), dt.getDate());
                const w = workoutOf(isoD); const st = statusOf(isoD); const isToday = isoD === TODAY;
                const tc = w ? typeColor(theme, w.type) : null;
                const done = st === 'done'; const missed = st === 'missed';
                return (
                  <button key={isoD} onClick={() => w && setSel(isoD)} disabled={!w} style={{
                    width: '100%', textAlign: 'left',
                    border: isToday ? `1.5px solid ${theme.text}` : `1px solid ${theme.hairline}`,
                    background: w && done ? theme.types.easy.soft : w && missed ? theme.types.race.soft : theme.surface,
                    borderRadius: theme.radiusSm, padding: '12px 14px', cursor: w ? 'pointer' : 'default',
                    display: 'flex', alignItems: 'center', gap: 12, boxShadow: theme.cardShadow,
                    opacity: w ? 1 : 0.55,
                  }}>
                    <div style={{ width: 34, textAlign: 'center', flexShrink: 0 }}>
                      <div style={{ fontFamily: theme.font, fontSize: 10.5, fontWeight: 700, color: isToday ? theme.text : theme.textFaint, textTransform: 'uppercase' }}>{window.DOW[dt.getDay()]}</div>
                      <div style={{ fontFamily: theme.num, fontSize: 19, fontWeight: 700, color: theme.text, fontFeatureSettings: theme.numFeat }}>{dt.getDate()}</div>
                    </div>
                    {w ? (
                      <div style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, background: theme.chip, color: theme.textMute,
                        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name={TYPE_ICON[w.type]} size={17} stroke={2} />
                      </div>
                    ) : <div style={{ width: 30, flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: theme.font, fontSize: 15.5, fontWeight: 650, color: theme.text }}>{w ? w.title : 'No session'}</div>
                      <div style={{ fontFamily: theme.font, fontSize: 12.5, color: theme.textMute, marginTop: 1 }}>
                        {w ? (w.type === 'rest' ? 'Recovery & mobility' : (w.dist ? `${w.dist} mi · ${w.pace}` : WTYPES[w.type].label)) : '—'}
                      </div>
                    </div>
                    {w && w.type !== 'rest' && (
                      done
                        ? <span style={{ width: 24, height: 24, borderRadius: 24, background: theme.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={14} stroke={3} color={theme.onAccent} /></span>
                        : missed
                          ? <span style={{ width: 24, height: 24, borderRadius: 24, background: theme.types.race.c, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="cross" size={14} stroke={2.4} color={theme.onAccent} /></span>
                          : <span style={{ width: 22, height: 22, borderRadius: 22, border: `2px solid ${theme.line}` }} />)}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── DETAIL SHEET ── */}
      <Sheet theme={theme} open={!!sel} onClose={() => setSel(null)}>
        {sel && <WorkoutDetail theme={theme} date={sel} status={statusOf(sel)}
          onComplete={() => { onComplete(sel); setSel(null); }} onClose={() => setSel(null)} />}
      </Sheet>
    </div>
  );
}

function navBtn(theme) {
  return { width: 30, height: 30, borderRadius: 30, border: 'none', cursor: 'pointer',
    background: theme.chip, display: 'flex', alignItems: 'center', justifyContent: 'center' };
}

function Metric({ theme, label, value }) {
  return (
    <div>
      <div style={{ fontFamily: theme.font, fontSize: 10.5, fontWeight: 600, color: theme.textFaint, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontFamily: theme.num, fontSize: 18, fontWeight: 700, color: theme.text, fontFeatureSettings: theme.numFeat, marginTop: 1 }}>{value}</div>
    </div>
  );
}

function Legend({ theme }) {
  const { Icon, TYPE_ICON } = window;
  const items = [['easy', 'Easy'], ['long', 'Long'], ['speed', 'Intervals'], ['tempo', 'Tempo'], ['recovery', 'Recovery'], ['cross', 'Cross'], ['rest', 'Rest']];
  const dot = (c) => <span style={{ width: 7, height: 7, borderRadius: 7, background: c, display: 'inline-block' }} />;
  return (
    <div style={{ padding: '12px 4px 0', marginTop: 6, borderTop: `1px solid ${theme.hairline}`, display: 'flex', flexDirection: 'column', gap: 9 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px 12px' }}>
        {items.map(([t, l]) => (
          <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Icon name={TYPE_ICON[t]} size={14} stroke={2} color={theme.textMute} />
            <span style={{ fontFamily: theme.font, fontSize: 11, color: theme.textMute }}>{l}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>{dot(theme.textFaint)}<span style={{ fontFamily: theme.font, fontSize: 11, color: theme.textMute }}>Planned</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>{dot(theme.accent)}<span style={{ fontFamily: theme.font, fontSize: 11, color: theme.textMute }}>Completed</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>{dot(theme.types.race.c)}<span style={{ fontFamily: theme.font, fontSize: 11, color: theme.textMute }}>Missed</span></div>
      </div>
    </div>
  );
}

// ── Workout detail body ──
function WorkoutDetail({ theme, date, status, onComplete, onClose }) {
  const { Icon, Avatar } = window;
  const { PLAN, WTYPES, TYPE_ICON, typeColor, fmtLong, COACH } = window;
  const w = PLAN[date]; if (!w) return null;
  const tc = { c: theme.textMute, soft: theme.chip };
  const done = status === 'done'; const missed = status === 'missed'; const isRest = w.type === 'rest';

  return (
    <div style={{ padding: '8px 20px 0' }}>
      {/* type chip + close */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: tc.soft, color: tc.c,
          padding: '6px 12px 6px 10px', borderRadius: 20 }}>
          <Icon name={TYPE_ICON[w.type]} size={17} stroke={2} />
          <span style={{ fontFamily: theme.font, fontSize: 13, fontWeight: 700, letterSpacing: 0.2 }}>{WTYPES[w.type].label}</span>
        </div>
        <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 30, border: 'none', background: theme.chip, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.textMute, fontSize: 17, fontWeight: 600 }}>✕</button>
      </div>

      <div style={{ fontFamily: theme.font, fontSize: 13, color: theme.textMute, fontWeight: 500 }}>{fmtLong(date)}</div>
      <h2 style={{ margin: '2px 0 0', fontFamily: theme.display, fontSize: 27, fontWeight: theme.headerStyle === 'serif' ? 600 : 700, color: theme.text, letterSpacing: -0.4 }}>{w.title}</h2>

      {/* target stats */}
      {w.dist && (
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <StatBox theme={theme} label="Distance" value={`${w.dist}`} unit="mi" />
          <StatBox theme={theme} label="Target Pace" value={w.pace.replace('/mi', '')} unit="/mi" />
          {window.estMinutes(w) > 0 && <StatBox theme={theme} label="Est. Time" value={window.fmtDur(window.estMinutes(w))} unit="" />}
        </div>
      )}

      {/* structured sets */}
      {w.sets && (
        <div style={{ marginTop: 18 }}>
          <SectionLabel theme={theme}>Workout structure</SectionLabel>
          <div style={{ background: theme.surface, borderRadius: theme.radius, overflow: 'hidden', boxShadow: theme.cardShadow }}>
            {w.sets.map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '13px 16px', alignItems: 'center',
                borderTop: i ? `1px solid ${theme.hairline}` : 'none' }}>
                <div style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, background: tc.soft, color: tc.c,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.num, fontSize: 13, fontWeight: 700 }}>{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: theme.font, fontSize: 14.5, fontWeight: 650, color: theme.text }}>{s[0]}</div>
                  <div style={{ fontFamily: theme.font, fontSize: 12.5, color: theme.textMute, marginTop: 1 }}>{s[1]}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* coach note */}
      {w.note && (
        <div style={{ marginTop: 18 }}>
          <SectionLabel theme={theme}>Coach's note</SectionLabel>
          <div style={{ display: 'flex', gap: 11, background: theme.surface, borderRadius: theme.radius, padding: 15, boxShadow: theme.cardShadow }}>
            <Avatar theme={theme} initials={COACH.initials} size={34} accent={theme.accent2} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: theme.font, fontSize: 12.5, fontWeight: 700, color: theme.text }}>{COACH.name}</div>
              <p style={{ margin: '3px 0 0', fontFamily: theme.font, fontSize: 14, lineHeight: 1.5, color: theme.textMute, textWrap: 'pretty' }}>{w.note}</p>
            </div>
          </div>
        </div>
      )}

      {/* actuals if done */}
      {done && w.actual && (
        <div style={{ marginTop: 18 }}>
          <SectionLabel theme={theme}>Your run · synced from Garmin</SectionLabel>
          <div style={{ background: theme.surface, borderRadius: theme.radius, padding: '14px 16px', boxShadow: theme.cardShadow }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px 8px' }}>
              <ActualStat theme={theme} label="Distance" value={`${w.actual.dist} mi`} />
              <ActualStat theme={theme} label="Avg pace" value={w.actual.pace.replace('/mi', '')} />
              <ActualStat theme={theme} label="Time" value={w.actual.time} />
              <ActualStat theme={theme} label="Avg HR" value={`${w.actual.hr}`} />
            </div>
          </div>
        </div>
      )}

      {/* action */}
      <div style={{ marginTop: 20, marginBottom: 6 }}>
        {done ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, padding: '15px',
            borderRadius: 16, background: theme.types.easy.soft, color: theme.accent, fontFamily: theme.font, fontSize: 15.5, fontWeight: 700 }}>
            <Icon name="check" size={20} stroke={3} /> Completed
          </div>
        ) : isRest ? (
          <div style={{ textAlign: 'center', padding: '15px', borderRadius: 16, background: theme.chip,
            color: theme.textMute, fontFamily: theme.font, fontSize: 14.5, fontWeight: 600 }}>
            Enjoy the rest — recovery is training too.
          </div>
        ) : (
          <button onClick={onComplete} style={{
            width: '100%', border: 'none', cursor: 'pointer', borderRadius: 16, padding: '16px',
            background: theme.accent, color: theme.onAccent, fontFamily: theme.font, fontSize: 16, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
            boxShadow: theme.dark ? 'none' : '0 6px 16px ' + theme.accent + '40',
          }}>
            <Icon name="check" size={20} stroke={2.8} /> Mark as complete
          </button>
        )}
      </div>
    </div>
  );
}

function StatBox({ theme, label, value, unit }) {
  return (
    <div style={{ flex: 1, background: theme.surface, borderRadius: theme.radiusSm, padding: '12px 14px', boxShadow: theme.cardShadow }}>
      <div style={{ fontFamily: theme.font, fontSize: 10.5, fontWeight: 600, color: theme.textFaint, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ marginTop: 3 }}>
        <span style={{ fontFamily: theme.num, fontSize: 23, fontWeight: 700, color: theme.text, fontFeatureSettings: theme.numFeat }}>{value}</span>
        <span style={{ fontFamily: theme.font, fontSize: 12, color: theme.textMute, marginLeft: 2 }}>{unit}</span>
      </div>
    </div>
  );
}

function ActualStat({ theme, label, value }) {
  return (
    <div style={{ width: '46%' }}>
      <div style={{ fontFamily: theme.font, fontSize: 11, color: theme.textMute }}>{label}</div>
      <div style={{ fontFamily: theme.num, fontSize: 19, fontWeight: 700, color: theme.text, fontFeatureSettings: theme.numFeat }}>{value}</div>
    </div>
  );
}

function SectionLabel({ theme, children }) {
  return <div style={{ fontFamily: theme.font, fontSize: 12, fontWeight: 700, color: theme.textMute, textTransform: 'uppercase', letterSpacing: 0.6, margin: '0 4px 8px' }}>{children}</div>;
}

Object.assign(window, { CalendarView, Metric, StatBox, ActualStat, SectionLabel, Legend });
