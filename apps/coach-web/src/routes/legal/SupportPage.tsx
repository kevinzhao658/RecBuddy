import { Link } from 'react-router-dom'
import { LegalPage, LegalSection } from './LegalPage'

const EMAIL = <a href="mailto:support@recbuddy.app" className="font-semibold text-accent hover:brightness-110">support@recbuddy.app</a>
const inline = 'font-semibold text-accent hover:brightness-110'

export default function SupportPage() {
  return (
    <LegalPage title="Support" updated="August 2026">
      <p>
        RecBuddy connects runners with their coaches: personalized training plans, a weekly workout
        calendar, run logging (manual or via Apple Health), and in-app coach messaging.
      </p>

      <LegalSection title="Contact us">
        <p>
          Email {EMAIL} — we typically reply within 2–3 business days. Please include the email
          address on your RecBuddy account and, if relevant, a screenshot of what you&rsquo;re seeing.
        </p>
      </LegalSection>

      <LegalSection title="Common questions">
        <p><strong>How do I connect with my coach?</strong></p>
        <p>Ask your coach for an invite code, then enter it in the app under Settings → Coaches → Add coach.</p>
        <p><strong>How does Apple Health syncing work?</strong></p>
        <p>
          With your permission, RecBuddy reads completed workouts (runs and rides, distance, heart
          rate) from Apple Health and logs them against your plan automatically. Access is read-only,
          and you can revoke it any time in the Apple Health app or iOS Settings. Manual logging
          always works too.
        </p>
        <p><strong>How do I delete my account?</strong></p>
        <p>In the app: Settings → Account → Delete account. Deletion is permanent and removes your profile, training data, and messages.</p>
        <p><strong>Where is the privacy policy?</strong></p>
        <p>
          At <Link to="/privacy" className={inline}>recbuddy.app/privacy</Link>. Terms are at{' '}
          <Link to="/terms" className={inline}>recbuddy.app/terms</Link>.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
