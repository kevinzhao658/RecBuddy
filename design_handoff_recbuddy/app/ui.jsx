// ui.jsx — icons, chart primitives, shared shell components
// Exports to window: Icon, TypeDot, Sheet, TabBar, Segmented,
//                    BarChart, LineChart, Ring, Avatar

// ─────────────────────────────────────────────────────────────
// Icon — stroke line icons, currentColor
// ─────────────────────────────────────────────────────────────
const PATHS = {
  calendar: 'M7 3v3M17 3v3M4 8h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z',
  chat: 'M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-4 4V6a1 1 0 0 1 1-1Z',
  metrics: 'M5 19V11M10 19V5M15 19v-6M20 19v-9',
  run: 'M13.5 5.5a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2ZM8 21l2.5-5 2-1.8-1-4.7-3 2.2-1 3M12.5 9.5l2.5 1.5 1 3 2.5 1M9.5 8l3-1.7 2.5 1.2 2.2-.6',
  check: 'M5 12.5l4.5 4.5L19 7',
  clock: 'M12 7v5l3.5 2M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18Z',
  heart: 'M12 20s-7-4.3-7-9.3A3.7 3.7 0 0 1 12 7.5 3.7 3.7 0 0 1 19 10.7c0 5-7 9.3-7 9.3Z',
  flame: 'M12 3s4 3.5 4 8a4 4 0 0 1-8 0c0-1.4.6-2.6 1.2-3.4C9.7 8.3 12 9 12 11c0-2.5-1-5.5 0-8Z',
  trophy: 'M7 4h10v3a5 5 0 0 1-10 0V4ZM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M9 14h6M10 18h4M12 14v4',
  chevron: 'M9 6l6 6-6 6',
  chevronL: 'M15 6l-6 6 6 6',
  plus: 'M12 5v14M5 12h14',
  ellipsis: 'M6 12h.01M12 12h.01M18 12h.01',
  send: 'M5 12l15-7-5 15-3-6-7-2Z',
  sync: 'M4 9a8 8 0 0 1 13.5-3.5L20 8M20 15a8 8 0 0 1-13.5 3.5L4 16M20 4v4h-4M4 20v-4h4',
  bolt: 'M13 3L5 13h6l-1 8 8-10h-6l1-8Z',
  target: 'M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18ZM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8ZM12 12h.01',
  mountain: 'M3 19l6-11 4 6 2-3 6 8H3Z',
  stopwatch: 'M12 22a8 8 0 1 1 0-16 8 8 0 0 1 0 16ZM12 14V9M9 2h6M19 5l1.5 1.5',
  route: 'M7 20a2 2 0 1 1 0-4 2 2 0 0 1 0 4ZM17 8a2 2 0 1 1 0-4 2 2 0 0 1 0 4ZM17 8c0 4-10 4-10 8',
  rest: 'M4 12a8 8 0 1 0 16 0 8 8 0 0 0-16 0ZM9 9h6l-6 6h6',
  edit: 'M5 19h14M14 5l4 4-9 9H5v-4l9-9Z',
  back: 'M15 6l-6 6 6 6',
  camera: 'M5 8h3l1.5-2h5L16 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1ZM12 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  cross: 'M12 8v8M8 12h8M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18Z',
  logout: 'M16 17l5-5-5-5M21 12H9M12 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M5 11h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z',
  mail: 'M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1ZM4 7l8 6 8-6',
  copy: 'M9 9h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1ZM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1',
  clipboard: 'M9 4h6v3H9V4ZM7 5H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM20 20l-4-4',
  trash: 'M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M10 11v6M14 11v6',
};

function Icon({ name, size = 22, stroke = 2, color = 'currentColor', fill = 'none', style = {} }) {
  const d = PATHS[name] || '';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color}
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      style={{ display: 'block', flexShrink: 0, ...style }}>
      <path d={d} />
    </svg>
  );
}

// glyph for a workout type
const TYPE_ICON = { easy: 'run', long: 'mountain', speed: 'bolt', tempo: 'stopwatch',
  recovery: 'heart', cross: 'cross', rest: 'rest', race: 'trophy' };

