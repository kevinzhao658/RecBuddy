import SwiftUI

struct ChatView: View {
    let profile: Profile
    @State private var store = ChatStore()
    @State private var draft = ""
    @State private var busy = false
    @State private var sendError: String?

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: 10) {
                            ForEach(store.messages) { m in
                                MessageRow(message: m, mine: m.fromUserId == profile.id,
                                           senderName: store.senders[m.fromUserId]?.name)
                                    .id(m.id)
                            }
                        }
                        .padding(12)
                    }
                    .onChange(of: store.messages.count) {
                        if let last = store.messages.last?.id {
                            withAnimation { proxy.scrollTo(last, anchor: .bottom) }
                        }
                    }
                }
                if case .error(let msg) = store.phase {
                    Label(msg, systemImage: "wifi.exclamationmark")
                        .font(.footnote).foregroundStyle(.red).padding(.bottom, 4)
                }
                if let sendError {
                    Text(sendError).font(.footnote).foregroundStyle(.red).padding(.bottom, 2)
                }
                HStack(spacing: 8) {
                    TextField("Message your coach…", text: $draft, axis: .vertical).lineLimit(1...4)
                        .textFieldStyle(.roundedBorder)
                    Button {
                        Task { await send() }
                    } label: { Image(systemName: "arrow.up.circle.fill").font(.title2) }
                    .accessibilityLabel("Send message")
                    .disabled(busy || draft.trimmingCharacters(in: .whitespaces).isEmpty)
                }
                .padding(12)
            }
            .navigationTitle("Chat")
            .navigationBarTitleDisplayMode(.inline)
            .task { await store.open(athleteId: profile.id) }
            .onDisappear { Task { await store.close() } }
        }
    }

    private func send() async {
        let body = draft.trimmingCharacters(in: .whitespaces)
        guard !body.isEmpty else { return }
        busy = true
        sendError = nil
        defer { busy = false }
        do {
            try await store.send(body, from: profile.id)
            draft = "" // clear only on success — a failed send keeps the text
        } catch {
            sendError = "Couldn't send — try again."
        }
    }
}
