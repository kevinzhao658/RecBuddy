import SwiftUI

/// Chat Details: members (counted, me first), start date, add or remove
/// people, leave (groups) or hide (1:1). Renaming lives in the header menu. Team membership follows coaching,
/// so a team chat has no leave / hide, and adding people to it (like a 1:1)
/// starts a new group.
struct ConversationInfoView: View {
    let threadId: String
    let title: String
    let me: String
    var meInitials: String = ""
    let people: [ThreadPerson]
    let readOnly: Bool
    var isGroup: Bool = false
    var isTeam: Bool = false
    /// message_threads.created_at, shown as "Started".
    var startedAt: String? = nil
    /// Adding people to a 1:1 or team chat starts a new group: open it.
    var onOpenThread: (String) -> Void
    /// Called after leaving/hiding (pop back to the inbox).
    var onClose: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var store = ConversationsStore()
    @State private var adding = false
    @State private var startedGroup: String?
    @State private var addSelection = ComposeSelection(meIsAthlete: true)
    @State private var confirmLeave = false
    @State private var removing: ThreadPerson?
    /// Removed while this sheet is open (the chat reloads when it closes).
    @State private var removed: Set<String> = []
    private var shown: [ThreadPerson] { people.filter { !removed.contains($0.userId) } }
    private var canRemove: Bool { ChatPeople.canRemove(isTeam: isTeam, otherCount: shown.count, readOnly: readOnly) }
    @State private var error: String?

    var body: some View {
        NavigationStack {
            List {
                Section("\(shown.count + 1) people") {
                    personRow(initials: meInitials, name: "You")
                    ForEach(shown, id: \.userId) { p in
                        personRow(initials: p.initials, name: p.name)
                            .swipeActions(edge: .trailing) {
                                if canRemove {
                                    Button("Remove", role: .destructive) { removing = p }
                                        .tint(.red)   // the app-wide accent would turn it lime
                                }
                            }
                            .contextMenu {
                                if canRemove {
                                    Button(role: .destructive) { removing = p } label: {
                                        Label("Remove \(p.name)", systemImage: "person.badge.minus")
                                    }
                                }
                            }
                    }
                    if !readOnly {
                        Button { adding = true } label: { Label("Add People", systemImage: "person.badge.plus") }
                            .foregroundStyle(RB.accent)
                    }
                }
                if let started = ChatHeaderMenu.startedLabel(startedAt) {
                    Section("Details") {
                        LabeledContent("Started", value: started)
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
            .confirmationDialog(removing.map { "Remove \($0.name)?" } ?? "",
                                isPresented: Binding(get: { removing != nil }, set: { if !$0 { removing = nil } }),
                                titleVisibility: .visible, presenting: removing) { p in
                Button("Remove", role: .destructive) { Task { await remove(p) } }
                Button("Cancel", role: .cancel) {}
            } message: { _ in
                Text("They'll stop getting this conversation's messages. Anyone here can add them back.")
            }
            .confirmationDialog("Leave this conversation?", isPresented: $confirmLeave, titleVisibility: .visible) {
                Button("Leave", role: .destructive) { Task { await leave() } }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("You won't get new messages or see its history.")
            }
            .sheet(isPresented: $adding, onDismiss: {
                if let id = startedGroup { startedGroup = nil; onOpenThread(id) }
            }) { addSheet }
        }
    }

    private var addSheet: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if isTeam {
                    Text("This starts a new group with everyone here. The team chat stays private to the team.")
                        .font(.footnote).foregroundStyle(RB.textMute)
                        .frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal).padding(.vertical, 8)
                }
                PeoplePicker(store: store, selection: $addSelection, excluded: Set(shown.map(\.userId) + [me]))
            }
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
            if id != threadId {   // adding to a 1:1 or team chat starts a new group
                startedGroup = id   // opened once this sheet is gone
                adding = false
            } else {
                adding = false
                dismiss()
            }
        } catch {
            self.error = "Couldn't add those people. Try again."
        }
    }

    private func personRow(initials: String, name: String) -> some View {
        HStack(spacing: 10) {
            Text(initials).font(.caption.weight(.bold)).foregroundStyle(.white)
                .frame(width: 30, height: 30).background(RB.surface2).clipShape(Circle())
            Text(name).foregroundStyle(.white)
        }
    }

    private func remove(_ p: ThreadPerson) async {
        do {
            try await store.remove(threadId: threadId, userId: p.userId)
            removed.insert(p.userId)
        } catch {
            self.error = "Couldn't remove \(p.name). Try again."
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
