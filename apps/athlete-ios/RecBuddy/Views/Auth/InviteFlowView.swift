import SwiftUI
import Supabase

private struct InvitePreview: Decodable {
    let coachName: String
    let coachInitials: String
    enum CodingKeys: String, CodingKey {
        case coachName = "coach_name"
        case coachInitials = "coach_initials"
    }
}

struct InviteFlowView: View {
    @Environment(SessionStore.self) private var session
    enum Phase { case code, form, sent }
    @State private var phase: Phase = .code
    @State private var code = ""
    @State private var coachName = ""
    @State private var coachInitials = ""
    @State private var name = ""
    @State private var email = ""
    @State private var password = ""
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        Form {
            switch phase {
            case .code:
                Section("Invite code") {
                    TextField("e.g. WELCOMERUN", text: $code)
                        .textInputAutocapitalization(.characters).autocorrectionDisabled()
                }
                if let error { Text(error).foregroundStyle(.red).font(.footnote) }
                Button(busy ? "Checking…" : "Continue") { Task { await resolve() } }
                    .disabled(busy || code.trimmingCharacters(in: .whitespaces).isEmpty)

            case .form:
                Section {
                    HStack(spacing: 10) {
                        Text(coachInitials)
                            .font(.caption.weight(.bold))
                            .frame(width: 34, height: 34)
                            .background(Color.green.opacity(0.2))
                            .clipShape(RoundedRectangle(cornerRadius: 9))
                        Text("You're joining \(coachName)").font(.headline)
                    }
                }
                Section("Create your account") {
                    TextField("Your name", text: $name).textContentType(.name)
                    TextField("Email", text: $email)
                        .textContentType(.emailAddress).keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never).autocorrectionDisabled()
                    SecureField("Password (min 6 characters)", text: $password)
                        .textContentType(.newPassword)
                }
                if let error { Text(error).foregroundStyle(.red).font(.footnote) }
                Button(busy ? "Creating…" : "Create account") { Task { await signUp() } }
                    .disabled(busy || name.isEmpty || email.isEmpty || password.count < 6)

            case .sent:
                Section {
                    Label("Check your email", systemImage: "envelope.badge")
                        .font(.headline)
                    Text("We sent a confirmation link to \(email). Confirm, then come back and sign in — your coach will be linked automatically.")
                        .font(.footnote).foregroundStyle(.secondary)
                }
                if let error { Text(error).foregroundStyle(.red).font(.footnote) }
                Button("Resend email") { Task { await resend() } }.disabled(busy)
                NavigationLink("Go to sign in") { SignInView() }
            }
        }
        .navigationTitle("Join your coach")
    }

    private func resolve() async {
        busy = true; error = nil
        let trimmed = code.trimmingCharacters(in: .whitespaces).uppercased()
        do {
            let rows: [InvitePreview] = try await Supa.shared
                .rpc("resolve_invite", params: ["p_code": trimmed]).execute().value
            if let hit = rows.first {
                coachName = hit.coachName
                coachInitials = hit.coachInitials
                code = trimmed
                phase = .form
            } else {
                error = "That code is invalid, used, or expired."
            }
        } catch { self.error = "Could not check the code — are you online?" }
        busy = false
    }

    private func signUp() async {
        busy = true; error = nil
        do {
            session.pendingInviteCode = code // redeemed on first sign-in (SessionStore)
            try await Supa.shared.auth.signUp(
                email: email.trimmingCharacters(in: .whitespaces),
                password: password,
                data: ["name": .string(name.trimmingCharacters(in: .whitespaces))])
            phase = .sent
        } catch {
            session.pendingInviteCode = nil
            self.error = error.localizedDescription.lowercased().contains("already registered")
                ? "That email is already registered — try signing in instead."
                : "Could not create the account. Check your details and try again."
        }
        busy = false
    }

    private func resend() async {
        busy = true; error = nil
        do { try await Supa.shared.auth.resend(email: email, type: .signup) }
        catch { self.error = "Could not resend — try again in a minute." }
        busy = false
    }
}
