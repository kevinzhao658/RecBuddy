import SwiftUI

struct AccountSheet: View {
    let profile: Profile
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

    var body: some View {
        NavigationStack {
            Form {
                Section("Profile") {
                    TextField("Name", text: $name)
                    Button("Save name") { Task { await saveName() } }
                        .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || name == profile.name)
                    if saved { Text("Saved.").font(.footnote).foregroundStyle(.green) }
                    if let saveError { Text(saveError).font(.footnote).foregroundStyle(.red) }
                }
                Section("Units") {
                    Picker("Distance unit", selection: $unitRaw) {
                        Text("Miles").tag("mi")
                        Text("Kilometers").tag("km")
                    }
                    .pickerStyle(.segmented)
                }
                if !hasCoach {
                    Section("Join a coach") {
                        Text("You're not linked to a coach yet. Enter an invite code to join one.")
                            .font(.footnote).foregroundStyle(.secondary)
                        TextField("Invite code", text: $joinCode)
                            .textInputAutocapitalization(.characters).autocorrectionDisabled()
                        if let joinError { Text(joinError).font(.footnote).foregroundStyle(.red) }
                        Button(joinBusy ? "Joining…" : "Join") { Task { await join() } }
                            .disabled(joinBusy || joinCode.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                }
                Section {
                    Button("Sign out", role: .destructive) {
                        Task { await session.signOut(); dismiss() }
                    }
                } footer: {
                    Text("Password changes and account deletion are available in the RecBuddy web app.")
                }
            }
            .navigationTitle("Account")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { Button("Done") { dismiss() } }
            .onAppear { name = profile.name }
            .task { await checkCoach() }
        }
    }

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
