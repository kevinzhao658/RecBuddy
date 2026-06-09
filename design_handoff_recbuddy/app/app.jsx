// app.jsx — RecBuddy app shell (auth gate + tabs + account/logout)
// Exports to window: RecBuddyApp

function RecBuddyApp({ theme }) {
  const { IOSDevice, TabBar, CalendarView, ChatView, MetricsView, Sheet, AthleteLogin, AccountSheet } = window;
  const [authed, setAuthed] = React.useState(false);
  const [tab, setTab] = React.useState('calendar');
  const [overrides, setOverrides] = React.useState({});
  const [accountOpen, setAccountOpen] = React.useState(false);
  const onComplete = (date) => setOverrides(o => ({ ...o, [date]: 'done' }));

  return (
    <IOSDevice dark={theme.dark}>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: theme.bg, position: 'relative', overflow: 'hidden' }}>
        {!authed ? (
          <AthleteLogin theme={theme} onLogin={() => setAuthed(true)} />
        ) : (
          <React.Fragment>
            <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
              {tab === 'calendar' && <CalendarView theme={theme} overrides={overrides} onComplete={onComplete} onAccount={() => setAccountOpen(true)} />}
              {tab === 'chat' && <ChatView theme={theme} />}
              {tab === 'metrics' && <MetricsView theme={theme} />}
            </div>
            <TabBar theme={theme} active={tab} onChange={setTab} />
            <Sheet theme={theme} open={accountOpen} onClose={() => setAccountOpen(false)}>
              <AccountSheet theme={theme} onClose={() => setAccountOpen(false)}
                onLogout={() => { setAccountOpen(false); setAuthed(false); setTab('calendar'); }} />
            </Sheet>
          </React.Fragment>
        )}
      </div>
    </IOSDevice>
  );
}

Object.assign(window, { RecBuddyApp });
