import SwiftUI

struct AuthFlowView: View {
    @Environment(SessionStore.self) private var session
    @State private var email = ""
    @State private var password = ""
    @State private var busy = false
    @State private var error: String?
    @State private var resetSent = false

    var body: some View {
        NavigationStack {
            ZStack {
                RB.bg.ignoresSafeArea()
                VStack(spacing: 0) {
                    // ── Brand wordmark (top half) ──────────────────────────
                    Spacer()
                    VStack(spacing: 10) {
                        HStack(spacing: 0) {
                            Text("Rec")
                                .foregroundStyle(RB.accent)
                            Text("Buddy")
                                .foregroundStyle(.white)
                        }
                        .font(.system(size: 44, weight: .heavy))
                        .italic()
                        .fontWidth(.condensed)
                        .accessibilityLabel("RecBuddy")

                        Text("UNLEASH YOURSELF")
                            .font(.caption)
                            .kerning(3)
                            .foregroundStyle(RB.textMute)
                    }
                    Spacer()

                    // ── Inline sign-in form (bottom half) ─────────────────
                    VStack(spacing: 16) {
                        VStack(alignment: .leading, spacing: 6) {
                            RBLabel("EMAIL")
                            TextField("", text: $email)
                                .textContentType(.emailAddress)
                                .keyboardType(.emailAddress)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                                .foregroundStyle(.white)
                                .rbField()
                                .accessibilityLabel("Email address")
                        }

                        VStack(alignment: .leading, spacing: 6) {
                            RBLabel("PASSWORD")
                            SecureField("", text: $password)
                                .textContentType(.password)
                                .foregroundStyle(.white)
                                .rbField()
                                .accessibilityLabel("Password")
                        }

                        if let error {
                            Text(error)
                                .font(.footnote)
                                .foregroundStyle(.red)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }

                        Button(busy ? "Signing in…" : "LOG IN") {
                            Task { await submit() }
                        }
                        .buttonStyle(VoltButtonStyle())
                        .disabled(busy || email.isEmpty || password.isEmpty)
                        .accessibilityLabel("Log in")

                        if resetSent {
                            Text("Reset link sent — check your email.")
                                .font(.footnote)
                                .foregroundStyle(RB.textMute)
                                .multilineTextAlignment(.center)
                                .frame(maxWidth: .infinity)
                        }

                        Button("Forgot password?") {
                            Task { await forgot() }
                        }
                        .font(.subheadline)
                        .foregroundStyle(RB.textMute)
                        .disabled(busy || email.isEmpty)
                        .accessibilityLabel("Forgot password")

                        Divider().overlay(RB.line)

                        // Footer: sign-up link
                        HStack(spacing: 4) {
                            Text("New to RecBuddy?")
                                .foregroundStyle(RB.textMute)
                            NavigationLink {
                                InviteFlowView()
                            } label: {
                                Text("Create an account")
                                    .font(.subheadline.weight(.bold))
                                    .foregroundStyle(RB.accent)
                            }
                            .accessibilityLabel("Create an account")
                        }
                        .font(.subheadline)
                    }
                    .padding(.horizontal, 24)
                    .padding(.bottom, 48)
                }
            }
            .toolbar(.hidden, for: .navigationBar)
        }
    }

    // ── Auth logic (from SignInView) ───────────────────────────────────────

    private func submit() async {
        busy = true; error = nil; resetSent = false
        do {
            try await session.signIn(
                email: email.trimmingCharacters(in: .whitespaces),
                password: password)
        } catch {
            self.error = "Sign-in failed — check your email and password."
        }
        busy = false
    }

    private func forgot() async {
        busy = true; error = nil; resetSent = false
        do {
            // Config-driven: dev builds must land on a web app pointed at the SAME
            // Supabase project, or the token won't validate (prod: https://recbuddy.app).
            let redirect = (Bundle.main.object(forInfoDictionaryKey: "ResetPasswordRedirect") as? String)
                .flatMap(URL.init(string:)) ?? URL(string: "https://recbuddy.app/reset-password")
            try await Supa.shared.auth.resetPasswordForEmail(
                email.trimmingCharacters(in: .whitespaces),
                redirectTo: redirect)
            resetSent = true
        } catch {
            self.error = "Could not send the reset email."
        }
        busy = false
    }
}
