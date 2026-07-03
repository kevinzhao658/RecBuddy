import SwiftUI

struct SignInView: View {
    @Environment(SessionStore.self) private var session
    @State private var email = ""
    @State private var password = ""
    @State private var busy = false
    @State private var error: String?
    @State private var resetSent = false

    var body: some View {
        Form {
            Section {
                TextField("Email", text: $email)
                    .textContentType(.emailAddress).keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never).autocorrectionDisabled()
                SecureField("Password", text: $password).textContentType(.password)
            }
            if let error { Text(error).foregroundStyle(.red).font(.footnote) }
            if resetSent { Text("Reset link sent — check your email.").font(.footnote) }
            Section {
                Button(busy ? "Signing in…" : "Sign in") { Task { await submit() } }
                    .disabled(busy || email.isEmpty || password.isEmpty)
                Button("Forgot password?") { Task { await forgot() } }
                    .disabled(busy || email.isEmpty)
                    .font(.footnote)
            }
        }
        .navigationTitle("Sign in")
    }

    private func submit() async {
        busy = true; error = nil
        do { try await session.signIn(email: email.trimmingCharacters(in: .whitespaces), password: password) }
        catch { self.error = "Sign-in failed — check your email and password." }
        busy = false
    }

    private func forgot() async {
        busy = true; error = nil; resetSent = false
        do {
            // Lands on the web app's /reset-password page (same flow as coach).
            try await Supa.shared.auth.resetPasswordForEmail(
                email.trimmingCharacters(in: .whitespaces),
                redirectTo: URL(string: "https://recbuddy.app/reset-password"))
            resetSent = true
        } catch { self.error = "Could not send the reset email." }
        busy = false
    }
}
