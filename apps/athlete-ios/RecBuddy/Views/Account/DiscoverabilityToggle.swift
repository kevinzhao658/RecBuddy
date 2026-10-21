import SwiftUI

/// "Let my coach's other athletes find me" (profiles.discoverable_to_athletes).
/// Off hides you from other athletes' New-message search; coaches can still add you.
struct DiscoverabilityToggle: View {
    let userId: String
    @State private var on = true
    @State private var loaded = false
    @State private var error: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Toggle(isOn: Binding(get: { on }, set: { v in on = v; Task { await save(v) } })) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Let my coach's other athletes find me").foregroundStyle(.white)
                    Text("When off, other athletes can't start a chat with you. Your coaches still can.")
                        .font(.caption).foregroundStyle(RB.textFaint)
                }
            }
            .tint(RB.accent)
            .disabled(!loaded)
            if let error { Text(error).font(.caption).foregroundStyle(.red) }
        }
        .task { await load() }
    }

    private struct Row: Decodable { let discoverable_to_athletes: Bool }

    private func load() async {
        if let row: Row = try? await Supa.shared.from("profiles").select("discoverable_to_athletes")
            .eq("id", value: userId).single().execute().value {
            on = row.discoverable_to_athletes
        }
        loaded = true
    }

    private func save(_ value: Bool) async {
        error = nil
        do {
            try await Supa.shared.from("profiles").update(["discoverable_to_athletes": value])
                .eq("id", value: userId).execute()
        } catch {
            on = !value
            self.error = "Couldn't save. Try again."
        }
    }
}
