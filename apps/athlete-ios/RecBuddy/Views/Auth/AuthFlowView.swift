import SwiftUI
import Supabase

struct AuthFlowView: View {
    @Environment(SessionStore.self) private var session
    @State private var email = ""
    @State private var password = ""
    @State private var busy = false
    @State private var error: String?
    @State private var resetSent = false
    @State private var showResetPrompt = false
    @State private var resetEmail = ""
    /// Resends are locked until this time, since each new email invalidates the previous link.
    @State private var resendAvailableAt: Date?

    private var trimmedEmail: String { email.trimmingCharacters(in: .whitespaces) }

    /// Whole seconds until another reset email may be requested (0 = allowed).
    private func resendWait(at now: Date) -> Int {
        guard let resendAvailableAt else { return 0 }
        return max(0, Int(resendAvailableAt.timeIntervalSince(now).rounded(.up)))
    }

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
                            Text("Reset link sent. Check your email.")
                                .font(.footnote)
                                .foregroundStyle(RB.textMute)
                                .multilineTextAlignment(.center)
                                .frame(maxWidth: .infinity)
                        }

                        // Ask for the email (pre-filled from the form) before sending, then
                        // hold off resends for a minute: every new email invalidates the last link.
                        TimelineView(.periodic(from: .now, by: 1)) { context in
                            let wait = resendWait(at: context.date)
                            Button(wait > 0 ? "Resend link in \(wait)s" : "Forgot password?") {
                                resetEmail = trimmedEmail
                                showResetPrompt = true
                            }
                            .font(.subheadline)
                            .foregroundStyle(RB.textMute)
                            .disabled(busy || wait > 0)
                            .accessibilityLabel(wait > 0 ? "Resend reset link in \(wait) seconds" : "Forgot password")
                        }
                        .alert("Reset your password", isPresented: $showResetPrompt) {
                            TextField("Email address", text: $resetEmail)
                                .textContentType(.emailAddress)
                                .keyboardType(.emailAddress)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                            Button("Cancel", role: .cancel) {}
                            Button("Send link") {
                                Task { await forgot() }
                            }
                            .disabled(resetEmail.trimmingCharacters(in: .whitespaces).isEmpty)
                        } message: {
                            Text("Enter the email you signed up with and we'll send you a link to reset your password.")
                        }

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
        let address = resetEmail.trimmingCharacters(in: .whitespaces)
        guard !address.isEmpty else { return }
        email = address // keep the sign-in form in sync with what was sent
        busy = true; error = nil; resetSent = false
        // Supabase's reset silently succeeds for unknown addresses, so check first.
        if await emailHasAccount(address) == false {
            self.error = "We couldn't find an account with that email."
            busy = false
            return
        }
        do {
            // Config-driven: dev builds must land on a web app pointed at the SAME
            // Supabase project, or the token won't validate (prod: https://recbuddy.app).
            let redirect = (Bundle.main.object(forInfoDictionaryKey: "ResetPasswordRedirect") as? String)
                .flatMap(URL.init(string:)) ?? URL(string: "https://recbuddy.app/reset-password")
            try await Supa.shared.auth.resetPasswordForEmail(address, redirectTo: redirect)
            resetSent = true
            resendAvailableAt = .now.addingTimeInterval(60)
        } catch AuthError.api(_, _, _, let response) where response.statusCode == 429 {
            self.error = "Too many reset requests. Please wait a minute and try again."
            resendAvailableAt = .now.addingTimeInterval(60)
        } catch {
            self.error = "We couldn't send the reset email. Please try again."
        }
        busy = false
    }

    /// nil when the check can't run (offline, backend without the RPC yet), so the
    /// caller falls back to sending rather than blocking a real reset.
    private func emailHasAccount(_ address: String) async -> Bool? {
        do {
            let exists: Bool = try await Supa.shared
                .rpc("email_has_account", params: ["p_email": address])
                .execute()
                .value
            return exists
        } catch {
            return nil
        }
    }
}
