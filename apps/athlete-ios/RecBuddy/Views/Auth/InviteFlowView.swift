import SwiftUI
import Supabase

// MARK: - Server model

private struct InvitePreview: Decodable {
    let coachName: String
    let coachInitials: String
    enum CodingKeys: String, CodingKey {
        case coachName = "coach_name"
        case coachInitials = "coach_initials"
    }
}

// MARK: - Sub-components

/// Radio card for experience level selection (step 2)
private struct ExperienceLevelCard: View {
    let title: String
    let subtitle: String
    let value: String
    @Binding var selected: String?

    var body: some View {
        let isSelected = selected == value
        Button { selected = value } label: {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text(title)
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(.white)
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(RB.textMute)
                }
                Spacer()
                ZStack {
                    Circle()
                        .stroke(isSelected ? RB.accent : RB.textFaint, lineWidth: 1.5)
                        .frame(width: 24, height: 24)
                    if isSelected {
                        Circle().fill(RB.accent).frame(width: 24, height: 24)
                        Image(systemName: "checkmark")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(RB.onAccent)
                    }
                }
            }
            .padding(14)
        }
        .buttonStyle(.plain)
        .background(RB.surface)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(isSelected ? RB.accent : RB.line, lineWidth: isSelected ? 1.5 : 1)
        )
    }
}

/// Chip for primary goal selection (step 2, 2×2 grid)
private struct GoalChip: View {
    let label: String
    let icon: String
    let value: String
    @Binding var selected: String?

    var body: some View {
        let isSelected = selected == value
        Button { selected = value } label: {
            HStack(spacing: 8) {
                Image(systemName: icon)
                    .foregroundStyle(isSelected ? RB.accent : RB.textMute)
                Text(label)
                    .font(.subheadline.weight(isSelected ? .bold : .regular))
                    .foregroundStyle(.white)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 14)
        }
        .buttonStyle(.plain)
        .background(RB.surface)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(isSelected ? RB.accent : RB.line, lineWidth: isSelected ? 1.5 : 1)
        )
    }
}

// MARK: - Main wizard

struct InviteFlowView: View {
    @Environment(SessionStore.self) private var session
    @Environment(\.dismiss) private var dismiss

    // Wizard navigation
    @State private var step = 1          // 1, 2, or 3
    @State private var sent = false      // shows confirmation screen

    // Step 1 — credentials
    @State private var name = ""
    @State private var email = ""
    @State private var password = ""

    // Step 2 — running profile
    // DB enum: athlete_level = 'new'|'returning'|'experienced'|'competitive'
    @State private var experienceLevel: String? = nil
    // DB enum: athlete_goal  = 'fit'|'first-race'|'pr'|'distance'
    @State private var primaryGoal: String? = nil

    // Step 3 — invite code
    @State private var code = ""
    @State private var coachName = ""
    @State private var coachInitials = ""
    @State private var codeResolved = false
    @State private var resolveTask: Task<Void, Never>?

    // Shared
    @State private var busy = false
    @State private var error: String?

    // ── Computed validity ──────────────────────────────────────────────────

