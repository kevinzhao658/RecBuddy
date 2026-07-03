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
                        Text("Last updated July 2026")
                            .font(.caption)
                            .foregroundStyle(RB.textFaint)
                    }

                    termsSection(
                        title: "1. Acceptance of Terms",
                        text: "By creating a RecBuddy account and using the app, you agree to these Terms & Conditions. If you do not agree, please do not use the service."
                    )
                    termsSection(
                        title: "2. Description of Service",
                        text: "RecBuddy is an athletic training platform that connects athletes with coaches. The app stores training plans, workout logs, and coach–athlete communications to support your training."
                    )
                    termsSection(
                        title: "3. Training Data Storage",
                        text: "You agree that RecBuddy may store your training data (including workout logs, pace, distance, heart rate, and coach notes) on secure servers. This data is used solely to provide and improve the service. We do not sell your personal training data to third parties."
                    )
                    termsSection(
                        title: "4. No Medical Advice",
                        text: "RecBuddy is a training management tool and does not provide medical advice, diagnosis, or treatment. Always consult a qualified healthcare professional before beginning or modifying any exercise program. Running and athletic training carry inherent risks; you participate at your own risk."
                    )
                    termsSection(
                        title: "5. Account Responsibility",
                        text: "You are responsible for maintaining the confidentiality of your account credentials. You are responsible for all activity that occurs under your account. Notify us immediately at kevin@recbuddy.app if you believe your account has been compromised."
                    )
                    termsSection(
                        title: "6. Account Deletion Rights",
                        text: "You may delete your account at any time from Settings → Delete account. Upon deletion, your profile, training logs, plan data, and chat history will be permanently removed from our servers. Coach links will be severed. This action is irreversible."
                    )
                    termsSection(
                        title: "7. Intellectual Property",
                        text: "The RecBuddy app, its design, and all associated content are owned by RecBuddy and protected by applicable intellectual property laws. Training plans created by your coach remain the intellectual property of your coach."
                    )
                    termsSection(
                        title: "8. Limitation of Liability",
                        text: "To the maximum extent permitted by law, RecBuddy shall not be liable for any indirect, incidental, or consequential damages arising from your use of the service, including injury sustained during training."
                    )
                    termsSection(
                        title: "9. Changes to Terms",
                        text: "We may update these Terms from time to time. Continued use of the app after changes constitutes acceptance of the revised Terms. Material changes will be communicated via the app or email."
                    )
                    termsSection(
                        title: "10. Contact",
                        text: "Questions about these Terms? Contact us at kevin@recbuddy.app."
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