function TypeDot({ theme, type, size = 10 }) {
  const { c } = window.typeColor(theme, type);
  return <span style={{ width: size, height: size, borderRadius: size, background: c, display: 'inline-block', flexShrink: 0 }} />;
}

// ─────────────────────────────────────────────────────────────
// Avatar
// ─────────────────────────────────────────────────────────────
function Avatar({ theme, initials, size = 40, accent, textColor }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size, flexShrink: 0,
      background: accent || theme.accent, color: textColor || theme.onAccent,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: theme.font, fontWeight: 600, fontSize: size * 0.4,
      letterSpacing: 0.2,
    }}>{initials}</div>
  );
}

// ─────────────────────────────────────────────────────────────
// Segmented control (iOS style)
// ─────────────────────────────────────────────────────────────
function Segmented({ theme, options, value, onChange }) {
  return (
    <div style={{
      display: 'flex', background: theme.dark ? 'rgba(255,255,255,0.07)' : 'rgba(40,40,46,0.06)',
      borderRadius: 11, padding: 2, gap: 2,
    }}>
      {options.map(o => {
        const active = o.value === value;
        return (
          <button key={o.value} onClick={() => onChange(o.value)} style={{
            flex: 1, border: 'none', cursor: 'pointer', borderRadius: 9,
            padding: '7px 4px', fontFamily: theme.font, fontSize: 13.5, fontWeight: 600,
            background: active ? theme.surface : 'transparent',
            color: active ? theme.text : theme.textMute,
            boxShadow: active ? (theme.dark ? '0 1px 3px rgba(0,0,0,0.4)' : '0 1px 3px rgba(0,0,0,0.12)') : 'none',
            transition: 'all .18s ease',
          }}>{o.label}</button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Bottom sheet (in-device overlay)
// ─────────────────────────────────────────────────────────────
function Sheet({ theme, open, onClose, children }) {
  const [mounted, setMounted] = React.useState(open);
  React.useEffect(() => {
    if (open) { setMounted(true); return; }
    const t = setTimeout(() => setMounted(false), 260);
    return () => clearTimeout(t);
  }, [open]);
  if (!mounted && !open) return null;
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 80, pointerEvents: 'auto', overflow: 'hidden',
    }}>
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.42)',
        opacity: open ? 1 : 0,
      }} />
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        background: theme.bg, borderTopLeftRadius: 30, borderTopRightRadius: 30,
        maxHeight: '88%', display: 'flex', flexDirection: 'column',
        transform: open ? 'translateY(0)' : 'translateY(102%)',
        animation: open ? 'rbSheetIn .3s cubic-bezier(.32,.72,0,1) both' : 'none',
        boxShadow: '0 -10px 40px rgba(0,0,0,0.22)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, flexShrink: 0 }}>
          <div style={{ width: 38, height: 5, borderRadius: 5, background: theme.textFaint }} />
        </div>
        <div style={{ overflowY: 'auto', padding: '8px 0 34px' }}>{children}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Bottom tab bar
// ─────────────────────────────────────────────────────────────
function TabBar({ theme, active, onChange }) {
  const tabs = [
    { id: 'calendar', label: 'Calendar', icon: 'calendar' },
    { id: 'chat', label: 'Chat', icon: 'chat' },
  ];
  const inactive = theme.dark ? 'rgba(247,244,238,0.62)' : 'rgba(40,40,46,0.55)';
  return (
    <div style={{
      flexShrink: 0, display: 'flex', gap: 8, paddingBottom: 22, paddingTop: 10, paddingLeft: 16, paddingRight: 16,
      background: theme.surface,
      borderTop: `1px solid ${theme.line}`,
      boxShadow: theme.dark ? '0 -6px 20px rgba(0,0,0,0.45)' : '0 -6px 20px rgba(20,20,30,0.06)',
    }}>
      {tabs.map(t => {
        const on = t.id === active;
        return (
          <button key={t.id} onClick={() => onChange(t.id)} style={{
            flex: 1, border: 'none', cursor: 'pointer', borderRadius: 16,
            background: on ? (theme.dark ? theme.types.easy.soft : theme.types.easy.soft) : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 0',
            transition: 'background .2s ease',
          }}>
            <Icon name={t.icon} size={22} stroke={on ? 2.3 : 2}
              color={on ? theme.accent : inactive} />
            <span style={{ fontFamily: theme.font, fontSize: 14, fontWeight: on ? 700 : 550,
              color: on ? theme.accent : inactive, letterSpacing: 0.1 }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CHARTS
// ─────────────────────────────────────────────────────────────
// Vertical bar chart — weekly mileage (done vs planned ghost)
function BarChart({ theme, data, height = 132 }) {
  const max = Math.max(...data.map(d => Math.max(d.done, d.planned))) * 1.1;
  const W = 300, H = height, pad = 4, n = data.length;
  const bw = (W - pad * 2) / n;
  const barW = bw * 0.52;
  return (
    <svg viewBox={`0 0 ${W} ${H + 22}`} width="100%" style={{ display: 'block', overflow: 'visible' }}>
      {data.map((d, i) => {
        const x = pad + i * bw + bw / 2;
        const ph = (d.planned / max) * H;
        const dh = (d.done / max) * H;
        const col = d.partial ? theme.accent2 : theme.accent;
        return (
          <g key={i}>
            {/* planned ghost */}
            <rect x={x - barW / 2} y={H - ph} width={barW} height={ph} rx={barW / 2.6}
              fill={theme.dark ? 'rgba(255,255,255,0.07)' : 'rgba(40,40,46,0.06)'} />
            {/* done */}
            <rect x={x - barW / 2} y={H - dh} width={barW} height={dh} rx={barW / 2.6} fill={col} />
            <text x={x} y={H + 15} textAnchor="middle"
              fontFamily={theme.font} fontSize="9.5" fill={theme.textFaint}>{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

// Line chart — pace trend (sec/mi; lower=faster so we flip)
function LineChart({ theme, data, height = 120 }) {
  const W = 300, H = height, padX = 6, padY = 14;
  const vals = data.map(d => d.sec);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = (max - min) || 1;
  const x = i => padX + (i / (data.length - 1)) * (W - padX * 2);
  const y = v => padY + (1 - (max - v) / span) * (H - padY * 2) * -1 + (H - padY); // invert
  const yy = v => padY + ((v - min) / span) * (H - padY * 2);
  const pts = data.map((d, i) => [x(i), yy(d.sec)]);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${path} L${x(data.length - 1)} ${H} L${x(0)} ${H} Z`;
  const gid = `pg-${theme.id}`;
  return (
    <svg viewBox={`0 0 ${W} ${H + 18}`} width="100%" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={theme.accent} stopOpacity="0.22" />
          <stop offset="1" stopColor={theme.accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={path} fill="none" stroke={theme.accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={i === pts.length - 1 ? 4 : 2.6}
          fill={i === pts.length - 1 ? theme.accent : theme.surface} stroke={theme.accent} strokeWidth="2" />
      ))}
      {data.map((d, i) => (i % 2 === 0 || i === data.length - 1) && (
        <text key={i} x={x(i)} y={H + 13} textAnchor="middle"
          fontFamily={theme.font} fontSize="9.5" fill={theme.textFaint}>{d.d}</text>
      ))}
    </svg>
  );
}

// Progress ring
function Ring({ theme, pct, size = 88, stroke = 9, color, track, children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - pct / 100);
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke}
          stroke={track || (theme.dark ? 'rgba(255,255,255,0.09)' : 'rgba(40,40,46,0.08)')} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke}
          stroke={color || theme.accent} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={off}
          style={{ transition: 'stroke-dashoffset .9s cubic-bezier(.32,.72,0,1)' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center' }}>{children}</div>
    </div>
  );
}

Object.assign(window, {
  Icon, TYPE_ICON, TypeDot, Avatar, Segmented, Sheet, TabBar, BarChart, LineChart, Ring,
});
