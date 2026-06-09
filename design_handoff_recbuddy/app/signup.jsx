// signup.jsx — athlete multi-step sign-up (mobile, iOS-style)
// Exports to window: AthleteSignup

function AthleteSignup({ theme, onDone, onBackToLogin }) {
  const { Icon } = window;
  const [step, setStep] = React.useState(0);
  const [f, setF] = React.useState({
    name: '', email: '', pw: '', show: false,
    level: 'returning', goal: 'first-race', invite: 'MARA-2026',
  });
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));
  const STEPS = 3;

  const field = {
    width: '100%', boxSizing: 'border-box', background: theme.surface2,
    border: `1px solid ${theme.line}`, borderRadius: 12, padding: '14px 14px',
    color: theme.text, fontFamily: theme.font, fontSize: 15, outline: 'none',
  };
  const label = { fontFamily: theme.font, fontSize: 11, fontWeight: 700, letterSpacing: 0.6,
    textTransform: 'uppercase', color: theme.textMute, display: 'block', marginBottom: 7 };

  const canContinue =
    step === 0 ? (f.name.trim().length > 1 && /\S+@\S+\.\S+/.test(f.email) && f.pw.length >= 6) :
    step === 1 ? (!!f.level && !!f.goal) :
    true;

  const next = () => { if (!canContinue) return; if (step < STEPS - 1) setStep(s => s + 1); else onDone(); };
  const back = () => { if (step === 0) onBackToLogin(); else setStep(s => s - 1); };

  const levels = [
    { id: 'new', label: 'New to running', sub: 'Just getting started' },
    { id: 'returning', label: 'Returning', sub: 'Getting back into it' },
    { id: 'experienced', label: 'Experienced', sub: 'Run regularly' },
    { id: 'competitive', label: 'Competitive', sub: 'Racing to win' },
  ];
  const goals = [
    { id: 'fit', label: 'Get fit', icon: 'heart' },
    { id: 'first-race', label: 'First race', icon: 'trophy' },
    { id: 'pr', label: 'Beat a PR', icon: 'bolt' },
    { id: 'distance', label: 'Go longer', icon: 'mountain' },
  ];

  const titles = ['Create your account', 'Your running', 'Connect with your coach'];
  const subs = [
    'Start your training journey with RecBuddy.',
    'This helps your coach tailor your plan.',
    'Enter the invite code your coach shared.',
  ];

  return (
    <div style={{ height: '100%', background: theme.bg, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -130, left: '50%', transform: 'translateX(-50%)', width: 460, height: 300,
        background: `radial-gradient(circle, ${theme.accent}1f, transparent 68%)`, pointerEvents: 'none' }} />

      {/* top bar: back + progress */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '52px 20px 8px', position: 'relative' }}>
        <button onClick={back} style={{ width: 36, height: 36, borderRadius: 36, flexShrink: 0, cursor: 'pointer',
          border: `1px solid ${theme.line}`, background: theme.chip, color: theme.text,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="back" size={20} stroke={2.2} />
        </button>
        <div style={{ flex: 1, display: 'flex', gap: 6 }}>
          {Array.from({ length: STEPS }).map((_, i) => (
            <div key={i} style={{ flex: 1, height: 5, borderRadius: 5, background: i <= step ? theme.accent : theme.surface2,
              transition: 'background .3s' }} />
          ))}
        </div>
        <span style={{ fontFamily: theme.num, fontSize: 12.5, fontWeight: 700, color: theme.textMute, flexShrink: 0, fontFeatureSettings: theme.numFeat }}>{step + 1}/{STEPS}</span>
      </div>

      {/* header */}
      <div style={{ flexShrink: 0, padding: '14px 24px 6px', position: 'relative' }}>
        <h1 style={{ margin: 0, fontFamily: theme.display, fontSize: 30, fontWeight: 700, letterSpacing: -0.5, color: theme.text, lineHeight: 1.05 }}>{titles[step]}</h1>
        <p style={{ margin: '8px 0 0', fontFamily: theme.font, fontSize: 14.5, color: theme.textMute, lineHeight: 1.45 }}>{subs[step]}</p>
      </div>

      {/* body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 24px 8px', position: 'relative' }}>
        {step === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <span style={label}>Full name</span>
              <input style={field} value={f.name} onChange={e => set('name', e.target.value)} placeholder="Jordan Reyes" autoFocus />
            </div>
            <div>
              <span style={label}>Email</span>
              <input style={field} value={f.email} onChange={e => set('email', e.target.value)} type="email" placeholder="you@email.com" autoComplete="email" />
            </div>
            <div>
              <span style={label}>Password</span>
              <div style={{ position: 'relative' }}>
                <input style={{ ...field, paddingRight: 46 }} value={f.pw} onChange={e => set('pw', e.target.value)}
                  type={f.show ? 'text' : 'password'} placeholder="At least 6 characters" autoComplete="new-password" />
                <button type="button" onClick={() => set('show', !f.show)} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                  width: 34, height: 34, border: 'none', background: 'transparent', cursor: 'pointer', color: theme.textMute, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={f.show ? 'check' : 'clock'} size={18} stroke={2} />
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div>
              <span style={label}>Experience level</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {levels.map(l => {
                  const on = f.level === l.id;
                  return (
                    <button key={l.id} onClick={() => set('level', l.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                      borderRadius: 14, padding: '13px 15px', textAlign: 'left',
                      border: `1.5px solid ${on ? theme.accent : theme.line}`, background: on ? theme.accent + '14' : theme.surface }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: theme.font, fontSize: 15, fontWeight: 700, color: theme.text }}>{l.label}</div>
                        <div style={{ fontFamily: theme.font, fontSize: 12.5, color: theme.textMute, marginTop: 1 }}>{l.sub}</div>
                      </div>
                      <span style={{ width: 22, height: 22, borderRadius: 22, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: on ? theme.accent : 'transparent', border: on ? 'none' : `2px solid ${theme.line}` }}>
                        {on && <Icon name="check" size={13} stroke={3} color={theme.onAccent} />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <span style={label}>Primary goal</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
                {goals.map(g => {
                  const on = f.goal === g.id;
                  return (
                    <button key={g.id} onClick={() => set('goal', g.id)} style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer',
                      borderRadius: 14, padding: '14px 13px', textAlign: 'left',
                      border: `1.5px solid ${on ? theme.accent : theme.line}`, background: on ? theme.accent + '14' : theme.surface }}>
                      <Icon name={g.icon} size={19} stroke={2} color={on ? theme.accent : theme.textMute} />
                      <span style={{ fontFamily: theme.font, fontSize: 14, fontWeight: 700, color: on ? theme.text : theme.textMute }}>{g.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <span style={label}>Coach invite code</span>
              <input style={{ ...field, fontFamily: theme.num, fontWeight: 700, letterSpacing: 2, fontSize: 17, textTransform: 'uppercase' }}
                value={f.invite} onChange={e => set('invite', e.target.value.toUpperCase())} placeholder="XXXX-XXXX" />
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 9, padding: '10px 12px', borderRadius: 11, background: theme.accent + '12' }}>
                <Icon name="check" size={15} stroke={2.6} color={theme.accent} />
                <span style={{ fontFamily: theme.font, fontSize: 12.5, color: theme.text, fontWeight: 500 }}>
                  Code matches <b style={{ fontWeight: 700 }}>Coach Mara Whitlock</b>
                </span>
              </div>
            </div>
            <div>
              <span style={label}>Sync your runs (optional)</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {[['Garmin Connect', 'sync'], ['Strava', 'run']].map(([name, ic]) => (
                  <button key={name} style={{ display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer', borderRadius: 13, padding: '13px 15px',
                    border: `1px solid ${theme.line}`, background: theme.surface, textAlign: 'left' }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: theme.chip, color: theme.text,
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={ic} size={18} stroke={2} /></div>
                    <span style={{ flex: 1, fontFamily: theme.font, fontSize: 14.5, fontWeight: 600, color: theme.text }}>Connect {name}</span>
                    <Icon name="plus" size={18} stroke={2.2} color={theme.accent} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* footer */}
      <div style={{ flexShrink: 0, padding: '10px 24px 30px', position: 'relative' }}>
        <button onClick={next} disabled={!canContinue} style={{
          width: '100%', border: 'none', cursor: canContinue ? 'pointer' : 'default', opacity: canContinue ? 1 : 0.4,
          borderRadius: 14, padding: '16px', background: theme.accent, color: theme.onAccent,
          fontFamily: theme.display, fontStyle: 'italic', fontWeight: 800, fontSize: 17, letterSpacing: 0.3, textTransform: 'uppercase',
          boxShadow: canContinue ? `0 0 24px ${theme.accent}40` : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {step < STEPS - 1 ? 'Continue' : 'Start training'}
          <Icon name="chevron" size={19} stroke={2.6} color={theme.onAccent} />
        </button>
        {step === 0 && (
          <div style={{ textAlign: 'center', marginTop: 14 }}>
            <span style={{ fontFamily: theme.font, fontSize: 13.5, color: theme.textMute }}>Already have an account? </span>
            <button onClick={onBackToLogin} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0,
              fontFamily: theme.font, fontSize: 13.5, fontWeight: 700, color: theme.accent }}>Log in</button>
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { AthleteSignup });