    private var step1Valid: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty &&
        !email.trimmingCharacters(in: .whitespaces).isEmpty &&
        password.count >= 6
    }
    private var step2Valid: Bool { experienceLevel != nil && primaryGoal != nil }
    private var step3Valid: Bool { codeResolved }

    // ── Body ───────────────────────────────────────────────────────────────

    var body: some View {
        ZStack {
            RB.bg.ignoresSafeArea()

            if sent {
                sentScreen
            } else {
                VStack(spacing: 0) {
                    wizardChrome
                        .padding(.horizontal, 24)
                        .padding(.top, 12)
                        .padding(.bottom, 20)

                    ScrollView {
                        VStack(alignment: .leading, spacing: 0) {
                            stepContent
                        }
                        .padding(.horizontal, 24)
                        .padding(.bottom, 16)
                    }

                    pinnedButton
                        .padding(.horizontal, 24)
                        .padding(.bottom, 40)
                }
            }
        }
        .navigationBarBackButtonHidden(true)
        .toolbar(.hidden, for: .navigationBar)
    }

    // ── Wizard chrome ──────────────────────────────────────────────────────

    private var wizardChrome: some View {
        HStack(alignment: .center, spacing: 12) {
            Button { goBack() } label: {
                ZStack {
                    Circle().fill(RB.surface2).frame(width: 36, height: 36)
                    Image(systemName: "chevron.left")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.white)
                }
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Back")

            HStack(spacing: 4) {
                ForEach(1...3, id: \.self) { i in
                    Capsule()
                        .fill(i <= step ? RB.accent : RB.surface2)
                        .frame(height: 4)
                }
            }

            Text("\(step)/3")
                .font(.caption)
                .foregroundStyle(RB.textMute)
                .frame(width: 28, alignment: .trailing)
        }
    }

    // ── Step content ───────────────────────────────────────────────────────

    @ViewBuilder
    private var stepContent: some View {
        switch step {
        case 1:  step1View
        case 2:  step2View
        default: step3View
        }
    }

    // Step 1 — Create your account
    private var step1View: some View {
        VStack(alignment: .leading, spacing: 20) {
            stepHeader(
                title: "Create your account",
                subtitle: "Start your training journey with RecBuddy.")

            VStack(alignment: .leading, spacing: 6) {
                RBLabel("FULL NAME")
                TextField("", text: $name)
                    .textContentType(.name)
                    .foregroundStyle(.white)
                    .rbField()
                    .accessibilityLabel("Full name")
            }

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
                SecureField("At least 6 characters", text: $password)
                    .textContentType(.newPassword)
                    .foregroundStyle(.white)
                    .rbField()
                    .accessibilityLabel("Password, at least 6 characters")
            }

            if let error {
                Text(error).font(.footnote).foregroundStyle(.red)
            }
        }
    }

    // Step 2 — Your running
    private var step2View: some View {
        VStack(alignment: .leading, spacing: 20) {
            stepHeader(
                title: "Your running",
                subtitle: "This helps your coach tailor your plan.")

            // Experience level (4 radio cards)
            VStack(alignment: .leading, spacing: 10) {
                RBLabel("EXPERIENCE LEVEL")
                ExperienceLevelCard(
                    title: "New to running",
                    subtitle: "Just getting started",
                    value: "new",
                    selected: $experienceLevel)
                ExperienceLevelCard(
                    title: "Returning",
                    subtitle: "Getting back into it",
                    value: "returning",
                    selected: $experienceLevel)
                ExperienceLevelCard(
                    title: "Experienced",
                    subtitle: "Run regularly",
                    value: "experienced",
                    selected: $experienceLevel)
                ExperienceLevelCard(
                    title: "Competitive",
                    subtitle: "Racing to win",
                    value: "competitive",
                    selected: $experienceLevel)
            }

            // Primary goal (2×2 chip grid)
            VStack(alignment: .leading, spacing: 10) {
                RBLabel("PRIMARY GOAL")
                LazyVGrid(
                    columns: [GridItem(.flexible()), GridItem(.flexible())],
                    spacing: 10
                ) {
                    GoalChip(label: "Get fit",    icon: "heart",    value: "fit",        selected: $primaryGoal)
                    GoalChip(label: "First race", icon: "trophy",   value: "first-race", selected: $primaryGoal)
                    GoalChip(label: "Beat a PR",  icon: "bolt",     value: "pr",         selected: $primaryGoal)
                    GoalChip(label: "Go longer",  icon: "triangle", value: "distance",   selected: $primaryGoal)
                }
            }
        }
    }

    // Step 3 — Connect with your coach
    private var step3View: some View {
        VStack(alignment: .leading, spacing: 20) {
            stepHeader(
                title: "Connect with your coach",
                subtitle: "Enter the invite code your coach shared.")

            VStack(alignment: .leading, spacing: 6) {
                RBLabel("COACH INVITE CODE")
                TextField("", text: $code)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                    .foregroundStyle(.white)
                    .rbField()
                    .accessibilityLabel("Coach invite code")
                    .onChange(of: code) { _, newValue in
                        // Reset resolved state on any change
                        codeResolved = false
                        coachName = ""
                        error = nil
                        resolveTask?.cancel()
                        let trimmed = newValue.trimmingCharacters(in: .whitespaces).uppercased()
                        guard trimmed.count >= 4 else { return }
                        // Debounce 700 ms then resolve
                        resolveTask = Task {
                            try? await Task.sleep(for: .milliseconds(700))
                            guard !Task.isCancelled else { return }
                            await resolve(trimmed: trimmed)
                        }
                    }
            }

            // Inline match banner
            if codeResolved {
                HStack(spacing: 8) {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(RB.accent)
                    (Text("Code matches ")
                        + Text("Coach \(coachName)").bold())
                        .foregroundStyle(.white)
                }
                .font(.subheadline)
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(RB.surface)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(RB.accent.opacity(0.4), lineWidth: 1)
                )
            }

            if let error {
                Text(error).font(.footnote).foregroundStyle(.red)
            }
        }
    }

    // ── Pinned bottom button ───────────────────────────────────────────────

    @ViewBuilder
    private var pinnedButton: some View {
        if step < 3 {
            Button("CONTINUE ›") { advance() }
                .buttonStyle(VoltButtonStyle())
                .disabled(step == 1 ? !step1Valid : !step2Valid)
                .accessibilityLabel(step == 1 ? "Continue to step 2" : "Continue to step 3")
        } else {
            VStack(spacing: 12) {
                Button(busy ? "Creating account…" : "START TRAINING ›") {
                    Task { await signUp() }
                }
                .buttonStyle(VoltButtonStyle())
                .disabled(busy || !step3Valid)
                .accessibilityLabel("Start training")
            }
        }
    }

    // ── Sent confirmation screen ───────────────────────────────────────────

    private var sentScreen: some View {
        VStack(spacing: 0) {
            Spacer()
            VStack(spacing: 20) {
                Image(systemName: "envelope.circle.fill")
                    .font(.system(size: 64))
                    .foregroundStyle(RB.accent)
                    .accessibilityHidden(true)
                Text("Check your email")
                    .font(.title2.bold())
                    .foregroundStyle(.white)
                Text("If \(email) is new here, we sent it a confirmation link — confirm, then come back and sign in.")
                    .font(.subheadline)
                    .foregroundStyle(RB.textMute)
                    .multilineTextAlignment(.center)
                Text("Already have an account with this email? Just sign in — your invite code will be applied automatically.")
                    .font(.footnote)
                    .foregroundStyle(RB.textFaint)
                    .multilineTextAlignment(.center)
            }
            .padding(.horizontal, 36)

            if let error {
                Text(error)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .padding(.top, 16)
            }

            Spacer()

            VStack(spacing: 14) {
                Button(busy ? "Sending…" : "Resend email") {
                    Task { await resend() }
                }
                .buttonStyle(VoltButtonStyle(prominent: false))
                .disabled(busy)
                .accessibilityLabel("Resend confirmation email")

                Button("Go to sign in") { dismiss() }
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(RB.accent)
                    .accessibilityLabel("Go to sign in")
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 48)
        }
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private func stepHeader(title: String, subtitle: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.title2.bold())
                .foregroundStyle(.white)
            Text(subtitle)
                .font(.subheadline)
                .foregroundStyle(RB.textMute)
        }
    }

    private func goBack() {
        error = nil
        if step > 1 {
            step -= 1
        } else {
            dismiss()
        }
    }

    private func advance() {
        error = nil
        step += 1
    }

    // ── Network actions ────────────────────────────────────────────────────

    /// Resolve an invite code — called from debounce on step 3.
    private func resolve(trimmed: String) async {
        busy = true; error = nil
        do {
            let rows: [InvitePreview] = try await Supa.shared
                .rpc("resolve_invite", params: ["p_code": trimmed]).execute().value
            if let hit = rows.first {
                coachName = hit.coachName
                coachInitials = hit.coachInitials
                codeResolved = true
            } else {
                error = "That code is invalid, used, or expired."
            }
        } catch {
            self.error = "Could not check the code — are you online?"
        }
        busy = false
    }

    /// Submit sign-up with all wizard data, including experience + goal metadata.
    private func signUp() async {
        busy = true; error = nil
        let trimmedCode = code.trimmingCharacters(in: .whitespaces).uppercased()
        do {
            session.pendingInviteCode = trimmedCode // redeemed on first sign-in (SessionStore)
            let confirmRedirect = (Bundle.main.object(forInfoDictionaryKey: "EmailConfirmRedirect") as? String)
                .flatMap(URL.init(string:)) ?? URL(string: "https://recbuddy.app/confirmed")
            _ = try await Supa.shared.auth.signUp(
                email: email.trimmingCharacters(in: .whitespaces),
                password: password,
                data: [
                    "name": .string(name.trimmingCharacters(in: .whitespaces)),
                    "experience_level": .string(experienceLevel ?? "new"),
                    "primary_goal": .string(primaryGoal ?? "fit")
                ],
                redirectTo: confirmRedirect)
            // NOTE: if the email already has an account (e.g. a coach going
            // dual-role), GoTrue's anti-enumeration returns 200 with empty
            // identities and sends no email. We deliberately show the SAME
            // confirmation screen either way — a different message would leak
            // whether an email is registered. The screen's copy covers both
            // cases, and pendingInviteCode stays queued so an existing user who
            // signs in gets the invite applied automatically.
            sent = true
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
