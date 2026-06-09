// login.jsx — athlete login screen + account sheet for the client app
// Exports to window: AthleteLogin, AccountSheet

function AthleteLogin({ theme, onLogin }) {
  const { Icon, AthleteSignup } = window;
  const [mode, setMode] = React.useState('login');
  const [email, setEmail] = React.useState('jordan@recbuddy.app');
  const [pw, setPw] = React.useState('trackstar');
  const [show, setShow] = React.useState(false);

  if (mode === 'signup') return <AthleteSignup theme={theme} onDone={onLogin} onBackToLogin={() => setMode('login')} />;

  const field = {
    width: '100%', boxSizing: 'border-box', background: theme.surface2,
    border: `1px solid ${theme.line}`, borderRadius: 12, padding: '14px 14px',
    color: theme.text, fontFamily: theme.font, fontSize: 15, outline: 'none',
  };
  const label = { fontFamily: theme.font, fontSize: 11, fontWeight: 700, letterSpacing: 0.6,
    textTransform: 'uppercase', color: theme.textMute, display: 'block', marginBottom: 7 };

  const submit = (e) => { if (e) e.preventDefault(); onLogin(); };

  return (
    <div style={{ height: '100%', background: theme.bg, display: 'flex', flexDirection: 'column',
      padding: '0 26px 34px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -120, left: '50%', transform: 'translateX(-50%)', width: 460, height: 320,
        background: `radial-gradient(circle, ${theme.accent}26, transparent 68%)`, pointerEvents: 'none' }} />

      {/* hero — centered wordmark */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', position: 'relative', paddingTop: 36 }}>
        <div style={{ fontFamily: theme.display, fontStyle: 'italic', fontWeight: 800, fontSize: 58, letterSpacing: -1.8, lineHeight: 1 }}>
          <span className="rb-metal-lime">Rec</span><span className="rb-metal-silver">Buddy</span>
        </div>
        <div className="rb-metal-slogan" style={{ fontFamily: theme.font, fontSize: 13.5, fontWeight: 700, letterSpacing: 2, marginTop: 14, textTransform: 'uppercase' }}>
          Unleash Yourself
        </div>
      </div>

      {/* form */}
      <form onSubmit={submit} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <span style={label}>Email</span>
          <input style={field} value={email} onChange={e => setEmail(e.target.value)} type="email" autoComplete="username" />
        </div>
        <div>
          <span style={label}>Password</span>
          <div style={{ position: 'relative' }}>
            <input style={{ ...field, paddingRight: 46 }} value={pw} onChange={e => setPw(e.target.value)}
              type={show ? 'text' : 'password'} autoComplete="current-password" />
            <button type="button" onClick={() => setShow(s => !s)} style={{
              position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 34, height: 34,
              border: 'none', background: 'transparent', cursor: 'pointer', color: theme.textMute,
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={show ? 'check' : 'clock'} size={18} stroke={2} />
            </button>
          </div>
        </div>

        <button type="submit" style={{
          marginTop: 4, width: '100%', border: 'none', cursor: 'pointer', borderRadius: 14, padding: '15px',
          background: theme.accent, color: theme.onAccent, fontFamily: theme.display, fontStyle: 'italic', fontWeight: 800,
          fontSize: 17, letterSpacing: 0.3, textTransform: 'uppercase',
          boxShadow: `0 0 24px ${theme.accent}40`,
        }}>Log in</button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0' }}>
          <div style={{ flex: 1, height: 1, background: theme.line }} />
          <span style={{ fontFamily: theme.font, fontSize: 11.5, color: theme.textFaint }}>or</span>
          <div style={{ flex: 1, height: 1, background: theme.line }} />
        </div>

        <button type="button" onClick={onLogin} style={{
          width: '100%', cursor: 'pointer', borderRadius: 14, padding: '14px',
          background: 'transparent', border: `1px solid ${theme.line}`, color: theme.text,
          fontFamily: theme.font, fontSize: 14.5, fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" style={{ marginTop: -2 }}>
            <path d="M17.05 12.04c-.03-2.6 2.13-3.85 2.22-3.91-1.21-1.77-3.09-2.01-3.76-2.04-1.6-.16-3.12.94-3.93.94-.81 0-2.06-.92-3.39-.89-1.74.03-3.35 1.01-4.25 2.57-1.81 3.14-.46 7.79 1.3 10.34.86 1.25 1.88 2.65 3.22 2.6 1.29-.05 1.78-.83 3.34-.83 1.56 0 2 .83 3.37.81 1.39-.03 2.27-1.27 3.12-2.53.98-1.45 1.39-2.85 1.41-2.92-.03-.01-2.7-1.04-2.73-4.12M14.54 4.6c.71-.86 1.19-2.06 1.06-3.25-1.02.04-2.26.68-2.99 1.54-.66.76-1.23 1.98-1.08 3.15 1.14.09 2.3-.58 3.01-1.44" />
          </svg>
          Continue with Apple
        </button>

        <div style={{ textAlign: 'center', marginTop: 6 }}>
          <span style={{ fontFamily: theme.font, fontSize: 13, color: theme.textMute }}>Forgot password?</span>
        </div>

        <div style={{ textAlign: 'center', marginTop: 8, paddingTop: 16, borderTop: `1px solid ${theme.hairline}` }}>
          <span style={{ fontFamily: theme.font, fontSize: 13.5, color: theme.textMute }}>New to RecBuddy? </span>
          <button type="button" onClick={() => setMode('signup')} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0,
            fontFamily: theme.font, fontSize: 13.5, fontWeight: 700, color: theme.accent }}>Create an account</button>
        </div>
      </form>
    </div>
  );
}

function AccountSheet({ theme, onLogout, onClose }) {
  const { Icon, ATHLETE } = window;
  const row = (icon, label, sub) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 0', borderTop: `1px solid ${theme.hairline}` }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, background: theme.chip, color: theme.textMute,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name={icon} size={18} stroke={2} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: theme.font, fontSize: 14.5, fontWeight: 600, color: theme.text }}>{label}</div>
        {sub && <div style={{ fontFamily: theme.font, fontSize: 12, color: theme.textMute, marginTop: 1 }}>{sub}</div>}
      </div>
      <Icon name="chevron" size={17} stroke={2} color={theme.textFaint} />
    </div>
  );
  return (
    <div style={{ padding: '8px 22px 4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '6px 0 18px' }}>
        <div style={{ width: 52, height: 52, borderRadius: 52, background: theme.chip, color: theme.text,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.font, fontWeight: 700, fontSize: 20, flexShrink: 0 }}>
          {ATHLETE.initials}
        </div>
        <div>
          <div style={{ fontFamily: theme.display, fontSize: 22, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap' }}>{ATHLETE.name} Reyes</div>
          <div style={{ fontFamily: theme.font, fontSize: 13, color: theme.textMute }}>jordan@recbuddy.app</div>
        </div>
      </div>
      {row('target', 'Goal & plan', 'Riverside Half · Aug 23')}
      {row('sync', 'Connected apps', 'Garmin Connect')}
      {row('heart', 'Notifications', 'Daily reminders on')}
      <button onClick={onLogout} style={{
        width: '100%', marginTop: 18, cursor: 'pointer', borderRadius: 14, padding: '15px',
        background: theme.types.race.soft, border: `1px solid ${theme.types.race.c}55`, color: theme.types.race.c,
        fontFamily: theme.font, fontSize: 15.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        Log out
      </button>
    </div>
  );
}

Object.assign(window, { AthleteLogin, AccountSheet });
