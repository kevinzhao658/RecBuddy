import { LegalPage, LegalSection } from './LegalPage'

const EMAIL = <a href="mailto:support@recbuddy.app" className="font-semibold text-accent hover:brightness-110">support@recbuddy.app</a>

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="July 31, 2026">
      <p>
        RecBuddy (&ldquo;RecBuddy,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) provides a
        running-training app that connects athletes with their coaches. This Privacy Policy explains
        what we collect, how we use it, and the choices you have. It applies to the RecBuddy iOS app
        and related services.
      </p>
      <p>If you do not agree with this policy, please do not use RecBuddy.</p>

      <LegalSection title="Who we are">
        <p>RecBuddy is operated by an individual developer. For any privacy question or request, contact us at {EMAIL}.</p>
      </LegalSection>

      <LegalSection title="Information we collect">
        <p>We only collect information needed to run the coaching experience. We do <strong>not</strong> use third-party analytics, advertising, or tracking SDKs, and we do <strong>not</strong> sell your data.</p>
        <p><strong>Account information</strong></p>
        <ul>
          <li>Email address</li>
          <li>Name and initials</li>
          <li>Optional profile details you choose to add (title, avatar image)</li>
          <li>Account role (athlete or coach)</li>
        </ul>
        <p><strong>Training profile</strong></p>
        <ul><li>Experience level and primary running goal</li></ul>
        <p><strong>Training and fitness data</strong></p>
        <ul>
          <li>Training plans and goals (goal race, distance, target time and pace, dates)</li>
          <li>Scheduled workouts and workout details</li>
          <li>Workouts you log, including distance, pace, time, and optionally <strong>heart rate</strong> and a perceived-effort (&ldquo;feel&rdquo;) rating, plus any notes you add. You can enter this manually, or let RecBuddy import it from Apple Health (see below).</li>
        </ul>
        <p><strong>Communications</strong></p>
        <ul>
          <li>Messages and workout cards exchanged between an athlete and their coach</li>
          <li>Coach–athlete connections you create using invite codes</li>
        </ul>
        <p><strong>Technical information</strong></p>
        <ul>
          <li>Standard information needed to operate the app securely, such as authentication tokens and timestamps. We do not maintain advertising identifiers or a behavioral tracking profile.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Apple Health (HealthKit)">
        <p>With your explicit permission, RecBuddy reads the following from Apple Health to automatically log your completed workouts against your training plan:</p>
        <ul>
          <li>Workouts (your recorded runs and rides)</li>
          <li>Running and cycling distance</li>
          <li>Heart rate</li>
        </ul>
        <p>Access is <strong>read-only</strong> — RecBuddy never writes to or modifies your Apple Health data. You grant this access through Apple&rsquo;s standard Health permission prompt, and you can review or revoke it at any time in the Apple Health app or iOS Settings.</p>
        <p>When RecBuddy matches a Health workout to a planned workout, the resulting logged run (distance, pace, time, heart rate) is stored in our backend and shown to your connected coach as a completed workout — this is the purpose of the feature.</p>
        <p>We use Apple Health data <strong>only</strong> to provide this in-app functionality. We never use it for advertising or marketing, never sell it, and never share it with third parties for their own purposes. It is not shared with any third party other than our backend service provider (Supabase) acting on our behalf.</p>
      </LegalSection>

      <LegalSection title="How we use your information">
        <ul>
          <li>Provide core features: build and display your plan, log workouts, and enable athlete–coach messaging and plan adjustments</li>
          <li>Authenticate you and keep your account secure</li>
          <li>Send transactional emails you request or that are required for your account, such as email confirmation and password reset</li>
          <li>Respond to your support requests</li>
          <li>Maintain, debug, and improve the service</li>
          <li>Comply with legal obligations</li>
        </ul>
        <p>We do not use your information for advertising, and we do not sell or rent it.</p>
      </LegalSection>

      <LegalSection title="How your information is shared">
        <ul>
          <li><strong>With your coach or athlete.</strong> RecBuddy is a two-sided coaching tool. When you connect with a coach (or an athlete connects with you), training data and messages relevant to that relationship are visible to the connected person. This is the core purpose of the app.</li>
          <li><strong>Service providers.</strong> We use Supabase as our hosting and backend provider to store data and handle authentication and email delivery on our behalf. They process data only to provide these services to us.</li>
          <li><strong>Legal reasons.</strong> We may disclose information if required by law or to protect the rights, safety, or security of users or the public.</li>
          <li><strong>Business transfers.</strong> If ownership of RecBuddy changes, information may be transferred as part of that transaction, subject to this policy.</li>
        </ul>
        <p>We do not otherwise share your personal information with third parties.</p>
      </LegalSection>

      <LegalSection title="Data retention">
        <p>We keep your information for as long as your account is active or as needed to provide the service. When you delete your account (see below), we delete your personal data, except where we are required to retain limited information for legal or security reasons.</p>
      </LegalSection>

      <LegalSection title="Your choices and rights">
        <ul>
          <li><strong>Access and update.</strong> You can view and edit your profile in the app.</li>
          <li><strong>Delete your account.</strong> RecBuddy includes in-app account deletion (Settings → Account → Delete account). Deleting your account permanently removes your personal data from our systems. This action cannot be undone.</li>
          <li><strong>Disconnect a coach.</strong> You can remove a coach connection in the app at any time.</li>
          <li><strong>Regional rights.</strong> Depending on where you live, you may have additional rights (such as access, correction, deletion, or portability). Contact us at the email above to exercise them.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Data security">
        <p>We use industry-standard measures, including encryption in transit (HTTPS), to protect your information. No method of transmission or storage is completely secure, so we cannot guarantee absolute security.</p>
      </LegalSection>

      <LegalSection title="Children&rsquo;s privacy">
        <p>RecBuddy is not directed to children under 13, and we do not knowingly collect personal information from them. If you believe a child has provided us personal information, contact us and we will delete it.</p>
      </LegalSection>

      <LegalSection title="International users">
        <p>Your information may be processed and stored in countries other than your own, including the United States, where data-protection laws may differ. By using RecBuddy, you consent to this processing.</p>
      </LegalSection>

      <LegalSection title="Changes to this policy">
        <p>We may update this policy from time to time. When we do, we will revise the &ldquo;Last updated&rdquo; date above and, where appropriate, provide additional notice. Continued use of RecBuddy after changes take effect means you accept the revised policy.</p>
      </LegalSection>

      <LegalSection title="Contact us">
        <p>Questions or requests? Email {EMAIL}.</p>
      </LegalSection>
    </LegalPage>
  )
}
