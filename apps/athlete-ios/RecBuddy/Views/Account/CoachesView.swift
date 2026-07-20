import SwiftUI

/// Shows the athlete's team, lets them tune each coach's permission or remove a
/// coach, and add a new coach via invite code. The athlete is always admin.
struct CoachesView: View {
    let profile: Profile
    @Environment(SessionStore.self) private var session

    @State private var team: [TeamMember] = []
    @State private var loading = true
    @State private var teamError: String?
    @State private var pendingRemove: TeamMember?
    @State private var joinCode = ""
    @State private var joinBusy = false
    @State private var joinError: String?
    @State private var joinSuccess = false

    var body: some View {
        ZStack {
            RB.bg.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {

                    // ── Team list ──────────────────────────────────────────
                    if loading {
                        HStack { Spacer(); ProgressView().tint(RB.accent); Spacer() }
                            .padding(.top, 40)
                    } else {
                        VStack(alignment: .leading, spacing: 10) {
                            RBLabel("YOUR TEAM")
                            Text("Read = view + chat · Edit = change the plan · Admin = manage coaches")
                                .font(.caption)
                                .foregroundStyle(RB.textFaint)

                            // The athlete themselves — always admin, not editable.
                            selfRow

                            ForEach(team) { member in
                                teamRow(member)
                            }

                            if let teamError {
                                Text(teamError)
                                    .font(.footnote)
                                    .foregroundStyle(.red)
                            }
                        }
                    }

                    // ── Add a coach ────────────────────────────────────────
                    VStack(alignment: .leading, spacing: 10) {
                        RBLabel("ADD A COACH")

                        Text("Add another coach with the code they give you — they join as a co-coach and share your existing plan. Your first coach stays your head coach.")
                            .font(.caption)
                            .foregroundStyle(RB.textFaint)

                        VStack(alignment: .leading, spacing: 8) {
                            RBLabel("INVITE CODE")
                            TextField("", text: $joinCode)
                                .textInputAutocapitalization(.characters)
                                .autocorrectionDisabled()
                                .foregroundStyle(.white)
                                .rbField()
                                .accessibilityLabel("Invite code")
                                .onChange(of: joinCode) { _, _ in
                                    joinError = nil; joinSuccess = false
                                }
                        }

                        if let joinError {
                            Text(joinError)
                                .font(.footnote)
                                .foregroundStyle(.red)
                        }
                        if joinSuccess {
                            Text("Coach added!")
                                .font(.footnote)
                                .foregroundStyle(RB.accent)
                        }

                        Button(joinBusy ? "Adding…" : "Add coach") {
                            Task { await join() }
                        }
                        .buttonStyle(VoltButtonStyle())
                        .disabled(joinBusy || joinCode.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 20)
                .padding(.bottom, 40)
            }
        }
        .navigationTitle("Users")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .confirmationDialog(
            pendingRemove.map { "Remove \($0.name) from your team?" } ?? "",
            isPresented: Binding(
                get: { pendingRemove != nil },
                set: { if !$0 { pendingRemove = nil } }
            ),
            titleVisibility: .visible,
            presenting: pendingRemove
        ) { member in
            Button("Remove", role: .destructive) {
                Task { await removeCoach(coachId: member.coachId) }
            }
            Button("Cancel", role: .cancel) {}
        }
        .task { await loadTeam() }
    }

    // MARK: – Rows

    /// The athlete's own row — display-only, always admin.
    private var selfRow: some View {
        HStack(spacing: 12) {
            avatar(initials: profile.initials, avatarUrl: profile.avatarUrl)

            VStack(alignment: .leading, spacing: 2) {
                Text(profile.name)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
                Text("You")
                    .font(.caption)
                    .foregroundStyle(RB.textMute)
            }

            Spacer()

            badge("Admin")
        }
        .padding(14)
        .rbCard()
    }

    private func teamRow(_ member: TeamMember) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                avatar(initials: member.initials, avatarUrl: member.avatarUrl)

                VStack(alignment: .leading, spacing: 2) {
                    Text(member.name)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.white)
                    if let title = member.title, !title.isEmpty {
                        Text(title)
                            .font(.caption)
                            .foregroundStyle(RB.textMute)
                    }
                }

