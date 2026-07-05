import SwiftUI

/// Lets the athlete edit their display name, experience level, and primary goal.
struct NameProfileView: View {
    let profile: Profile
    @Environment(SessionStore.self) private var session
    @Environment(\.dismiss) private var dismiss

    @State private var name: String
    @State private var experienceLevel: String?
    @State private var primaryGoal: String?
    @State private var busy = false
    @State private var saved = false
    @State private var error: String?

    init(profile: Profile) {
        self.profile = profile
        _name = State(initialValue: profile.name)
        _experienceLevel = State(initialValue: profile.experienceLevel)
        _primaryGoal = State(initialValue: profile.primaryGoal)
    }

    private var hasChanges: Bool {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        return (trimmed != profile.name && !trimmed.isEmpty)
            || experienceLevel != profile.experienceLevel
            || primaryGoal != profile.primaryGoal
    }

    var body: some View {
        ZStack {
            RB.bg.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {

                    // ── Name ──────────────────────────────────────────────
                    VStack(alignment: .leading, spacing: 8) {
                        RBLabel("FULL NAME")
                        TextField("", text: $name)
                            .foregroundStyle(.white)
                            .rbField()
                            .accessibilityLabel("Full name")
                            .onChange(of: name) { _, _ in saved = false }
                    }

                    // ── Experience level ──────────────────────────────────
                    VStack(alignment: .leading, spacing: 10) {
                        RBLabel("EXPERIENCE LEVEL")
                        expCard(title: "New to running",  subtitle: "Just getting started",  value: "new")
                        expCard(title: "Returning",       subtitle: "Getting back into it",   value: "returning")
                        expCard(title: "Experienced",     subtitle: "Run regularly",           value: "experienced")
                        expCard(title: "Competitive",     subtitle: "Racing to win",           value: "competitive")
                    }

                    // ── Primary goal ──────────────────────────────────────
                    VStack(alignment: .leading, spacing: 10) {
                        RBLabel("PRIMARY GOAL")
                        LazyVGrid(
                            columns: [GridItem(.flexible()), GridItem(.flexible())],
                            spacing: 10
                        ) {
                            goalChip(label: "Get fit",    icon: "heart",    value: "fit")
                            goalChip(label: "First race", icon: "trophy",   value: "first-race")
                            goalChip(label: "Beat a PR",  icon: "bolt",     value: "pr")
                            goalChip(label: "Go longer",  icon: "triangle", value: "distance")
                        }
                    }

                    // ── Error ─────────────────────────────────────────────
                    if let error {
                        Text(error)
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }

                    // ── Save ──────────────────────────────────────────────
                    Button(busy ? "Saving…" : saved ? "Saved ✓" : "Save") {
                        Task { await save() }
                    }
                    .buttonStyle(VoltButtonStyle())
                    .disabled(busy || !hasChanges)
                }
                .padding(.horizontal, 20)
                .padding(.top, 20)
                .padding(.bottom, 40)
            }
        }
        .navigationTitle("Name & running profile")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarColorScheme(.dark, for: .navigationBar)
    }

    // MARK: – Sub-components

    private func expCard(title: String, subtitle: String, value: String) -> some View {
        let isSelected = experienceLevel == value
        return Button { experienceLevel = value; saved = false } label: {
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

    private func goalChip(label: String, icon: String, value: String) -> some View {
        let isSelected = primaryGoal == value
        return Button { primaryGoal = value; saved = false } label: {
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

    // MARK: – Action

    private func save() async {
        busy = true; error = nil; saved = false
        defer { busy = false }
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { error = "Name can't be empty."; return }
        do {
            var updates: [String: String] = ["name": trimmed]
            if let lvl = experienceLevel { updates["experience_level"] = lvl }
            if let goal = primaryGoal    { updates["primary_goal"] = goal }
            try await Supa.shared.from("profiles")
                .update(updates)
                .eq("id", value: profile.id)
                .execute()
            await session.refreshProfile()
            saved = true
        } catch {
            self.error = "Couldn't save — try again."
        }
    }
}
