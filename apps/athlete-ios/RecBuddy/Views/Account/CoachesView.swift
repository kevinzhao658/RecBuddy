import SwiftUI

/// Shows the athlete's coaching team and lets them add a coach via invite code.
struct CoachesView: View {
    let profile: Profile
    @Environment(SessionStore.self) private var session

    @State private var team: [TeamMember] = []
    @State private var loading = true
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
                    } else if team.isEmpty {
                        Text("You're not linked to a coach yet.")
                            .font(.subheadline)
                            .foregroundStyle(RB.textMute)
                            .padding(.top, 8)
                    } else {
                        VStack(alignment: .leading, spacing: 10) {
                            RBLabel("YOUR COACHES")
                            ForEach(team) { member in
                                teamRow(member)
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
        .navigationTitle("Coaches")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .task { await loadTeam() }
    }

    // MARK: – Row

    private func teamRow(_ member: TeamMember) -> some View {
        HStack(spacing: 12) {
            // Avatar
            ZStack {
                Circle()
                    .fill(RB.surface2)
                    .frame(width: 44, height: 44)
                if let urlStr = member.avatarUrl, let url = URL(string: urlStr) {
                    AsyncImage(url: url) { phase in
                        if case .success(let img) = phase {
                            img.resizable()
                                .scaledToFill()
                                .frame(width: 44, height: 44)
                                .clipShape(Circle())
                        } else {
                            initialsText(member.initials)
                        }
                    }
                } else {
                    initialsText(member.initials)
                }
            }
            .accessibilityHidden(true)

            // Name + title
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

            // Relationship badge
            Text(member.relationship.capitalized)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(RB.accent)
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(RB.accent.opacity(0.15))
                .clipShape(Capsule())
        }
        .padding(14)
        .rbCard()
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
    var id: String { coachId }
    enum CodingKeys: String, CodingKey {
        case coachId = "coach_id"
        case relationship, name, title, initials
        case avatarUrl = "avatar_url"
    }
}
