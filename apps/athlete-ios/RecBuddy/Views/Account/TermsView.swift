import SwiftUI

/// Static Terms & Conditions — v1 boilerplate.
struct TermsView: View {
    var body: some View {
        ZStack {
            RB.bg.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {

                    VStack(alignment: .leading, spacing: 4) {
                        Text("Terms & Conditions")
                            .font(.title2.bold())
                            .foregroundStyle(.white)
                        Text("Last updated August 2026")
                            .font(.caption)
                            .foregroundStyle(RB.textFaint)
                    }

                    termsSection(
                        title: "1. Acceptance of Terms",
                        text: "By creating a RecBuddy account and using the app, you agree to these Terms & Conditions and to our Privacy Policy at recbuddy.app/privacy, which is incorporated into these Terms by reference. If you do not agree, please do not use the service."
                    )
                    termsSection(
                        title: "2. Eligibility",
                        text: "You must be at least 13 years old to use RecBuddy. If you are under 18, you may use RecBuddy only with the consent of a parent or legal guardian who has reviewed and agreed to these Terms on your behalf."
                    )
                    termsSection(
                        title: "3. Description of Service",
                        text: "RecBuddy is an athletic training platform that connects athletes with coaches. The app stores training plans, workout logs, and coach–athlete communications to support your training."
                    )
                    termsSection(
                        title: "4. Role of RecBuddy; Coaches",
                        text: "Coaches on RecBuddy are independent third parties, not employees or agents of RecBuddy. RecBuddy does not vet, certify, endorse, or supervise coaches, and does not review or approve training plans. All training guidance comes from your coach, not from RecBuddy. Your relationship with your coach — and any dispute arising from it — is solely between you and your coach."
                    )
                    termsSection(
                        title: "5. Training Data Storage",
                        text: "You agree that RecBuddy may store your training data (including workout logs, pace, distance, heart rate, and coach notes) on secure servers. This data is used solely to provide and improve the service. We do not sell your personal training data to third parties."
                    )
                    termsSection(
                        title: "6. No Medical Advice; Assumption of Risk",
                        text: "RecBuddy is a training management tool and does not provide medical advice, diagnosis, or treatment. Always consult a qualified healthcare professional before beginning or modifying any exercise program. Running and athletic training carry inherent risks; you participate at your own risk."
                    )
                    termsSection(
                        title: "7. Account Responsibility",
                        text: "You are responsible for maintaining the confidentiality of your account credentials. You are responsible for all activity that occurs under your account. Notify us immediately at support@recbuddy.app if you believe your account has been compromised."
                    )
                    termsSection(
                        title: "8. Acceptable Use; Suspension",
                        text: "You agree not to use RecBuddy to harass, abuse, or harm others, to post unlawful or infringing content, or to interfere with or disrupt the service. We may suspend or terminate your account if you violate these Terms. We may modify or discontinue features of the service, with reasonable notice where practicable."
                    )
                    termsSection(
                        title: "9. Your Content",
                        text: "You retain ownership of the content you submit to RecBuddy, including messages, notes, photos, and logged workouts. You grant RecBuddy a non-exclusive, worldwide, royalty-free license to host, store, display, and transmit that content as needed to operate the service — for example, showing your logged runs and messages to your connected coach."
                    )
                    termsSection(
                        title: "10. Account Deletion Rights",
                        text: "You may delete your account at any time from Settings → Delete account. Upon deletion, your profile, training logs, plan data, and chat history will be permanently removed from our servers. Coach links will be severed. This action is irreversible."
                    )
                    termsSection(
                        title: "11. Intellectual Property",
                        text: "The RecBuddy app, its design, and all associated content are owned by RecBuddy and protected by applicable intellectual property laws. Training plans created by your coach remain the intellectual property of your coach. Your coach grants you a perpetual, personal, non-commercial license to use training plans delivered to you through RecBuddy, including after your coach connection ends."
                    )
                    termsSection(
                        title: "12. Disclaimer of Warranties",
                        text: "RecBuddy is provided “as is” and “as available,” without warranties of any kind, express or implied, including implied warranties of merchantability, fitness for a particular purpose, and non-infringement. We do not warrant that the service will be uninterrupted, error-free, or secure."
                    )
                    termsSection(
                        title: "13. Limitation of Liability",
                        text: "To the maximum extent permitted by law, RecBuddy shall not be liable for any indirect, incidental, or consequential damages arising from your use of the service, including injury sustained during training. RecBuddy’s total liability for any claim arising from or relating to the service will not exceed the greater of the amounts you paid to RecBuddy in the twelve months before the claim arose or US $100. Some jurisdictions do not allow the exclusion or limitation of certain warranties or damages, so some of the above limitations may not apply to you."
                    )
                    termsSection(
                        title: "14. Governing Law & Venue",
                        text: "These Terms are governed by the laws of the State of New York, without regard to its conflict-of-laws principles. You agree to the exclusive jurisdiction of the state and federal courts located in New York for any dispute that is not resolved informally."
                    )
                    termsSection(
                        title: "15. Severability; Entire Agreement",
                        text: "If any provision of these Terms is found unenforceable, the remaining provisions remain in full effect. These Terms, together with the Privacy Policy, are the entire agreement between you and RecBuddy regarding the service. Our failure to enforce any provision is not a waiver of it."
                    )
                    termsSection(
                        title: "16. Changes to Terms",
                        text: "We may update these Terms from time to time. Continued use of the app after changes constitutes acceptance of the revised Terms. Material changes will be communicated via the app or email."
                    )
                    termsSection(
                        title: "17. Contact",
                        text: "Questions about these Terms? Contact us at support@recbuddy.app."
                    )
                }
                .padding(.horizontal, 20)
                .padding(.top, 20)
                .padding(.bottom, 48)
            }
        }
        .navigationTitle("Terms & Conditions")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarColorScheme(.dark, for: .navigationBar)
    }

    private func termsSection(title: String, text: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.subheadline.weight(.bold))
                .foregroundStyle(.white)
            Text(text)
                .font(.footnote)
                .foregroundStyle(RB.textMute)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}
