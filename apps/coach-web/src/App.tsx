import { Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './routes/LoginPage'
import SignupPage from './routes/SignupPage'
import CoachPage from './routes/CoachPage'
import { RequireCoach } from './auth/RequireCoach'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/coach" element={<RequireCoach><CoachPage /></RequireCoach>} />
      <Route path="*" element={<Navigate to="/coach" replace />} />
    </Routes>
  )
}
