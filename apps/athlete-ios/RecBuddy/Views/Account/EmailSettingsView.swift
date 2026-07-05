import SwiftUI
import Supabase

/// Two-phase email change:
/// Phase 1 — enter new email → "Send code" triggers auth.update(user:)
/// Phase 2 — enter 6-digit OTP → "Verify & update" completes the change
struct EmailSettingsView: View {
    let profile: Profile
    @Environment(SessionStore.self) private var session

    enum Phase { case enterEmail, enterCode }
    @State private var phase: Phase = .enterEmail

    // Phase 1
    @State private var newEmail = ""
    @State private var sendBusy = false
    @State private var sendError: String?

    // Phase 2
    @State private var code = ""
    @State private var verifyBusy = false
    @State private var verifyError: String?
    @State private var codeSentAt: Date? = nil
    @State private var success = false

    private var canResend: Bool {
        guard let t = codeSentAt else { return true }
        return Date().timeIntervalSince(t) >= 60
    }

    var body: some View {
        ZStack {
            RB.bg.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    switch phase {
                    case .enterEmail:
                        phase1View
                    case .enterCode:
                        phase2View
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 20)
                .padding(.bottom, 40)
            }
        }
        .navigationTitle("Email")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarColorScheme(.dark, for: .navigationBar)
    }

    // MARK: – Phase 1

    private var phase1View: some View {
        VStack(alignment: .leading, spacing: 20) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Current email")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
                Text(profile.email)
                    .font(.body)
                    .foregroundStyle(RB.textMute)
            }
            .padding(14)
            .rbCard()

            VStack(alignment: .leading, spacing: 8) {
                RBLabel("NEW EMAIL ADDRESS")
                TextField("", text: $newEmail)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .foregroundStyle(.white)
                    .rbField()
                    .accessibilityLabel("New email address")
            }

            if let sendError {
                Text(sendError)
                    .font(.footnote)
                    .foregroundStyle(.red)
            }

            Button(sendBusy ? "Sending…" : "Send verification code") {
                Task { await sendCode() }
            }
            .buttonStyle(VoltButtonStyle())
            .disabled(sendBusy || newEmail.trimmingCharacters(in: .whitespaces).isEmpty)

            Text("A 6-digit code will be sent to the new address.")
                .font(.caption)
                .foregroundStyle(RB.textFaint)
        }
    }

    // MARK: – Phase 2

    private var phase2View: some View {
        VStack(alignment: .leading, spacing: 20) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Code sent to")
                    .font(.caption)
                    .foregroundStyle(RB.textMute)
                Text(newEmail)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
            }

            if success {
                HStack(spacing: 8) {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(RB.accent)
                    Text("Email updated successfully.")
                        .font(.subheadline)
                        .foregroundStyle(.white)
                }
                .padding(14)
                .rbCard()
            } else {
                VStack(alignment: .leading, spacing: 8) {
                    RBLabel("VERIFICATION CODE")
                    TextField("", text: $code)
                        .keyboardType(.numberPad)
                        .foregroundStyle(.white)
                        .rbField()
                        .accessibilityLabel("6-digit verification code")
                        .onChange(of: code) { _, new in
                            code = String(new.filter(\.isNumber).prefix(6))
                        }
                }

                if let verifyError {
                    Text(verifyError)
                        .font(.footnote)
                        .foregroundStyle(.red)
                }

                Button(verifyBusy ? "Verifying…" : "Verify & update email") {
                    Task { await verify() }
                }
                .buttonStyle(VoltButtonStyle())
                .disabled(verifyBusy || code.count < 6)

                HStack(spacing: 16) {
                    Button(canResend ? "Resend code" : "Resend (wait 60 s)") {
                        Task { await sendCode() }
                    }
                    .font(.footnote)
                    .foregroundStyle(canResend ? RB.accent : RB.textFaint)
                    .disabled(!canResend || sendBusy)

                    Button("Cancel") {
                        phase = .enterEmail
                        code = ""
                        verifyError = nil
                    }
                    .font(.footnote)
                    .foregroundStyle(RB.textMute)
                }
            }
        }
    }

    // MARK: – Actions

    private func sendCode() async {
        sendBusy = true; sendError = nil
        defer { sendBusy = false }
        let trimmed = newEmail.trimmingCharacters(in: .whitespaces)
        do {
            try await Supa.shared.auth.update(user: UserAttributes(email: trimmed))
            codeSentAt = Date()
            phase = .enterCode
            code = ""
            verifyError = nil
        } catch {
            sendError = "Couldn't send the code — check the address and try again."
        }
    }

    private func verify() async {
        verifyBusy = true; verifyError = nil
        defer { verifyBusy = false }
        let trimmed = newEmail.trimmingCharacters(in: .whitespaces)
        do {
            try await Supa.shared.auth.verifyOTP(
                email: trimmed,
                token: code,
                type: .emailChange
            )
            await session.refreshProfile()
            success = true
        } catch {
            verifyError = "Invalid or expired code — try again or resend."
        }
    }
}
