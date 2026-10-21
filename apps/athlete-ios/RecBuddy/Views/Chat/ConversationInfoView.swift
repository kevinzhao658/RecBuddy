import SwiftUI

/// Chat Details: members, start date, add people, leave (groups) or hide
/// (1:1). Renaming lives in the header menu. Team membership follows coaching,
/// so a team chat has no add / leave / hide.
struct ConversationInfoView: View {
    let threadId: String
    let title: String
    let me: String
    let people: [ThreadPerson]
    let readOnly: Bool
    var isGroup: Bool = false
    var isTeam: Bool = false
    /// message_threads.created_at, shown as "Started".
    var startedAt: String? = nil
    /// Called after leaving/hiding (pop back to the inbox).
    var onClose: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var store = ConversationsStore()
    @State private var adding = false
    @State private var addSelection = ComposeSelection(meIsAthlete: true)
    @State private var confirmLeave = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            List {
                Section("People") {
                    ForEach(people, id: \.userId) { p in
                        HStack(spacing: 10) {
                            Text(p.initials).font(.caption.weight(.bold)).foregroundStyle(.white)
                                .frame(width: 30, height: 30).background(RB.surface2).clipShape(Circle())
                            Text(p.name).foregroundStyle(.white)
                        }
                    }
                    if !readOnly && !isTeam {
                        Button { adding = true } label: { Label("Add People", systemImage: "person.badge.plus") }
                            .foregroundStyle(RB.accent)
                    }
                }
                if let started = ChatHeaderMenu.startedLabel(startedAt) {
                    Section("Details") {
                        LabeledContent("Started", value: started)
                        LabeledContent("Members", value: "\(people.count + 1)")
                    }
                }
                if !isTeam {
                Section {
                    if isGroup {
                        Button("Leave Conversation", role: .destructive) { confirmLeave = true }
                    } else {
                        Button("Hide Conversation") { Task { await hide() } }
                            .foregroundStyle(RB.textMute)
                    }
                } footer: {
                    if readOnly { Text("This conversation is read-only.") }
                }
                }
                if let error {
                    Text(error).font(.footnote).foregroundStyle(.red)
                }
            }
            .scrollContentBackground(.hidden)
            .background(RB.bg.ignoresSafeArea())
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() }.foregroundStyle(RB.accent) }
            }
            .confirmationDialog("Leave this conversation?", isPresented: $confirmLeave, titleVisibility: .visible) {
                Button("Leave", role: .destructive) { Task { await leave() } }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("You won't get new messages or see its history.")
            }
            .sheet(isPresented: $adding) { addSheet }
        }
    }

    private var addSheet: some View {
        NavigationStack {
            PeoplePicker(store: store, selection: $addSelection, excluded: Set(people.map(\.userId) + [me]))
                .background(RB.bg.ignoresSafeArea())
                .navigationTitle("Add People")
                .navigationBarTitleDisplayMode(.inline)
                .toolbarColorScheme(.dark, for: .navigationBar)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button("Cancel") { adding = false }.foregroundStyle(RB.accent) }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Add") { Task { await add() } }.foregroundStyle(RB.accent).disabled(!addSelection.canSend)
                    }
                }
        }
    }

    private func add() async {
        do {
            let id = try await store.add(threadId: threadId, userIds: addSelection.userIds)
            adding = false
            if id != threadId {   // adding to a 1:1 starts a new group
                AppRouter.shared.openThreadId = id
                onClose()
            } else {
                dismiss()
            }
        } catch {
            self.error = "Couldn't add those people. Try again."
        }
    }

    private func leave() async {
        do { try await store.leave(threadId: threadId); onClose() }
        catch { self.error = "Couldn't leave. Try again." }
    }

    private func hide() async {
        do { try await store.hide(threadId: threadId); onClose() }
        catch { self.error = "Couldn't hide. Try again." }
    }
}
