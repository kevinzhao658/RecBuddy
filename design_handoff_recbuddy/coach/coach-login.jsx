// coach-login.jsx — coach desktop sign-in screen
// Exports to window: CoachLogin

function CoachLogin({ theme, onLogin }) {
  const { Icon } = window;
  const [mode, setMode] = React.useState('login');
  const [email, setEmail] = React.useState('mara@recbuddy.app');
  const [pw, setPw] = React.useState('coachmode');
  const [show, setShow] = React.useState(false);
  const [su, setSu] = React.useState({ name: '', email: '', pw: '', title: 'Head Coach' });
  const setS = (k, v) => setSu(s => ({ ...s, [k]: v }));

  const field = {
    width: '100%', boxSizing: 'border-box', background: theme.surface2,
    border: `1px solid ${theme.line}`, borderRadius: 11, padding: '13px 14px 13px 42px',
    color: theme.text, fontFamily: theme.font, fontSize: 14.5, outline: 'none',
  };
  const label = { fontFamily: theme.font, fontSize: 11, fontWeight: 700, letterSpacing: 0.6,
    textTransform: 'uppercase', color: theme.textMute, display: 'block', marginBottom: 7 };
  const iconWrap = { position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: theme.textFaint };

  const submit = (e) => { if (e) e.preventDefault(); onLogin(); };
  const suValid = su.name.trim().length > 1 && /\S+@\S+\.\S+/.test(su.email) && su.pw.length >= 6;
  const submitSignup = (e) => { if (e) e.preventDefault(); if (suValid) onLogin(); };
  const titles = ['Head Coach', 'Assistant Coach', 'Strength Coach', 'Physio'];

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', background: theme.bg, color: theme.text, overflow: 'hidden' }}>
      {/* brand panel */}
      <div style={{ width: '46%', flexShrink: 0, position: 'relative', overflow: 'hidden',
        borderRight: `1px solid ${theme.line}`, padding: '54px 56px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ position: 'absolute', top: -160, left: -80, width: 560, height: 460,
          background: `radial-gradient(circle, ${theme.accent}22, transparent 66%)`, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -180, right: -120, width: 520, height: 460,
          background: `radial-gradient(circle, ${theme.accent2}1f, transparent 66%)`, pointerEvents: 'none' }} />

        <div style={{ position: 'relative', fontFamily: theme.display, fontStyle: 'italic', fontWeight: 800, fontSize: 40, letterSpacing: -1.2, lineHeight: 1 }}>
          <span className="rb-metal-lime">Rec</span><span className="rb-metal-silver">Buddy</span>
        </div>
        <div className="rb-metal-slogan" style={{ position: 'relative', fontFamily: theme.font, fontSize: 11, fontWeight: 700, letterSpacing: 2.4, marginTop: 6 }}>COACH</div>

        <div style={{ position: 'relative', marginTop: 'auto' }}>
          <div style={{ fontFamily: theme.display, fontWeight: 700, fontSize: 34, letterSpacing: -0.5, lineHeight: 1.08, maxWidth: 380 }}>
            {mode === 'login' ? <>Build the plan.<br />Coach every mile.</> : <>Start coaching<br />on RecBuddy.</>}
          </div>
          <p style={{ fontFamily: theme.font, fontSize: 14.5, color: theme.textMute, lineHeight: 1.6, marginTop: 16, maxWidth: 360 }}>
            {mode === 'login'
              ? 'Your athletes, their weeks, and every workout — in one place. Drag, adjust, and keep everyone on pace for race day.'
              : 'Create your coach account, build your roster, and deliver tailored training plans your athletes will love.'}
          </p>
        </div>
      </div>

      {/* form panel */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        {mode === 'signup' ? (
          <form onSubmit={submitSignup} style={{ width: 380, maxWidth: '100%' }}>
            <div style={{ fontFamily: theme.display, fontWeight: 700, fontSize: 28, letterSpacing: -0.4 }}>Create your coach account</div>
            <div style={{ fontFamily: theme.font, fontSize: 14, color: theme.textMute, marginTop: 6, marginBottom: 24 }}>
              Free to start. Add athletes and build plans in minutes.
            </div>

            <div style={{ marginBottom: 16 }}>
              <span style={label}>Full name</span>
              <div style={{ position: 'relative' }}>
                <span style={iconWrap}><Icon name="edit" size={17} stroke={2} /></span>
                <input style={field} value={su.name} onChange={e => setS('name', e.target.value)} placeholder="Coach name" autoFocus />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <span style={label}>Work email</span>
              <div style={{ position: 'relative' }}>
                <span style={iconWrap}><Icon name="mail" size={17} stroke={2} /></span>
                <input style={field} value={su.email} onChange={e => setS('email', e.target.value)} type="email" placeholder="you@email.com" autoComplete="email" />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <span style={label}>Password</span>
              <div style={{ position: 'relative' }}>
                <span style={iconWrap}><Icon name="lock" size={17} stroke={2} /></span>
                <input style={{ ...field, paddingRight: 44 }} value={su.pw} onChange={e => setS('pw', e.target.value)}
                  type={show ? 'text' : 'password'} placeholder="At least 6 characters" autoComplete="new-password" />
                <button type="button" onClick={() => setShow(s => !s)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  width: 30, height: 30, border: 'none', background: 'transparent', cursor: 'pointer', color: theme.textMute, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={show ? 'check' : 'clock'} size={17} stroke={2} />
                </button>
              </div>
            </div>
            <div style={{ marginBottom: 22 }}>
              <span style={label}>Coaching title</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {titles.map(t => (
                  <button type="button" key={t} onClick={() => setS('title', t)} style={{ cursor: 'pointer', borderRadius: 10, padding: '9px 13px',
                    border: `1.5px solid ${su.title === t ? theme.accent : theme.line}`, background: su.title === t ? theme.accent + '14' : 'transparent',
                    fontFamily: theme.font, fontSize: 12.5, fontWeight: 700, color: su.title === t ? theme.text : theme.textMute }}>{t}</button>
                ))}
              </div>
            </div>

            <button type="submit" disabled={!suValid} style={{
              width: '100%', border: 'none', cursor: suValid ? 'pointer' : 'default', opacity: suValid ? 1 : 0.45, borderRadius: 12, padding: '14px',
              background: theme.accent, color: theme.onAccent, fontFamily: theme.display, fontStyle: 'italic', fontWeight: 800,
              fontSize: 16, letterSpacing: 0.3, textTransform: 'uppercase', boxShadow: suValid ? `0 0 24px ${theme.accent}38` : 'none' }}>Create account</button>

            <div style={{ fontFamily: theme.font, fontSize: 11.5, color: theme.textFaint, textAlign: 'center', marginTop: 12, lineHeight: 1.5 }}>
              By creating an account you agree to RecBuddy's<br />Terms of Service and Privacy Policy.
            </div>

            <div style={{ textAlign: 'center', marginTop: 18, paddingTop: 18, borderTop: `1px solid ${theme.hairline}` }}>
              <span style={{ fontFamily: theme.font, fontSize: 13, color: theme.textMute }}>Already coaching here? </span>
              <button type="button" onClick={() => setMode('login')} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0,
                fontFamily: theme.font, fontSize: 13, fontWeight: 700, color: theme.accent }}>Sign in</button>
            </div>
          </form>
        ) : (
        <form onSubmit={submit} style={{ width: 360, maxWidth: '100%' }}>
          <div style={{ fontFamily: theme.display, fontWeight: 700, fontSize: 28, letterSpacing: -0.4 }}>Coach sign in</div>
          <div style={{ fontFamily: theme.font, fontSize: 14, color: theme.textMute, marginTop: 6, marginBottom: 26 }}>
            Welcome back. Let's get your athletes moving.
          </div>

          <div style={{ marginBottom: 16 }}>
            <span style={label}>Email</span>
            <div style={{ position: 'relative' }}>
              <span style={iconWrap}><Icon name="mail" size={17} stroke={2} /></span>
              <input style={field} value={email} onChange={e => setEmail(e.target.value)} type="email" autoComplete="username" />
            </div>
          </div>

          <div style={{ marginBottom: 22 }}>
            <span style={label}>Password</span>
            <div style={{ position: 'relative' }}>
              <span style={iconWrap}><Icon name="lock" size={17} stroke={2} /></span>
              <input style={{ ...field, paddingRight: 44 }} value={pw} onChange={e => setPw(e.target.value)}
                type={show ? 'text' : 'password'} autoComplete="current-password" />
              <button type="button" onClick={() => setShow(s => !s)} style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 30, height: 30,
                border: 'none', background: 'transparent', cursor: 'pointer', color: theme.textMute,
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={show ? 'check' : 'clock'} size={17} stroke={2} />
              </button>
            </div>
          </div>

          <button type="submit" style={{
            width: '100%', border: 'none', cursor: 'pointer', borderRadius: 12, padding: '14px',
            background: theme.accent, color: theme.onAccent, fontFamily: theme.display, fontStyle: 'italic', fontWeight: 800,
            fontSize: 16, letterSpacing: 0.3, textTransform: 'uppercase', boxShadow: `0 0 24px ${theme.accent}38` }}>Log in</button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0' }}>
            <div style={{ flex: 1, height: 1, background: theme.line }} />
            <span style={{ fontFamily: theme.font, fontSize: 11.5, color: theme.textFaint }}>or</span>
            <div style={{ flex: 1, height: 1, background: theme.line }} />
          </div>

          <button type="button" onClick={onLogin} style={{
            width: '100%', cursor: 'pointer', borderRadius: 12, padding: '13px',
            background: 'transparent', border: `1px solid ${theme.line}`, color: theme.text,
            fontFamily: theme.font, fontSize: 14, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
            <svg width="17" height="17" viewBox="0 0 24 24" style={{ marginTop: -1 }}>
              <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.3-.97 2.4-2.07 3.14v2.6h3.35C20.7 18.1 21.6 15.3 21.6 12c0-.66-.06-1.3-.17-1.9H12Z" transform="translate(0 0)" />
              <path fill="#F3FBE8" d="M12 22c2.7 0 4.96-.9 6.6-2.42l-3.35-2.6c-.93.62-2.12.99-3.25.99-2.5 0-4.62-1.69-5.38-3.96H3.18v2.49C4.8 19.74 8.13 22 12 22Z" />
              <path fill="#F3FBE8" d="M6.62 13.01A6.01 6.01 0 0 1 6.3 12c0-.35.06-.69.16-1.01V8.5H3.18A9.98 9.98 0 0 0 2 12c0 1.62.39 3.15 1.18 4.5l3.44-2.49Z" />
              <path fill="#F3FBE8" d="M12 6.04c1.47 0 2.79.51 3.83 1.5l2.87-2.87C16.96 3.06 14.7 2 12 2 8.13 2 4.8 4.26 3.18 7.5l3.44 2.49C7.38 7.73 9.5 6.04 12 6.04Z" />
            </svg>
            Continue with Google
          </button>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 22 }}>
            <span style={{ fontFamily: theme.font, fontSize: 13, color: theme.textMute }}>Forgot password?</span>
            <a href="RecBuddy.html" style={{ fontFamily: theme.font, fontSize: 13, color: theme.accent, textDecoration: 'none', fontWeight: 600 }}>Athlete? Open the app →</a>
          </div>

          <div style={{ textAlign: 'center', marginTop: 18, paddingTop: 18, borderTop: `1px solid ${theme.hairline}` }}>
            <span style={{ fontFamily: theme.font, fontSize: 13, color: theme.textMute }}>New to RecBuddy? </span>
            <button type="button" onClick={() => setMode('signup')} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0,
              fontFamily: theme.font, fontSize: 13, fontWeight: 700, color: theme.accent }}>Create a coach account</button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { CoachLogin });
