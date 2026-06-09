// editor.jsx — coach workout editor panel (right side)
// Exports to window: WorkoutEditor

function WorkoutEditor({ theme, day, onChange, onClear, onClose }) {
  const { Icon, WTYPES, TYPE_ICON, typeColor, WTYPE_LIST, blankWorkout } = window;
  const w = day ? day.w : null;
  const clearLabel = (day && day.clearLabel) || 'Clear day';

  const inputStyle = {
    width: '100%', boxSizing: 'border-box', border: `1px solid ${theme.line}`,
    background: theme.surface2, color: theme.text, borderRadius: 10,
    padding: '10px 12px', fontFamily: theme.font, fontSize: 14, outline: 'none',
  };
  const labelStyle = { fontFamily: theme.font, fontSize: 11, fontWeight: 700, color: theme.textMute,
    textTransform: 'uppercase', letterSpacing: 0.6, display: 'block', marginBottom: 7 };

  const patch = (p) => onChange({ ...w, ...p });

  // ── empty day → add workout ──
  if (!w || w.type === 'rest') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: theme.surface,
        borderLeft: `1px solid ${theme.line}` }}>
        <EditorHeader theme={theme} day={day} onClose={onClose} subtitle={w ? 'Rest day' : 'No session planned'} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 28, textAlign: 'center', gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: theme.chip, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="plus" size={28} stroke={2} color={theme.textMute} />
          </div>
          <div>
            <div style={{ fontFamily: theme.display, fontSize: 17, fontWeight: 700, color: theme.text }}>{w ? 'Rest day' : 'Empty day'}</div>
            <div style={{ fontFamily: theme.font, fontSize: 13, color: theme.textMute, marginTop: 4, maxWidth: 220 }}>
              {w ? 'A planned recovery day.' : 'Add a workout to build out this client\u2019s week.'}
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 260 }}>
            {WTYPE_LIST.filter(t => t !== 'rest').map(t => {
              return (
                <button key={t} onClick={() => onChange(blankWorkout(t))} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${theme.line}`,
                  background: theme.surface2, cursor: 'pointer', borderRadius: 20, padding: '8px 13px',
                }}>
                  <Icon name={TYPE_ICON[t]} size={15} stroke={2} color={theme.textMute} />
                  <span style={{ fontFamily: theme.font, fontSize: 13, fontWeight: 600, color: theme.text }}>{WTYPES[t].short}</span>
                </button>
              );
            })}
          </div>
          {w && (
            <button onClick={() => onChange(blankWorkout('easy'))} style={ghostBtn(theme)}>Replace rest with a run</button>
          )}
        </div>
      </div>
    );
  }

  const tc = { c: theme.textMute, soft: theme.chip };
  const showStruct = w.type !== 'cross';

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: theme.surface, borderLeft: `1px solid ${theme.line}` }}>
      <EditorHeader theme={theme} day={day} onClose={onClose} subtitle={WTYPES[w.type].label} tc={tc} icon={TYPE_ICON[w.type]} />

      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px 8px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* type */}
        <div>
          <span style={labelStyle}>Workout type</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {WTYPE_LIST.map(t => {
              const on = t === w.type;
              return (
                <button key={t} onClick={() => patch(t === 'rest' ? { type: 'rest', title: 'Rest Day', dist: null, pace: null, sets: [] } : { type: t })} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', borderRadius: 18, padding: '7px 11px',
                  border: `1.5px solid ${on ? theme.text : theme.line}`,
                  background: on ? theme.chip : 'transparent',
                }}>
                  <Icon name={TYPE_ICON[t]} size={14} stroke={2} color={on ? theme.text : theme.textMute} />
                  <span style={{ fontFamily: theme.font, fontSize: 12.5, fontWeight: on ? 700 : 600, color: on ? theme.text : theme.textMute }}>{WTYPES[t].short}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* title */}
        <div>
          <span style={labelStyle}>Title</span>
          <input value={w.title} onChange={e => patch({ title: e.target.value })} style={inputStyle} placeholder="Workout title" />
        </div>

        {/* distance + pace */}
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <span style={labelStyle}>Distance (mi)</span>
            <input value={w.dist == null ? '' : w.dist} onChange={e => patch({ dist: e.target.value === '' ? null : parseFloat(e.target.value) || 0 })}
              type="number" step="0.5" min="0" style={inputStyle} placeholder="—" />
          </div>
          <div style={{ flex: 1 }}>
            <span style={labelStyle}>Target pace</span>
            <input value={w.pace || ''} onChange={e => patch({ pace: e.target.value || null })} style={inputStyle} placeholder="e.g. 8:30/mi" />
          </div>
        </div>

        {/* est. time — auto from dist × pace, overridable; sums into the week */}
        <div>
          <span style={labelStyle}>Est. time (min)</span>
          <input value={w.est == null ? '' : w.est} type="number" min="0" step="5" style={inputStyle}
            onChange={e => patch({ est: e.target.value === '' ? null : (parseInt(e.target.value, 10) || 0) })}
            placeholder={`${window.estMinutes({ ...w, est: null })} (auto)`} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: theme.font, fontSize: 11.5, color: theme.textFaint, marginTop: 6 }}>
            <Icon name="clock" size={13} stroke={2} color={theme.textFaint} />
            Auto from distance × pace. Override for cross-training or strength. Feeds the week's projected time.
          </div>
        </div>

        {/* structured sets */}
        {showStruct && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
              <span style={{ ...labelStyle, marginBottom: 0 }}>Workout structure</span>
              <button onClick={() => patch({ sets: [...(w.sets || []), ['New phase', '']] })} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', background: 'transparent', cursor: 'pointer',
                color: theme.accent, fontFamily: theme.font, fontSize: 12.5, fontWeight: 700 }}>
                <Icon name="plus" size={14} stroke={2.6} color={theme.accent} /> Add phase
              </button>
            </div>
            {(!w.sets || w.sets.length === 0) ? (
              <div style={{ fontFamily: theme.font, fontSize: 13, color: theme.textFaint, padding: '12px 0' }}>
                No structured phases. Add warm-up, intervals, cool-down…
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {w.sets.map((s, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <div style={{ width: 22, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: theme.num, fontSize: 12, fontWeight: 700, color: tc.c, flexShrink: 0 }}>{i + 1}</div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <input value={s[0]} onChange={e => editSet(w, i, 0, e.target.value, patch)} style={{ ...inputStyle, padding: '8px 11px', fontWeight: 600 }} placeholder="Phase (e.g. 5 × 800m)" />
                      <input value={s[1]} onChange={e => editSet(w, i, 1, e.target.value, patch)} style={{ ...inputStyle, padding: '8px 11px', fontSize: 13 }} placeholder="Detail (e.g. @ 3:45, 400m jog)" />
                    </div>
                    <button onClick={() => patch({ sets: w.sets.filter((_, j) => j !== i) })} style={{
                      width: 30, height: 36, border: 'none', background: 'transparent', cursor: 'pointer', color: theme.textFaint,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon name="cross" size={17} stroke={2} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* coach note */}
        <div>
          <span style={labelStyle}>Coach's note</span>
          <textarea value={w.note || ''} onChange={e => patch({ note: e.target.value })} rows={3}
            style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }} placeholder="A note your athlete will see with this workout…" />
        </div>
      </div>

      {/* footer */}
      <div style={{ flexShrink: 0, display: 'flex', gap: 10, padding: '14px 20px', borderTop: `1px solid ${theme.line}` }}>
        <button onClick={onClear} style={{ ...ghostBtn(theme), flex: 'none', color: theme.types.race.c, borderColor: theme.types.race.c + '55' }}>
          <Icon name="cross" size={16} stroke={2} color={theme.types.race.c} /> {clearLabel}
        </button>
        <button onClick={onClose} style={{
          flex: 1, border: 'none', cursor: 'pointer', borderRadius: 11, padding: '12px',
          background: theme.accent, color: theme.onAccent, fontFamily: theme.font, fontSize: 14.5, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
          <Icon name="check" size={17} stroke={2.6} color={theme.onAccent} /> Done
        </button>
      </div>
    </div>
  );
}

function editSet(w, i, j, val, patch) {
  const sets = w.sets.map((s, k) => k === i ? (j === 0 ? [val, s[1]] : [s[0], val]) : s);
  patch({ sets });
}

function ghostBtn(theme) {
  return { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    border: `1px solid ${theme.line}`, background: 'transparent', cursor: 'pointer', borderRadius: 11,
    padding: '11px 14px', fontFamily: theme.font, fontSize: 13.5, fontWeight: 600, color: theme.text };
}

function EditorHeader({ theme, day, onClose, subtitle, tc, icon }) {
  const { Icon } = window;
  return (
    <div style={{ flexShrink: 0, padding: '18px 20px 16px', borderBottom: `1px solid ${theme.line}`,
      display: 'flex', alignItems: 'center', gap: 12 }}>
      {tc && (
        <div style={{ width: 40, height: 40, borderRadius: 12, background: tc.soft, color: tc.c, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={22} stroke={1.9} />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: theme.font, fontSize: 12, fontWeight: 700, color: theme.accent, letterSpacing: 0.3 }}>
          {day && day.contextLabel ? day.contextLabel : day ? `${day.dow} · ${day.date}` : 'Edit'}
        </div>
        <div style={{ fontFamily: theme.display, fontSize: 18, fontWeight: 700, color: theme.text, letterSpacing: -0.2 }}>{subtitle}</div>
      </div>
      <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 32, border: 'none', background: theme.chip, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.textMute, flexShrink: 0 }}>
        <Icon name="cross" size={18} stroke={2} />
      </button>
    </div>
  );
}

Object.assign(window, { WorkoutEditor });
