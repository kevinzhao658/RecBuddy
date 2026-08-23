import { LegalPage, LegalSection } from './LegalPage'

const SECTIONS: { title: string; text: string }[] = [
  { title: '1. Acceptance of Terms', text: 'By creating a RecBuddy account and using the app, you agree to these Terms & Conditions. If you do not agree, please do not use the service.' },
  { title: '2. Description of Service', text: 'RecBuddy is an athletic training platform that connects athletes with coaches. The app stores training plans, workout logs, and coach–athlete communications to support your training.' },
  { title: '3. Training Data Storage', text: 'You agree that RecBuddy may store your training data (including workout logs, pace, distance, heart rate, and coach notes) on secure servers. This data is used solely to provide and improve the service. We do not sell your personal training data to third parties.' },
  { title: '4. No Medical Advice', text: 'RecBuddy is a training management tool and does not provide medical advice, diagnosis, or treatment. Always consult a qualified healthcare professional before beginning or modifying any exercise program. Running and athletic training carry inherent risks; you participate at your own risk.' },
  { title: '5. Account Responsibility', text: 'You are responsible for maintaining the confidentiality of your account credentials. You are responsible for all activity that occurs under your account. Notify us immediately at support@recbuddy.app if you believe your account has been compromised.' },
  { title: '6. Account Deletion Rights', text: 'You may delete your account at any time from Settings → Delete account. Upon deletion, your profile, training logs, plan data, and chat history will be permanently removed from our servers. Coach links will be severed. This action is irreversible.' },
  { title: '7. Intellectual Property', text: 'The RecBuddy app, its design, and all associated content are owned by RecBuddy and protected by applicable intellectual property laws. Training plans created by your coach remain the intellectual property of your coach.' },
  { title: '8. Limitation of Liability', text: 'To the maximum extent permitted by law, RecBuddy shall not be liable for any indirect, incidental, or consequential damages arising from your use of the service, including injury sustained during training.' },
  { title: '9. Changes to Terms', text: 'We may update these Terms from time to time. Continued use of the app after changes constitutes acceptance of the revised Terms. Material changes will be communicated via the app or email.' },
  { title: '10. Contact', text: 'Questions about these Terms? Contact us at support@recbuddy.app.' },
]

export default function TermsPage() {
  return (
    <LegalPage title="Terms & Conditions" updated="July 2026">
      {SECTIONS.map((s) => (
        <LegalSection key={s.title} title={s.title}><p>{s.text}</p></LegalSection>
      ))}
    </LegalPage>
  )
}
