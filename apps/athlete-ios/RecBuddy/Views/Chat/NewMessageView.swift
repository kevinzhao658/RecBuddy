import SwiftUI
import Supabase

/// iMessage-style "New message → To:". One person = 1:1, two or more = group.
/// If a chat with exactly these people exists, the server reopens it.
struct NewMessageView: View {
    let store: ConversationsStore
    let me: String
    var onOpen: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var selection = ComposeSelection(meIsAthlete: true)   // the iOS app user is an athlete
    @State private var groupName = ""
    @State private var message = ""
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                PeoplePicker(store: store, selection: $selection)
                if selection.isGroup {
                    TextField("", text: $groupName, prompt: Text("Group name (optional)").foregroundStyle(RB.textFaint))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 16).padding(.vertical, 10)
                        .overlay(Rectangle().fill(RB.line).frame(height: 1), alignment: .top)
                        .accessibilityLabel("Group name")
                }
                if let error {
                    Text(error).font(.footnote).foregroundStyle(.red).padding(.horizontal, 16).padding(.top, 6)
                }
                composer
            }
            .background(RB.bg.ignoresSafeArea())
            .navigationTitle("New message")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }.foregroundStyle(RB.accent)
                }
            }
        }
        .presentationDetents([.large])
    }

    private var composer: some View {
        HStack(spacing: 8) {
            TextField("", text: $message, prompt: Text("Message").foregroundStyle(RB.textFaint), axis: .vertical)
                .lineLimit(1...4)
                .foregroundStyle(.white)
                .padding(.horizontal, 14).padding(.vertical, 10)
                .background(RB.surface2)
                .clipShape(RoundedRectangle(cornerRadius: 20))
                .accessibilityLabel("Message")
            Button { Task { await send() } } label: {
                Image(systemName: "arrow.up")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(selection.canSend ? RB.onAccent : RB.textMute)
                    .frame(width: 36, height: 36)
                    .background(selection.canSend ? RB.accent : RB.surface2)
                    .clipShape(Circle())
            }
            .disabled(!selection.canSend || busy)
            .accessibilityLabel(message.isEmpty ? "Open conversation" : "Send message")
        }
        .padding(12)
        .overlay(Rectangle().fill(RB.line).frame(height: 1), alignment: .top)
    }

    private func send() async {
        busy = true; error = nil
        defer { busy = false }
        do {
            let name = groupName.trimmingCharacters(in: .whitespaces)
            let id = try await store.start(userIds: selection.userIds,
                                           title: selection.isGroup && !name.isEmpty ? name : nil)
            let body = message.trimmingCharacters(in: .whitespacesAndNewlines)
            if !body.isEmpty {
                struct NewMsg: Encodable { let thread_id: String; let from_user_id: String; let kind: String; let body: String }
                try await Supa.shared.from("messages")
                    .insert(NewMsg(thread_id: id, from_user_id: me, kind: "text", body: body)).execute()
            }
            onOpen(id)
        } catch {
            self.error = Moderation.filterMessage(error)
                ?? ((error as? PostgrestError)?.message.contains("can't add") == true
                    ? "One of those people can't be added to a chat."
                    : "Couldn't start that conversation. Try again.")
        }
    }
}

/// To: field with pills plus grouped search results (coaches, then athletes).
struct PeoplePicker: View {
    let store: ConversationsStore
    @Binding var selection: ComposeSelection
    var excluded: Set<String> = []
    @State private var query = ""
    @State private var results: [ChatPerson] = []

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            toField
            List {
                section("COACHES", results.filter { !$0.isAthlete })
                section("ATHLETES", results.filter(\.isAthlete))
                if selection.showsAthleteNote {
                    Text("Athletes in this group will see each other's names and messages.")
                        .font(.caption).foregroundStyle(RB.textMute)
                        .listRowBackground(Color.clear)
                }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
        }
        .task(id: query) {
            try? await Task.sleep(for: .milliseconds(250))
            guard !Task.isCancelled else { return }
            results = await store.search(query).filter { !excluded.contains($0.userId) }
        }
    }

    private var toField: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                Text("To:").foregroundStyle(RB.textFaint)
                ForEach(selection.people) { p in
                    Button { selection.toggle(p) } label: {
                        Text(p.name).font(.caption.weight(.bold)).foregroundStyle(RB.onAccent)
                            .padding(.horizontal, 10).padding(.vertical, 4)
                            .background(RB.accent).clipShape(Capsule())
                    }
                    .accessibilityLabel("Remove \(p.name)")
                }
                TextField("", text: $query)
                    .foregroundStyle(.white)
                    .textInputAutocapitalization(.words)
                    .autocorrectionDisabled()
                    .frame(minWidth: 120)
                    .accessibilityLabel("Search people")
            }
            .padding(.horizontal, 16).padding(.vertical, 10)
        }
        .overlay(Rectangle().fill(RB.line).frame(height: 1), alignment: .bottom)
    }

    @ViewBuilder private func section(_ label: String, _ people: [ChatPerson]) -> some View {
        if !people.isEmpty {
            Section {
                ForEach(people) { p in
                    Button { selection.toggle(p) } label: {
                        HStack(spacing: 10) {
                            Text(p.initials).font(.caption.weight(.bold)).foregroundStyle(.white)
                                .frame(width: 32, height: 32).background(RB.surface2).clipShape(Circle())
                            VStack(alignment: .leading, spacing: 1) {
                                Text(p.name).font(.subheadline.weight(.semibold)).foregroundStyle(.white)
                                Text(p.context).font(.caption).foregroundStyle(RB.textMute)
                            }
                            Spacer()
                            Image(systemName: selection.contains(p) ? "checkmark.circle.fill" : "circle")
                                .foregroundStyle(selection.contains(p) ? RB.accent : RB.textFaint)
                        }
                        .contentShape(Rectangle())   // whole row is tappable, not just the text
                    }
                    .buttonStyle(.plain)
                    .listRowBackground(Color.clear)
                    .accessibilityAddTraits(selection.contains(p) ? .isSelected : [])
                }
            } header: {
                Text(label).font(.system(size: 10, weight: .bold)).tracking(1).foregroundStyle(RB.textFaint)
            }
        }
    }
}
