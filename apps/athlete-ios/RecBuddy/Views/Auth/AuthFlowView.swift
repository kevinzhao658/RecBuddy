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
                RB.bgGlow.ignoresSafeArea() // ambient lime radial (metal treatment)
                // Brand-panel glow from the web login (radial lime, top-leading)
                RadialGradient(colors: [RB.accent.opacity(0.16), .clear],
                               center: .init(x: 0.05, y: 0.05), startRadius: 0, endRadius: 320)
                    .ignoresSafeArea()
                VStack(spacing: 0) {
                    // ── Brand wordmark: two-tone embossed metal ────────────
                    Spacer()
                    VStack(spacing: 10) {
                        Wordmark(size: 46)

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

                        // Footer: two sign-up routes — with a coach code (leads
                        // the wizard, auto-populates details) or solo (add a
                        // coach later in Settings → Coaches).
                        NavigationLink {
                            InviteFlowView()
                        } label: {
                            Text("Create an account with a coach code")
                                .font(.subheadline.weight(.bold))
                                .foregroundStyle(RB.accent)
                        }
                        .accessibilityLabel("Create an account with a coach code")

                        NavigationLink {
                            InviteFlowView(requireCode: false)
                        } label: {
                            Text("No code? Sign up solo")
                                .font(.footnote)
                                .foregroundStyle(RB.textMute)
                        }
                        .accessibilityLabel("Sign up without a coach code")
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
            // Stay in the "Signing in…" state: the session pipeline (auth event →
            // invite redeem → profile fetch) is still running, and this whole view
            // is replaced when it lands. Resetting busy here made the button flip
            // back to LOG IN before the user was actually in the app.
        } catch {
            self.error = "Sign-in failed — check your email and password."
            busy = false
        }
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
