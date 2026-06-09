// coach-modals.jsx — Add-client modal + confirm dialog for the coach view
// Exports to window: AddClientModal, ConfirmDialog

function rbModalShell(theme, children, onClose, width) {
  return (
    <React.Fragment>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.55)' }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 301,
        width: width, maxWidth: '90%', background: theme.surface, border: `1px solid ${theme.line}`,
        borderRadius: 20, boxShadow: '0 30px 80px rgba(0,0,0,0.6)', overflow: 'hidden' }}>
        {children}
      </div>
    </React.Fragment>
  );
}

function ConfirmDialog({ theme, title, message, confirmLabel, danger, onConfirm, onCancel }) {
  const { Icon } = window;
  const accent = danger ? theme.types.race.c : theme.accent;
  return rbModalShell(theme, (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0, background: danger ? theme.types.race.soft : theme.chip,
          color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={danger ? 'trash' : 'check'} size={22} stroke={2} />
        </div>
        <div style={{ fontFamily: theme.display, fontSize: 21, fontWeight: 700, color: theme.text, letterSpacing: -0.3 }}>{title}</div>
      </div>
      <p style={{ margin: '0 0 20px', fontFamily: theme.font, fontSize: 14, lineHeight: 1.55, color: theme.textMute, textWrap: 'pretty' }}>{message}</p>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onCancel} style={{ flex: 1, cursor: 'pointer', borderRadius: 11, padding: '13px',
          border: `1px solid ${theme.line}`, background: 'transparent', color: theme.text, fontFamily: theme.font, fontSize: 14.5, fontWeight: 600 }}>Cancel</button>
        <button onClick={onConfirm} style={{ flex: 1, cursor: 'pointer', borderRadius: 11, padding: '13px', border: 'none',
          background: danger ? theme.types.race.c : theme.accent, color: danger ? '#fff' : theme.onAccent,
          fontFamily: theme.font, fontSize: 14.5, fontWeight: 700 }}>{confirmLabel || 'Confirm'}</button>
      </div>
    </div>
  ), onCancel, 400);
}

function AddClientModal({ theme, onAdd, onClose }) {
  const { Icon } = window;
  const [f, setF] = React.useState({ name: '', goal: '', goalDate: '', goalTime: '', level: '10K' });
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));
  const valid = f.name.trim().length > 1;

  const field = { width: '100%', boxSizing: 'border-box', background: theme.surface2, border: `1px solid ${theme.line}`,
    borderRadius: 10, padding: '11px 13px', color: theme.text, fontFamily: theme.font, fontSize: 14.5, outline: 'none' };
  const label = { fontFamily: theme.font, fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase',
    color: theme.textMute, display: 'block', marginBottom: 6 };
  const levels = ['5K', '10K', 'Half Marathon', 'Marathon'];

  const submit = (e) => { if (e) e.preventDefault(); if (valid) onAdd(f); };

  return rbModalShell(theme, (
    <form onSubmit={submit}>
      <div style={{ padding: '20px 24px', borderBottom: `1px solid ${theme.line}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ fontFamily: theme.display, fontSize: 22, fontWeight: 700, letterSpacing: -0.3, flex: 1 }}>Add an athlete</div>
        <button type="button" onClick={onClose} style={{ width: 32, height: 32, borderRadius: 32, border: 'none', cursor: 'pointer',
          background: theme.chip, color: theme.textMute, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="cross" size={18} stroke={2} />
        </button>
      </div>
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <span style={label}>Full name</span>
          <input style={field} value={f.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Alex Mercer" autoFocus />
        </div>
        <div>
          <span style={label}>Goal race</span>
          <input style={field} value={f.goal} onChange={e => set('goal', e.target.value)} placeholder="e.g. Boston Marathon" />
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}><span style={label}>Race date</span>
            <input style={field} value={f.goalDate} onChange={e => set('goalDate', e.target.value)} placeholder="e.g. Apr 20" /></div>
          <div style={{ flex: 1 }}><span style={label}>Goal time</span>
            <input style={field} value={f.goalTime} onChange={e => set('goalTime', e.target.value)} placeholder="e.g. 3:30" /></div>
        </div>
        <div>
          <span style={label}>Distance focus</span>
          <div style={{ display: 'flex', gap: 7 }}>
            {levels.map(l => (
              <button type="button" key={l} onClick={() => set('level', l)} style={{ flex: 1, cursor: 'pointer', borderRadius: 10, padding: '9px 4px',
                border: `1.5px solid ${f.level === l ? theme.text : theme.line}`, background: f.level === l ? theme.chip : 'transparent',
                fontFamily: theme.font, fontSize: 12, fontWeight: 700, color: f.level === l ? theme.text : theme.textMute }}>{l}</button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ padding: '14px 24px', borderTop: `1px solid ${theme.line}`, display: 'flex', gap: 10 }}>
        <button type="button" onClick={onClose} style={{ flex: 'none', cursor: 'pointer', borderRadius: 11, padding: '13px 18px',
          border: `1px solid ${theme.line}`, background: 'transparent', color: theme.text, fontFamily: theme.font, fontSize: 14.5, fontWeight: 600 }}>Cancel</button>
        <button type="submit" disabled={!valid} style={{ flex: 1, cursor: valid ? 'pointer' : 'default', opacity: valid ? 1 : 0.45, borderRadius: 11, padding: '13px', border: 'none',
          background: theme.accent, color: theme.onAccent, fontFamily: theme.font, fontSize: 15, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Icon name="plus" size={17} stroke={2.6} color={theme.onAccent} /> Add athlete
        </button>
      </div>
    </form>
  ), onClose, 440);
}

Object.assign(window, { AddClientModal, ConfirmDialog });
