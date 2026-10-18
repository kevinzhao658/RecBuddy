import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './routes/LoginPage'
import SignupPage from './routes/SignupPage'
import ResetPasswordPage from './routes/ResetPasswordPage'
import ConfirmedPage from './routes/ConfirmedPage'
import CoachPage from './routes/CoachPage'
import PrivacyPage from './routes/legal/PrivacyPage'
import TermsPage from './routes/legal/TermsPage'
import SupportPage from './routes/legal/SupportPage'
import { RequireCoach, RedirectIfCoach } from './auth/RequireCoach'
import { RequireAdmin } from './auth/RequireAdmin'

// Admin console is code-split: coaches never download it.
const AdminPage = lazy(() => import('./routes/admin/AdminPage'))

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<RedirectIfCoach><LoginPage /></RedirectIfCoach>} />
      <Route path="/signup" element={<RedirectIfCoach><SignupPage /></RedirectIfCoach>} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/confirmed" element={<ConfirmedPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/support" element={<SupportPage />} />
      <Route path="/coach" element={<RequireCoach><CoachPage /></RequireCoach>} />
      <Route path="/admin/*" element={
        <RequireAdmin>
          <Suspense fallback={<div className="p-8 text-text-mute">Loading…</div>}><AdminPage /></Suspense>
        </RequireAdmin>
      } />
      <Route path="*" element={<Navigate to="/coach" replace />} />
    </Routes>
  )
}
