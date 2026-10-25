import { LegalPage, LegalSection } from './LegalPage'

const EMAIL = <a href="mailto:support@recbuddy.app" className="font-semibold text-accent hover:brightness-110">support@recbuddy.app</a>

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="October 25, 2026">
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
          <li>Messages, photos, videos, workout cards, reactions, and replies in your conversations: your team chat, 1:1 chats, and group chats</li>
          <li>Coach–athlete connections you create using invite codes or by accepting a coach&rsquo;s request</li>
          <li>Photos, videos and images you choose to share in chat</li>
        </ul>
        <p><strong>Safety and moderation</strong></p>
        <ul>
          <li>Reports you submit about a message or user: the reason, any details you add, and a copy of the reported message</li>
          <li>Users you block</li>
          <li>The date you accepted our Terms &amp; Conditions</li>
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
          <li>Keep RecBuddy safe: review reports, enforce our Terms, block messages that contain prohibited language, and honor blocks between users</li>
          <li>Maintain, debug, and improve the service</li>
          <li>Comply with legal obligations</li>
        </ul>
        <p>We do not use your information for advertising, and we do not sell or rent it.</p>
      </LegalSection>

      <LegalSection title="How your information is shared">
        <ul>
          <li><strong>With your coach or athlete.</strong> RecBuddy is a two-sided coaching tool. When you connect with a coach (or an athlete connects with you), training data and messages relevant to that relationship are visible to the connected person. This is the core purpose of the app. A coach can ask to coach you, or to join a team as a co-coach, but nothing is shared until you accept. Reports are private: we never tell the reported user who reported them. A user you block can no longer message you directly or see your private conversations with them; in a group chat you both belong to, you stop seeing their messages, but they can still see what you post there unless you leave the group.</li>
          <li><strong>With people in your conversations.</strong> Everyone in a conversation sees each other&rsquo;s names, photos, messages, and reactions. A conversation is visible only to its members. Athletes who share a coach can find each other by name to start a chat, unless you turn that off in Settings. When a coach is removed from your team, they leave your group chats that include you, and your 1:1 with them becomes read-only.</li>
          <li><strong>Service providers.</strong> We use Supabase as our hosting and backend provider to store data and handle authentication and email delivery on our behalf, and Resend to deliver safety-report notifications to our support team (these include the reported content and the names and emails of the users involved). They process data only to provide these services to us.</li>
          <li><strong>Legal reasons.</strong> We may disclose information if required by law or to protect the rights, safety, or security of users or the public.</li>
          <li><strong>Business transfers.</strong> If ownership of RecBuddy changes, information may be transferred as part of that transaction, subject to this policy.</li>
        </ul>
        <p>We do not otherwise share your personal information with third parties.</p>
      </LegalSection>

      <LegalSection title="Data retention">
        <p>We keep your information for as long as your account is active or as needed to provide the service. Videos you send in chat are deleted from our servers about 7 days after they&rsquo;re sent, or later only while a report about them is under review. A still preview image of each video is kept with the conversation. Copies already saved on a participant&rsquo;s device stay on that device under their control. When you delete your account (see below), we delete your personal data, except where we are required to retain limited information for legal or security reasons. Reports about abusive content are kept after either account is deleted, so we can act on them and protect other users.</p>
      </LegalSection>

      <LegalSection title="Your choices and rights">
        <ul>
          <li><strong>Access and update.</strong> You can view and edit your profile in the app.</li>
          <li><strong>Delete your account.</strong> RecBuddy includes in-app account deletion (Settings → Account → Delete account). Deleting your account permanently removes your personal data from our systems. This action cannot be undone.</li>
          <li><strong>Disconnect a coach.</strong> You can remove a coach connection in the app at any time.</li>
          <li><strong>Who can find you.</strong> Turn off &ldquo;Let my coach&rsquo;s other athletes find me&rdquo; in Settings to keep other athletes from starting chats with you. You can also leave any group chat.</li>
          <li><strong>Report and block.</strong> You can report any message or user and block any user from the app; unblock anytime in Settings (Settings → Coaches in the iPhone app, Settings → Blocked on the web).</li>
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
