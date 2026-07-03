import SwiftUI

struct AccountSheet: View {
    let profile: Profile
    let plan: Plan?
    @Environment(SessionStore.self) private var session
    @Environment(\.dismiss) private var dismiss
    @AppStorage("unit") private var unitRaw = "mi"
    @State private var name: String = ""
    @State private var saved = false
    @State private var saveError: String?
    @State private var hasCoach = true
    @State private var joinCode = ""
    @State private var joinBusy = false
    @State private var joinError: String?

    // ── Goal & plan caption ────────────────────────────────────────────────

    private var planCaption: String {
        guard let plan else { return "" }
        var parts: [String] = []
        if let race = plan.goalRace, !race.isEmpty { parts.append(race) }
        if let date = plan.goalDate { parts.append(Week.fmtShortDate(date)) }
        return parts.joined(separator: " · ")
    }

    // ── Body ───────────────────────────────────────────────────────────────

    var body: some View {
        NavigationStack {
            ZStack {
                RB.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {

                        // ── Header ────────────────────────────────────────
                        VStack(spacing: 12) {
                            ZStack {
                                Circle()
                                    .fill(RB.surface2)
                                    .frame(width: 56, height: 56)
                                Text(profile.initials)
                                    .font(.title3.weight(.bold))
                                    .foregroundStyle(.white)
                            }
                            .accessibilityHidden(true)

                            VStack(spacing: 4) {
                                Text(profile.name)
                                    .font(.title2.bold())
                                    .foregroundStyle(.white)
                                Text(profile.email)
                                    .font(.subheadline)
                                    .foregroundStyle(RB.textMute)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.top, 8)
                        .padding(.bottom, 4)

                        // ── Name edit ─────────────────────────────────────
                        VStack(alignment: .leading, spacing: 8) {
                            RBLabel("YOUR NAME")
                            TextField("", text: $name)
                                .foregroundStyle(.white)
                                .rbField()
                                .accessibilityLabel("Your name")

                            if name.trimmingCharacters(in: .whitespaces) != profile.name
                                && !name.trimmingCharacters(in: .whitespaces).isEmpty {
                                Button(saved ? "Saved ✓" : "Save name") {
                                    Task { await saveName() }
                                }
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(saved ? RB.textMute : RB.accent)
                            }
                            if let saveError {
                                Text(saveError).font(.footnote).foregroundStyle(.red)
                            }
                        }

                        // ── Goal & plan row ───────────────────────────────
                        if plan != nil {
                            settingRow(
                                icon: "target",
                                title: "Goal & plan",
                                subtitle: planCaption)
                        }

                        // ── Units ─────────────────────────────────────────
                        VStack(alignment: .leading, spacing: 8) {
                            RBLabel("DISTANCE UNIT")
                            Picker("", selection: $unitRaw) {
                                Text("Miles").tag("mi")
                                Text("Kilometers").tag("km")
                            }
                            .pickerStyle(.segmented)
                        }

                        // ── Join a coach ──────────────────────────────────
                        if !hasCoach {
                            VStack(alignment: .leading, spacing: 10) {
                                RBLabel("JOIN A COACH")
                                Text("You're not linked to a coach yet. Enter an invite code to join one.")
                                    .font(.footnote)
                                    .foregroundStyle(RB.textMute)
                                TextField("Invite code", text: $joinCode)
                                    .textInputAutocapitalization(.characters)
                                    .autocorrectionDisabled()
                                    .foregroundStyle(.white)
                                    .rbField()
                                    .accessibilityLabel("Invite code")
                                if let joinError {
                                    Text(joinError).font(.footnote).foregroundStyle(.red)
                                }
                                Button(joinBusy ? "Joining…" : "Join") {
                                    Task { await join() }
                                }
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(RB.onAccent)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                                .background(RB.accent)
                                .clipShape(Capsule())
                                .disabled(joinBusy || joinCode.trimmingCharacters(in: .whitespaces).isEmpty)
                                .accessibilityLabel("Join coach")
                            }
                        }

                        // ── Log out pill ──────────────────────────────────
                        Button {
                            Task { await session.signOut(); dismiss() }
                        } label: {
                            Text("Log out")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(Color.red)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 16)
                                .background(Color.red.opacity(0.15))
                                .clipShape(Capsule())
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Log out")

                        // ── Footer note ───────────────────────────────────
                        Text("Password changes and account deletion are available in the RecBuddy web app.")
                            .font(.caption)
                            .foregroundStyle(RB.textFaint)
                            .multilineTextAlignment(.center)
                            .frame(maxWidth: .infinity)
                            .padding(.bottom, 8)
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 32)
                }
            }
            .navigationTitle("Account")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .foregroundStyle(RB.accent)
                }
            }
            .onAppear { name = profile.name }
            .task { await checkCoach() }
        }
        .presentationDragIndicator(.visible)
    }

    // ── Row card helper ────────────────────────────────────────────────────

    private func settingRow(icon: String, title: String, subtitle: String) -> some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 8)
                    .fill(RB.surface2)
                    .frame(width: 36, height: 36)
                Image(systemName: icon)
                    .font(.system(size: 15))
                    .foregroundStyle(RB.textMute)
            }
            .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
                if !subtitle.isEmpty {
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(RB.textMute)
                }
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(RB.textFaint)
        }
        .padding(14)
        .background(RB.surface)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(RB.line, lineWidth: 1))
    }

    // ── Actions ────────────────────────────────────────────────────────────

    private func saveName() async {
        saveError = nil; saved = false
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        do {
            try await Supa.shared.from("profiles")
                .update(["name": trimmed]).eq("id", value: profile.id).execute()
            await session.refreshProfile()
            saved = true
        } catch {
            saveError = "Couldn't save — try again."
        }
    }

    private func checkCoach() async {
        struct Row: Decodable { let coach_id: String }
        let rows: [Row] = (try? await Supa.shared.from("coach_athlete")
            .select("coach_id").limit(1).execute().value) ?? []
        hasCoach = !rows.isEmpty
    }

    private func join() async {
        joinBusy = true; joinError = nil
        defer { joinBusy = false }
        let code = joinCode.trimmingCharacters(in: .whitespaces).uppercased()
        do {
            try await Supa.shared.rpc("redeem_invite", params: ["p_code": code]).execute()
            joinCode = ""
            await checkCoach()
            await session.refreshProfile()
        } catch {
            joinError = "That code is invalid, used, or expired."
        }
    }
}