                Spacer()

                badge(member.relationship.capitalized)

                Button {
                    pendingRemove = member
                } label: {
                    Image(systemName: "trash")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(RB.textMute)
                        .frame(width: 32, height: 32)
                        .background(RB.surface2)
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Remove \(member.name)")
            }

            // Permission control
            HStack(spacing: 6) {
                permissionPill("Read", value: "read", member: member)
                permissionPill("Edit", value: "edit", member: member)
                permissionPill("Admin", value: "admin", member: member)
            }
        }
        .padding(14)
        .rbCard()
    }

    private func permissionPill(_ label: String, value: String, member: TeamMember) -> some View {
        let selected = member.permission == value
        return Button {
            guard !selected else { return }
            Task { await setPermission(coachId: member.coachId, to: value) }
        } label: {
            Text(label)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(selected ? RB.onAccent : RB.textMute)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 7)
                .background(selected ? RB.accent : RB.surface2)
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(label) permission")
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    private func badge(_ text: String) -> some View {
        Text(text)
            .font(.caption2.weight(.semibold))
            .foregroundStyle(RB.accent)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(RB.accent.opacity(0.15))
            .clipShape(Capsule())
    }

    private func avatar(initials: String, avatarUrl: String?) -> some View {
        ZStack {
            Circle()
                .fill(RB.surface2)
                .frame(width: 44, height: 44)
            if let urlStr = avatarUrl, let url = URL(string: urlStr) {
                AsyncImage(url: url) { phase in
                    if case .success(let img) = phase {
                        img.resizable()
                            .scaledToFill()
                            .frame(width: 44, height: 44)
                            .clipShape(Circle())
                    } else {
                        initialsText(initials)
                    }
                }
            } else {
                initialsText(initials)
            }
        }
        .accessibilityHidden(true)
    }

    private func initialsText(_ initials: String) -> some View {
        Text(initials)
            .font(.subheadline.weight(.bold))
            .foregroundStyle(.white)
    }

    // MARK: – Actions

    private func loadTeam() async {
        loading = true
        defer { loading = false }
        let rows: [TeamMember] = (try? await Supa.shared
            .rpc("get_team", params: ["p_athlete_id": profile.id])
            .execute().value) ?? []
        team = rows
    }

    private func setPermission(coachId: String, to permission: String) async {
        teamError = nil
        do {
            try await Supa.shared.rpc("set_coach_permission", params: [
                "p_coach_id": coachId,
                "p_athlete_id": profile.id,
                "p_permission": permission,
            ]).execute()
            await loadTeam()
        } catch {
            teamError = "Couldn't update permission. Please try again."
        }
    }

    private func removeCoach(coachId: String) async {
        teamError = nil
        do {
            try await Supa.shared.from("coach_athlete")
                .delete()
                .eq("coach_id", value: coachId)
                .eq("athlete_id", value: profile.id)
                .execute()
            await loadTeam()
        } catch {
            teamError = "Couldn't remove coach. Please try again."
        }
    }

    private func join() async {
        joinBusy = true; joinError = nil; joinSuccess = false
        defer { joinBusy = false }
        let code = joinCode.trimmingCharacters(in: .whitespaces).uppercased()
        do {
            try await Supa.shared.rpc("redeem_invite", params: ["p_code": code]).execute()
            joinCode = ""
            joinSuccess = true
            await loadTeam()
            await session.refreshProfile()
        } catch {
            joinError = InviteErrors.friendly(error)
        }
    }
}

// MARK: – Local model

private struct TeamMember: Decodable, Identifiable {
    let coachId: String
    let relationship: String
    let name: String
    let title: String?
    let initials: String
    let avatarUrl: String?
    let permission: String
    var id: String { coachId }
    enum CodingKeys: String, CodingKey {
        case coachId = "coach_id"
        case relationship, name, title, initials, permission
        case avatarUrl = "avatar_url"
    }
}
