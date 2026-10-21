import SwiftUI

/// The Chat tab: a Messages-style inbox. The athlete's team chat is pinned
/// first, then 1:1s and groups by recency. Tapping a row pushes ChatView.
struct ChatsView: View {
    let profile: Profile
    @Environment(SessionStore.self) private var session
    @State private var store = ConversationsStore()
    @State private var path: [String] = []          // thread ids
    @State private var query = ""
    @State private var composing = false
    private let router = AppRouter.shared

    private var filtered: [Conversation] {
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        guard !q.isEmpty else { return store.conversations }
        return store.conversations.filter { c in
            c.displayTitle.lowercased().contains(q) || c.members.contains { $0.name.lowercased().contains(q) }
        }
    }

    var body: some View {
        NavigationStack(path: $path) {
            ZStack {
                RB.bg.ignoresSafeArea()
                if store.loaded && store.conversations.isEmpty {
                    emptyState
                } else {
                    list
                }
            }
            .navigationTitle("Chats")
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { composing = true } label: {
                        Image(systemName: "square.and.pencil")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(RB.accent)
                    }
                    .accessibilityLabel("New message")
                }
            }
            .navigationDestination(for: String.self) { threadId in
                ChatView(profile: profile, threadId: threadId,
                         conversation: store.conversations.first { $0.id == threadId })
                    .toolbar(.hidden, for: .navigationBar)
            }
        }
        .task { await store.load(); await store.subscribe(me: profile.id) }
        .onChange(of: session.hasCoach) { Task { await store.load() } }
        .onChange(of: path) {
            router.inConversation = !path.isEmpty
            if path.isEmpty { Task { await store.load() } }  // unread refresh on return
        }
        // Push tap → open that thread.
        .onChange(of: router.openThreadId, initial: true) { _, id in
            guard let id else { return }
            path = [id]
            router.openThreadId = nil
        }
        // "Message coach about this" → open the team chat; ChatView attaches the workout.
        .onChange(of: router.pendingWorkoutQuote, initial: true) { _, q in
            guard q != nil else { return }
            Task { await openTeamChat() }
        }
        .sheet(isPresented: $composing) {
            NewMessageView(store: store, me: profile.id) { threadId in
                composing = false
                path = [threadId]
            }
        }
    }

    private func openTeamChat() async {
        if let team = store.conversations.first(where: { $0.isTeam && $0.teamAthleteId == profile.id }) {
            path = [team.id]
        } else if let id = try? await ChatShare.teamThreadId(athleteId: profile.id) {
            path = [id]
        }
    }

    // ── List ──────────────────────────────────────────────────────────────

    private var list: some View {
        List {
            TextField("", text: $query, prompt: Text("Search").foregroundStyle(RB.textFaint))
                .foregroundStyle(.white)
                .padding(.horizontal, 12).padding(.vertical, 8)
                .background(RB.surface)
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
                .accessibilityLabel("Search chats")
            if let error = store.error {
                Text(error).font(.footnote).foregroundStyle(.red)
                    .listRowBackground(Color.clear)
            }
            ForEach(filtered) { c in
                Button { path.append(c.id) } label: { row(c) }
                    .buttonStyle(.plain)
                    .listRowBackground(Color.clear)
                    .listRowSeparatorTint(RB.line)
                    .swipeActions(edge: .trailing) {
                        if !c.isTeam {
                            Button("Hide") { Task { try? await store.hide(threadId: c.id) } }
                                .tint(RB.surface2)
                        }
                    }
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .refreshable { await store.load() }
    }

    private func row(_ c: Conversation) -> some View {
        HStack(spacing: 12) {
            avatars(c)
            VStack(alignment: .leading, spacing: 2) {
                HStack(alignment: .firstTextBaseline) {
                    Text(c.displayTitle)
                        .font(.subheadline.weight(c.unread > 0 ? .bold : .semibold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    Spacer(minLength: 6)
                    if let at = c.lastAt {
                        Text(Self.timeLabel(at)).font(.caption2).foregroundStyle(RB.textFaint)
                    }
                }
                Text(c.previewLine(me: profile.id))
                    .font(.caption)
                    .foregroundStyle(c.unread > 0 ? .white : RB.textMute)
                    .lineLimit(1)
            }
            if c.unread > 0 {
                Circle().fill(RB.accent).frame(width: 9, height: 9)
                    .accessibilityLabel("\(c.unread) unread")
            }
        }
        .padding(.vertical, 6)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityHint(c.isTeam ? "Team chat" : "")
    }

    @ViewBuilder private func avatars(_ c: Conversation) -> some View {
        let people = Array(c.members.prefix(2))
        ZStack {
            if people.count >= 2 {
                avatar(people[0], size: 28).offset(x: -7, y: -7)
                avatar(people[1], size: 28).offset(x: 7, y: 7)
            } else if let p = people.first {
                avatar(p, size: 42)
            } else {
                Circle().fill(RB.surface2).frame(width: 42, height: 42)
            }
        }
        .frame(width: 44, height: 44)
        // Team chats carry a small green "Team" pill on the avatar (same as coach web).
        .overlay(alignment: .bottom) {
            if c.isTeam {
                Text("TEAM")
                    .font(.system(size: 8, weight: .heavy)).tracking(0.5)
                    .foregroundStyle(RB.onAccent)
                    .padding(.horizontal, 5).padding(.vertical, 1.5)
                    .background(RB.accent, in: Capsule())
                    .overlay(Capsule().stroke(RB.bg, lineWidth: 2))
                    .offset(y: 5)
            }
        }
        .accessibilityHidden(true)
    }

    private func avatar(_ m: ConversationMember, size: CGFloat) -> some View {
        ZStack {
            Circle().fill(RB.surface2)
            if let url = m.avatarUrl.flatMap(URL.init(string:)) {
                AsyncImage(url: url) { $0.resizable().scaledToFill() } placeholder: {
                    Text(m.initials).font(.system(size: size * 0.32, weight: .bold)).foregroundStyle(.white)
                }
                .clipShape(Circle())
            } else {
                Text(m.initials).font(.system(size: size * 0.32, weight: .bold)).foregroundStyle(.white)
            }
        }
        .frame(width: size, height: size)
        .overlay(Circle().stroke(RB.bg, lineWidth: 2))
    }

    private var emptyState: some View {
        VStack(spacing: 10) {
            Image(systemName: "bubble.left.and.exclamationmark.bubble.right")
                .font(.system(size: 34)).foregroundStyle(RB.textFaint)
            Text("No chats yet").font(.headline).foregroundStyle(.white)
            Text("Chat opens once you're connected to a coach. Add one with an invite code in Settings → Coaches.")
                .font(.subheadline).foregroundStyle(RB.textMute).multilineTextAlignment(.center)
        }
        .padding(.horizontal, 40)
    }

    // ── Time label: 2:16 PM · Yesterday · Thu · Oct 12 ───────────────────

    private static let iso: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; return f
    }()
    private static let isoBasic = ISO8601DateFormatter()

    static func timeLabel(_ s: String, now: Date = Date()) -> String {
        guard let d = iso.date(from: s) ?? isoBasic.date(from: s) else { return "" }
        let cal = Calendar.current
        let f = DateFormatter()
        if cal.isDateInToday(d) { f.dateFormat = "h:mm a" }
        else if cal.isDateInYesterday(d) { return "Yesterday" }
        else if let days = cal.dateComponents([.day], from: d, to: now).day, days < 7 { f.dateFormat = "EEE" }
        else { f.dateFormat = "MMM d" }
        return f.string(from: d)
    }
}
