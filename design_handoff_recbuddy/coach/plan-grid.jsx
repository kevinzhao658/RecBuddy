// plan-grid.jsx — coach week plan grid
// Color encodes COMPLETION only: gray = pending, green = done, red = missed.
// Workout TYPE is a small neutral icon tucked in the corner (see legend).
// Exports to window: PlanGrid

function PlanGrid({ theme, week, selectedId, onSelect, onMove, dragRef, dragActive, onPlace, clipboard, onCopy, onPaste }) {
  const { Icon, TYPE_ICON } = window;
  const localSrcRef = React.useRef(null);
  const [dragSrc, setDragSrc] = React.useState(null);
  const [dragOver, setDragOver] = React.useState(null);
  const endDrag = () => { localSrcRef.current = null; setDragSrc(null); setDragOver(null); };

  const handleDrop = (i) => {
    const p = dragRef && dragRef.current;
    if (p && p.kind === 'template') { onPlace(i, p.tpl); }
    else { const src = localSrcRef.current; if (src !== null && src !== i) onMove(src, i); }
    endDrag();
  };

  const green = theme.accent;
  const red = theme.types.race.c;
  const ringSel = theme.dark ? 'rgba(247,244,238,0.22)' : 'rgba(40,40,46,0.16)';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 12, alignItems: 'stretch' }}>
      {week.map((d, i) => {
        const w = d.w;
        const sel = d.id === selectedId;
        const over = dragOver === i && (dragSrc !== null || (dragRef && dragRef.current && dragRef.current.kind === 'template')) && dragSrc !== i;
        const isToday = d.status === 'today';
        const done = d.status === 'done';
        const missed = d.status === 'missed';

        const cardBg = done ? theme.types.easy.soft : missed ? theme.types.race.soft : theme.surface;
        const cardBorder = done ? green : missed ? red : theme.line;
        const statusColor = done ? green : missed ? red : theme.textMute;
        const statusLabel = done ? 'Completed' : missed ? 'Missed' : (d.status === 'rest' ? 'Rest day' : 'Planned');

        const shadows = [theme.cardShadow];
        if (isToday) shadows.unshift(`0 0 0 2px ${theme.text}`);
        if (sel) shadows.unshift(`0 0 0 3px ${ringSel}`);

        return (
          <div key={d.id}
            onDragOver={e => { e.preventDefault(); setDragOver(i); }}
            onDragLeave={() => setDragOver(o => o === i ? null : o)}
            onDrop={e => { e.preventDefault(); handleDrop(i); }}
            style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>

            {/* column header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0 2px', minHeight: 22 }}>
              {isToday ? (
                <span style={{ fontFamily: theme.font, fontSize: 10, fontWeight: 800, letterSpacing: 0.6,
                  background: theme.text, color: theme.bg, padding: '3px 8px', borderRadius: 6, textTransform: 'uppercase' }}>Today</span>
              ) : (
                <span style={{ fontFamily: theme.font, fontSize: 12.5, fontWeight: 700, color: theme.text }}>{d.dow}</span>
              )}
              <span style={{ fontFamily: theme.font, fontSize: 11.5, color: theme.textFaint }}>{d.date}</span>
            </div>

            {/* card or empty slot */}
            {w ? (
              <div
                role="button" tabIndex={0}
                draggable
                onDragStart={e => { localSrcRef.current = i; setDragSrc(i); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)); }}
                onDragEnd={endDrag}
                onClick={() => onSelect(d.id)}
                style={{
                  flex: 1, textAlign: 'left', cursor: 'grab', borderRadius: 16, padding: 13,
                  background: cardBg,
                  border: `1.5px solid ${over || sel ? theme.text : cardBorder}`,
                  boxShadow: shadows.join(', '),
                  opacity: dragSrc === i ? 0.4 : 1, position: 'relative', overflow: 'hidden',
                  display: 'flex', flexDirection: 'column', gap: 10,
                }}>
                {/* type icon — tucked in corner, neutral */}
                <div style={{ position: 'absolute', top: 11, right: 11, opacity: 0.85 }}>
                  <Icon name={TYPE_ICON[w.type]} size={15} stroke={2} color={theme.textMute} />
                </div>

                <div style={{ flex: 1, paddingRight: 20 }}>
                  <div style={{ fontFamily: theme.font, fontSize: 14.5, fontWeight: 700, color: theme.text, lineHeight: 1.2, textWrap: 'balance' }}>{w.title}</div>
                  {w.dist != null && (
                    <div style={{ fontFamily: theme.num, fontSize: 12.5, color: theme.textMute, marginTop: 3, fontFeatureSettings: theme.numFeat }}>
                      {w.dist} mi{w.pace ? ` · ${w.pace}` : ''}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 5, paddingTop: 8, borderTop: `1px solid ${theme.hairline}` }}>
                  {done ? <Icon name="check" size={13} stroke={3} color={green} />
                    : missed ? <Icon name="cross" size={13} stroke={2.4} color={red} />
                    : <span style={{ width: 6, height: 6, borderRadius: 6, background: theme.textFaint }} />}
                  <span style={{ fontFamily: theme.font, fontSize: 10.5, fontWeight: 700, color: statusColor }}>{statusLabel}</span>
                  {onCopy && (
                    <button onClick={e => { e.stopPropagation(); onCopy(w); }} title="Copy workout"
                      style={{ marginLeft: 'auto', width: 26, height: 26, borderRadius: 8, flexShrink: 0, cursor: 'pointer',
                        border: 'none', background: 'transparent', color: theme.textMute,
                        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="copy" size={15} stroke={2} />
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 150 }}>
                {clipboard && onPaste && (
                  <button onClick={() => onPaste(i)} title={`Paste ${clipboard.title}`} style={{
                    flexShrink: 0, cursor: 'pointer', borderRadius: 14, padding: '11px 12px',
                    border: `1.5px dashed ${theme.line}`, background: 'transparent',
                    display: 'flex', alignItems: 'center', gap: 8, color: theme.textMute, textAlign: 'left' }}>
                    <Icon name="clipboard" size={16} stroke={2} color={theme.textMute} />
                    <span style={{ flex: 1, minWidth: 0, fontFamily: theme.font, fontSize: 12, fontWeight: 600,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Paste {clipboard.title}</span>
                  </button>
                )}
                <button onClick={() => onSelect(d.id)} style={{
                  flex: 1, cursor: 'pointer', borderRadius: 16,
                  border: `1.5px dashed ${over ? theme.text : theme.line}`,
                  background: over ? theme.chip : 'transparent',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
                  color: sel ? theme.text : theme.textFaint,
                  boxShadow: isToday ? `0 0 0 2px ${theme.text}` : 'none',
                }}>
                  <Icon name="plus" size={22} stroke={2} color={sel ? theme.text : theme.textFaint} />
                  <span style={{ fontFamily: theme.font, fontSize: 12, fontWeight: 600 }}>Add</span>
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Legend — icon → workout type key + completion color key
function PlanLegend({ theme }) {
  const { Icon, WTYPES, TYPE_ICON } = window;
  const types = ['easy', 'long', 'speed', 'tempo', 'recovery', 'cross', 'rest'];
  const labels = { easy: 'Easy', long: 'Long', speed: 'Intervals', tempo: 'Tempo', recovery: 'Recovery', cross: 'Cross-train', rest: 'Rest' };
  const dot = (c) => <span style={{ width: 8, height: 8, borderRadius: 8, background: c, display: 'inline-block' }} />;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px 22px', padding: '16px 18px',
      background: theme.surface, borderRadius: 14, border: `1px solid ${theme.line}`, marginTop: 18 }}>
      <span style={{ fontFamily: theme.font, fontSize: 11, fontWeight: 700, color: theme.textFaint, textTransform: 'uppercase', letterSpacing: 0.6 }}>Workout key</span>
      {types.map(t => (
        <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name={TYPE_ICON[t]} size={15} stroke={2} color={theme.textMute} />
          <span style={{ fontFamily: theme.font, fontSize: 12, color: theme.textMute }}>{labels[t]}</span>
        </div>
      ))}
      <span style={{ width: 1, height: 16, background: theme.line }} />
      <span style={{ fontFamily: theme.font, fontSize: 11, fontWeight: 700, color: theme.textFaint, textTransform: 'uppercase', letterSpacing: 0.6 }}>Status</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{dot(theme.textFaint)}<span style={{ fontFamily: theme.font, fontSize: 12, color: theme.textMute }}>Planned</span></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{dot(theme.accent)}<span style={{ fontFamily: theme.font, fontSize: 12, color: theme.textMute }}>Completed</span></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{dot(theme.types.race.c)}<span style={{ fontFamily: theme.font, fontSize: 12, color: theme.textMute }}>Missed</span></div>
    </div>
  );
}

Object.assign(window, { PlanGrid, PlanLegend });
