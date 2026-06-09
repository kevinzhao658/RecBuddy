// metrics.jsx — Stats view
// Exports to window: MetricsView

function MetricsView({ theme }) {
  const { Icon, BarChart, LineChart, Ring } = window;
  const { GOAL, WEEKLY, PACE_TREND, HR_ZONES, PRS, ADHERENCE, MON_SHORT, parseISO } = window;

  const weekTotal = WEEKLY[WEEKLY.length - 1];
  const prevTotal = WEEKLY[WEEKLY.length - 2];
  const planPct = Math.round((GOAL.planWeek / GOAL.planWeeks) * 100);
  const raceDt = parseISO(GOAL.date);
  const paceDelta = PACE_TREND[0].sec - PACE_TREND[PACE_TREND.length - 1].sec; // sec faster

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: theme.bg }}>
      <div style={{ flexShrink: 0, padding: '54px 20px 8px' }}>
        <h1 style={{ margin: 0, fontFamily: theme.display, fontSize: 29, whiteSpace: 'nowrap',
          fontWeight: theme.headerStyle === 'bold' ? 700 : (theme.headerStyle === 'serif' ? 600 : 700),
          color: theme.text, letterSpacing: theme.headerStyle === 'bold' ? -0.5 : -0.3 }}>Your Progress</h1>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ── GOAL RACE ── */}
        <div style={{ background: theme.dark ? theme.surface : theme.text, borderRadius: theme.radius, padding: 18, flexShrink: 0,
          boxShadow: theme.cardShadow, position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: theme.accent }}>
                <Icon name="trophy" size={15} stroke={2} />
                <span style={{ fontFamily: theme.font, fontSize: 11.5, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase' }}>Goal Race</span>
              </div>
              <div style={{ fontFamily: theme.display, fontSize: 20, fontWeight: theme.headerStyle === 'serif' ? 600 : 700,
                color: theme.dark ? theme.text : theme.bg, letterSpacing: -0.2, marginTop: 4, maxWidth: 180, lineHeight: 1.12 }}>{GOAL.race}</div>
              <div style={{ fontFamily: theme.font, fontSize: 13, color: theme.dark ? theme.textMute : 'rgba(255,255,255,0.6)', marginTop: 4 }}>
                {window.DOW[raceDt.getDay()]}, {MON_SHORT[raceDt.getMonth()]} {raceDt.getDate()} · {GOAL.distance}
              </div>
            </div>
            <Ring theme={theme} pct={planPct} size={86} stroke={8} color={theme.accent}
              track={theme.dark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.18)'}>
              <span style={{ fontFamily: theme.num, fontSize: 24, fontWeight: 700, color: theme.dark ? theme.text : '#fff', fontFeatureSettings: theme.numFeat, lineHeight: 1 }}>{GOAL.weeksToGo}</span>
              <span style={{ fontFamily: theme.font, fontSize: 9.5, color: theme.dark ? theme.textMute : 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>wks to go</span>
            </Ring>
          </div>
          <div style={{ display: 'flex', gap: 20, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${theme.dark ? theme.hairline : 'rgba(255,255,255,0.14)'}` }}>
            <GoalStat theme={theme} dark label="Goal time" value={GOAL.goalTime} />
            <GoalStat theme={theme} dark label="Goal pace" value={GOAL.goalPace.replace('/mi', '/mi')} />
            <GoalStat theme={theme} dark label="Plan" value={`${planPct}% done`} />
          </div>
        </div>

        {/* ── adherence + streak ── */}
        <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
          <div style={{ flex: 1, background: theme.surface, borderRadius: theme.radius, padding: 16, boxShadow: theme.cardShadow }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Ring theme={theme} pct={ADHERENCE.pct} size={54} stroke={6}>
                <span style={{ fontFamily: theme.num, fontSize: 14, fontWeight: 700, color: theme.text, fontFeatureSettings: theme.numFeat }}>{ADHERENCE.pct}</span>
              </Ring>
              <div>
                <div style={{ fontFamily: theme.num, fontSize: 17, fontWeight: 700, color: theme.text }}>{ADHERENCE.completed}/{ADHERENCE.planned}</div>
                <div style={{ fontFamily: theme.font, fontSize: 11.5, color: theme.textMute, fontWeight: 500 }}>workouts done</div>
              </div>
            </div>
            <div style={{ fontFamily: theme.font, fontSize: 12, color: theme.textMute, marginTop: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>Adherence</div>
          </div>
          <div style={{ flex: 1, background: theme.surface, borderRadius: theme.radius, padding: 16, boxShadow: theme.cardShadow }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{ width: 50, height: 50, borderRadius: 50, background: theme.types.speed.soft,
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="flame" size={26} stroke={1.8} color={theme.types.speed.c} fill={theme.types.speed.c + '30'} />
              </div>
              <div>
                <div style={{ fontFamily: theme.num, fontSize: 26, fontWeight: 700, color: theme.text, lineHeight: 1 }}>{ADHERENCE.streak}</div>
                <div style={{ fontFamily: theme.font, fontSize: 11.5, color: theme.textMute, fontWeight: 500 }}>day streak</div>
              </div>
            </div>
            <div style={{ fontFamily: theme.font, fontSize: 12, color: theme.textMute, marginTop: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>On a roll 🔥</div>
          </div>
        </div>

        {/* ── weekly mileage ── */}
        <Card theme={theme} title="Weekly Mileage" right={
          <Delta theme={theme} up={weekTotal.done >= prevTotal.done} text="this week" />
        }>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '2px 0 10px' }}>
            <span style={{ fontFamily: theme.num, fontSize: 32, fontWeight: 700, color: theme.text, fontFeatureSettings: theme.numFeat, lineHeight: 1 }}>{weekTotal.done}</span>
            <span style={{ fontFamily: theme.font, fontSize: 14, color: theme.textMute }}>/ {weekTotal.planned} mi planned</span>
          </div>
          <BarChart theme={theme} data={WEEKLY} />
          <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
            <LegendDot theme={theme} c={theme.accent} label="Completed" />
            <LegendDot theme={theme} c={theme.dark ? 'rgba(255,255,255,0.12)' : 'rgba(40,40,46,0.1)'} label="Planned" />
          </div>
        </Card>

        {/* ── pace trend ── */}
        <Card theme={theme} title="Easy-Pace Trend" right={
          <span style={{ fontFamily: theme.font, fontSize: 12.5, fontWeight: 700, color: theme.accent,
            display: 'flex', alignItems: 'center', gap: 3 }}>
            <Icon name="chevron" size={13} stroke={3} color={theme.accent} style={{ transform: 'rotate(-90deg)' }} />
            {paceDelta}s faster
          </span>
        }>
          <div style={{ fontFamily: theme.font, fontSize: 12.5, color: theme.textMute, marginBottom: 6 }}>
            Avg easy pace, last 4 weeks — lower is faster
          </div>
          <LineChart theme={theme} data={PACE_TREND} />
        </Card>

        {/* ── HR zones ── */}
        <Card theme={theme} title="Heart-Rate Zones" right={<span style={{ fontFamily: theme.font, fontSize: 12, color: theme.textFaint }}>last 7 days</span>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
            {HR_ZONES.map((z, i) => {
              const cols = [theme.types.recovery.c, theme.accent, theme.types.tempo.c, theme.types.speed.c, theme.types.race.c];
              return (
                <div key={z.z} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 22, fontFamily: theme.num, fontSize: 13, fontWeight: 700, color: cols[i] }}>{z.z}</div>
                  <div style={{ width: 60, fontFamily: theme.font, fontSize: 12, color: theme.text, fontWeight: 500 }}>{z.label}</div>
                  <div style={{ flex: 1, height: 10, borderRadius: 6, background: theme.chip, overflow: 'hidden' }}>
                    <div style={{ width: `${z.pct}%`, height: '100%', borderRadius: 6, background: cols[i],
                      transition: 'width .8s cubic-bezier(.32,.72,0,1)' }} />
                  </div>
                  <div style={{ width: 32, textAlign: 'right', fontFamily: theme.num, fontSize: 12.5, fontWeight: 700, color: theme.text, fontFeatureSettings: theme.numFeat }}>{z.pct}%</div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* ── PRs ── */}
        <Card theme={theme} title="Personal Records">
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {PRS.map((p, i) => (
              <div key={p.dist} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0',
                borderTop: i ? `1px solid ${theme.hairline}` : 'none' }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                  background: p.fresh ? theme.accent2 + '22' : theme.chip, color: p.fresh ? theme.accent2 : theme.textMute,
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="trophy" size={17} stroke={2} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: theme.font, fontSize: 14.5, fontWeight: 650, color: theme.text }}>{p.dist}</div>
                  <div style={{ fontFamily: theme.font, fontSize: 11.5, color: theme.textMute }}>{p.when}</div>
                </div>
                {p.fresh && <span style={{ fontFamily: theme.font, fontSize: 10, fontWeight: 700, color: theme.accent2,
                  background: theme.accent2 + '1f', padding: '3px 8px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: 0.5 }}>New</span>}
                <div style={{ fontFamily: theme.num, fontSize: 19, fontWeight: 700, color: theme.text, fontFeatureSettings: theme.numFeat }}>{p.time}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Card({ theme, title, right, children }) {
  return (
    <div style={{ background: theme.surface, borderRadius: theme.radius, padding: 16, boxShadow: theme.cardShadow, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h3 style={{ margin: 0, fontFamily: theme.display, fontSize: 16, whiteSpace: 'nowrap', fontWeight: theme.headerStyle === 'serif' ? 600 : 700, color: theme.text, letterSpacing: -0.2 }}>{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

function GoalStat({ theme, label, value, dark }) {
  const lc = dark ? (theme.dark ? theme.textMute : 'rgba(255,255,255,0.55)') : theme.textMute;
  const vc = dark ? (theme.dark ? theme.text : '#fff') : theme.text;
  return (
    <div>
      <div style={{ fontFamily: theme.font, fontSize: 10.5, fontWeight: 600, color: lc, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontFamily: theme.num, fontSize: 17, fontWeight: 700, color: vc, fontFeatureSettings: theme.numFeat, marginTop: 2, whiteSpace: 'nowrap' }}>{value}</div>
    </div>
  );
}

function Delta({ theme, up, text }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: theme.font, fontSize: 12, fontWeight: 600,
      color: theme.textMute }}>{text}</span>
  );
}

function LegendDot({ theme, c, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 9, height: 9, borderRadius: 3, background: c }} />
      <span style={{ fontFamily: theme.font, fontSize: 11.5, color: theme.textMute }}>{label}</span>
    </div>
  );
}

Object.assign(window, { MetricsView, Card });
