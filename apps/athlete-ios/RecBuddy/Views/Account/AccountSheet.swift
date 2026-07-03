import SwiftUI

struct AccountSheet: View {
    let profile: Profile
    @Environment(SessionStore.self) private var session
    @Environment(\.dismiss) private var dismiss
    @AppStorage("unit") private var unitRaw = "mi"
    @State private var name: String = ""
    @State private var saved = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Profile") {
                    TextField("Name", text: $name)
                    Button("Save name") { Task { await saveName() } }
                        .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || name == profile.name)
                    if saved { Text("Saved.").font(.footnote).foregroundStyle(.green) }
                }
                Section("Units") {
                    Picker("Distance unit", selection: $unitRaw) {
                        Text("Miles").tag("mi")
                        Text("Kilometers").tag("km")
                    }
                    .pickerStyle(.segmented)
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
        }
    }

    private func saveName() async {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        _ = try? await Supa.shared.from("profiles")
            .update(["name": trimmed]).eq("id", value: profile.id).execute()
        await session.refreshProfile()
        saved = true
    }
}
