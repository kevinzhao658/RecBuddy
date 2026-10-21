import SwiftUI

/// Members, group name, add people, leave (groups) or hide (1:1).
struct ConversationInfoView: View {
    let threadId: String
    let title: String
    let me: String
    let people: [ThreadPerson]
    let readOnly: Bool
    var isGroup: Bool = false
    /// Called after leaving/hiding (pop back to the inbox).
    var onClose: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var store = ConversationsStore()
    @State private var name = ""
    @State private var adding = false
    @State private var addSelection = ComposeSelection(meIsAthlete: true)
    @State private var confirmLeave = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            List {
                if isGroup && !readOnly {
                    Section("Group name") {
                        HStack {
                            TextField("", text: $name, prompt: Text("Add a name").foregroundStyle(RB.textFaint))
                                .foregroundStyle(.white)
                                .accessibilityLabel("Group name")
                            Button("Save") { Task { await rename() } }
                                .foregroundStyle(RB.accent)
                                .disabled(name.trimmingCharacters(in: .whitespaces) == title)
                        }
                    }
                }
                Section("People") {
                    ForEach(people, id: \.userId) { p in
                        HStack(spacing: 10) {
                            Text(p.initials).font(.caption.weight(.bold)).foregroundStyle(.white)
                                .frame(width: 30, height: 30).background(RB.surface2).clipShape(Circle())
                            Text(p.name).foregroundStyle(.white)
                        }
                    }
                    if !readOnly {
                        Button { adding = true } label: { Label("Add People", systemImage: "person.badge.plus") }
                            .foregroundStyle(RB.accent)
                    }
                }
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
        .onAppear { name = isGroup ? title : "" }
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

    private func rename() async {
        do { try await store.rename(threadId: threadId, title: name) }
        catch { self.error = Moderation.filterMessage(error) ?? "Couldn't rename. Try again." }
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
