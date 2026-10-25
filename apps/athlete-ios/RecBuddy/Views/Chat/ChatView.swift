import SwiftUI
import AVFoundation
import PhotosUI
import UIKit

struct ChatView: View {
    let profile: Profile
    /// The conversation to open; nil = the athlete's team chat.
    var threadId: String? = nil
    /// Inbox row for this thread (title / members), when pushed from ChatsView.
    var conversation: Conversation? = nil
    @Environment(SessionStore.self) private var session
    @Environment(\.dismiss) private var dismiss
    @State private var infoOpen = false
    /// A new group started from Chat Details; opened once its sheet is gone.
    @State private var openAfterInfo: String?
    // Tap the header's photos or names: Rename Chat / Chat Details.
    @State private var renaming = false
    @State private var newName = ""
    @State private var renameError: String?
    @State private var store = ChatStore()
    @State private var draft = ""
    // Keyboard is visible only while composing: scrolling the thread dismisses
    // it interactively, and tapping anywhere in the thread drops focus.
    @State private var composerFocused = false
    @State private var busy = false
    @State private var sendError: String?
    @State private var imageItems: [PhotosPickerItem] = []
    // Picked photos are STAGED (with previews) so a caption can be typed
    // before sending — nothing uploads until the send button. Capped at maxPhotos.
    @State private var staged: [StagedImage] = []
    // One video per message; it sends after any staged photos and carries the caption.
    @State private var stagedVideo: PreparedVideo?
    @State private var preparingVideo = false
    /// Playing the staged video before it's sent (tap its tile).
    @State private var stagedPreview: AVPlayer?
    private static let maxPhotos = 6

    // Workout trace: tapping a workout/runcard reference opens the detail
    // sheet (prescribed + logged run) for that workout.
    @State private var traceWorkout: Workout?
    @State private var traceActual: WorkoutActual?
    @State private var tracePlanStore = PlanStore()

    // Report / block (App Store guideline 1.2) — long-press a coach's message.
    @State private var reportTarget: ReportSheet.Target?
    @State private var pendingBlock: ReportSheet.Target?

    // Replies: the message being answered, a workout attached from the
    // calendar ("Message coach about this"), and the row briefly highlighted
    // after jumping to an original from its quote.
    @State private var replyingTo: Message?
    /// Editing one of my messages: the composer holds its text; `draft` is what
    /// I was typing before, restored when the edit is saved or cancelled.
    @State private var editing: (message: Message, draft: String)?
    @State private var pendingDelete: Message?
    @State private var workoutQuote: WorkoutQuote?
    @State private var highlightedId: String?
    @State private var reactionsFor: String?          // message id whose who-reacted sheet is open
    private let router = AppRouter.shared
    @AppStorage("unit") private var unitRaw = "mi"
    private var unit: Unit { Unit(rawValue: unitRaw) ?? .mi }

    private struct StagedImage: Identifiable {
        let id = UUID()
        let data: Data; let w: Int; let h: Int; let preview: UIImage
    }

    // ── Coaching team (head first, via get_team) ───────────────────────────

    private var team: [ThreadPerson] { store.team }

    /// Chat title = the other members' names (never the athlete's own):
    /// "Sarah" / "Sarah & Mike" / "Sarah, Mike & Dana".
    private var isChat: Bool { store.thread.map { !$0.isTeam } ?? (conversation.map { !$0.isTeam } ?? false) }
    private var readOnly: Bool { store.thread?.readOnly ?? conversation?.readOnly ?? false }

    private func reopen() async {
        if let threadId { await store.open(threadId: threadId, me: profile.id) }
        else { await store.openTeam(athleteId: profile.id) }
    }

    private var chatTitle: String {
        if let title = store.thread?.title, !title.isEmpty { return title }
        if isChat, let conversation { return conversation.displayTitle }
        let names = team.map(\.name)
        switch names.count {
        case 0:  return "Coach"
        case 1:  return names[0]
        case 2:  return "\(names[0]) & \(names[1])"
        default: return names.dropLast().joined(separator: ", ") + " & " + names.last!
        }
    }

    private var chatSubtitle: String {
        ChatPeople.subtitle(isTeam: !isChat, otherCount: isChat ? (conversation?.members.count ?? max(team.count, 1)) : team.count)
    }

    // ── Session-separator helpers ──────────────────────────────────────────

    private enum ChatItem: Identifiable {
        case separator(String)
        case message(Message, startsBlock: Bool, showAvatar: Bool)
        var id: String {
            switch self {
            case .separator(let s): return "sep-\(s)"
            case .message(let m, _, _): return m.id
            }
        }
    }

    /// Two hours of silence (or a calendar-day boundary) triggers a new session header.
    private static let SESSION_GAP: TimeInterval = 2 * 60 * 60

    private static let isoFull: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    private static let isoBasic: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()
    private static let timeFmt: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "h:mm a"
        f.timeZone = .current
        return f
    }()
    private static let shortMonthDayFmt: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "MMM d"
        f.timeZone = .current
        return f
    }()

    private func parseDate(_ iso: String) -> Date? {
        Self.isoFull.date(from: iso) ?? Self.isoBasic.date(from: iso)
    }

    /// "Today 3:30 PM" / "Yesterday 8:12 AM" / "Jun 25 · 8:12 AM" — mirrors web sessionLabel.
    private func sessionLabel(_ date: Date) -> String {
        let time = Self.timeFmt.string(from: date)
        let cal = Calendar.current
        if cal.isDateInToday(date) { return "Today \(time)" }
        if cal.isDateInYesterday(date) { return "Yesterday \(time)" }
        return "\(Self.shortMonthDayFmt.string(from: date)) · \(time)"
    }

    private func sepBefore(msgs: [Message], at i: Int) -> Bool {
        if i == 0 { return true }
        guard let cur = parseDate(msgs[i].createdAt),
              let prev = parseDate(msgs[i - 1].createdAt) else { return false }
        return cur.timeIntervalSince(prev) > Self.SESSION_GAP ||
               !Calendar.current.isDate(cur, inSameDayAs: prev)
    }

    /// Re-shared cards for the same workout (re-logged runs, re-shared
    /// prescriptions) roll up: only the NEWEST per kind+workout renders as a
    /// full card; older ones become a compact placeholder. Same-kind only —
    /// a result never rolls up a prescription. Legacy cards (no workout_id)
    /// are never rolled up.
    /// "kind:workoutId" -> newest card message id (the placeholder's jump target).
    private var latestCardIds: [String: String] {
        var latest: [String: String] = [:]
        for m in store.messages {
            guard m.kind == "runcard" || m.kind == "workout", let w = m.workoutId else { continue }
            latest["\(m.kind):\(w)"] = m.id
        }
        return latest
    }

    private var supersededIds: Set<String> {
        let latest = latestCardIds
        var out = Set<String>()
        for m in store.messages {
            guard m.kind == "runcard" || m.kind == "workout", let w = m.workoutId else { continue }
            if latest["\(m.kind):\(w)"] != m.id { out.insert(m.id) }
        }
        return out
    }

    private var messagesById: [String: Message] {
        Dictionary(store.messages.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
    }

    private func authorName(_ m: Message) -> String {
        m.fromUserId == profile.id ? "You" : (store.senders[m.fromUserId]?.name ?? "Coach")
    }

    /// Quote shown above a reply; tapping it scrolls to (and flashes) the original.
    private func quote(for m: Message, proxy: ScrollViewProxy) -> MessageRow.Quote? {
        guard let id = m.replyToId else { return nil }
        guard let original = messagesById[id] else {
            return MessageRow.Quote(author: "", text: "", available: false)
        }
        return MessageRow.Quote(
            author: authorName(original),
            text: MessageText.quotePreview(original, unit: unit),
            onTap: { jump(to: id, proxy: proxy) })
    }

    private func jump(to id: String, proxy: ScrollViewProxy) {
        withAnimation { proxy.scrollTo(id, anchor: .center) }
        highlightedId = id
        Task {
            try? await Task.sleep(for: .seconds(1.2))
            if highlightedId == id { highlightedId = nil }
        }
    }

    private var chatItems: [ChatItem] {
        let msgs = store.messages
        var items: [ChatItem] = []
        for i in msgs.indices {
            let sep = sepBefore(msgs: msgs, at: i)
            let startsBlock = i == 0 || msgs[i - 1].fromUserId != msgs[i].fromUserId || sep
            let showAvatar: Bool
            if i == msgs.count - 1 {
                showAvatar = true
            } else {
                let nextSep = sepBefore(msgs: msgs, at: i + 1)
                showAvatar = nextSep || msgs[i].fromUserId != msgs[i + 1].fromUserId
            }
            if sep, let date = parseDate(msgs[i].createdAt) {
                items.append(.separator(sessionLabel(date)))
            }
            items.append(.message(msgs[i], startsBlock: startsBlock, showAvatar: showAvatar))
        }
        return items
    }

    // ── Body ───────────────────────────────────────────────────────────────

    var body: some View {
        ZStack(alignment: .top) {
            RB.bg.ignoresSafeArea()
            VStack(spacing: 0) {
                chatHeader
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                    .background(RB.bg)
                    .overlay(
                        Rectangle().fill(RB.line).frame(height: 1),
                        alignment: .bottom
                    )

                if store.phase == .noCoach {
                    // No coach linked (removed from a roster, or not joined yet):
                    // chat needs a coach — point at the re-attach path.
                    Spacer()
                    VStack(spacing: 10) {
                        Image(systemName: "bubble.left.and.exclamationmark.bubble.right")
                            .font(.system(size: 34))
                            .foregroundStyle(RB.textFaint)
                        Text("No coach to message yet")
                            .font(.headline)
                            .foregroundStyle(.white)
                        Text("Chat opens once you're connected to a coach. Add one with an invite code in Settings → Coaches.")
                            .font(.subheadline)
                            .foregroundStyle(RB.textMute)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.horizontal, 40)
                    Spacer()
                } else {
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: 4) {
                            // First-load skeleton: gray bubbles while the thread fetches
                            if store.phase == .loading && store.messages.isEmpty {
                                ForEach(0..<4, id: \.self) { i in
                                    HStack {
                                        if i % 2 == 1 { Spacer(minLength: 52) }
                                        RoundedRectangle(cornerRadius: 18)
                                            .fill(RB.surface)
                                            .frame(width: 180 + CGFloat(i % 3) * 30, height: 40)
                                        if i % 2 == 0 { Spacer(minLength: 52) }
                                    }
                                    .redacted(reason: .placeholder)
                                }
                            }
                            ForEach(chatItems) { item in
                                switch item {
                                case .separator(let label):
                                    Text(label)
                                        .font(.caption2)
                                        .foregroundStyle(RB.textFaint)
                                        .padding(.vertical, 6)
                                        .frame(maxWidth: .infinity)
                                case .message(let m, let startsBlock, let showAvatar):
                                    MessageRow(
                                        message: m,
                                        mine: m.fromUserId == profile.id,
                                        senderName: startsBlock && m.fromUserId != profile.id
                                            ? store.senders[m.fromUserId]?.name : nil,
                                        showAvatar: showAvatar && m.fromUserId != profile.id,
                                        senderAvatarUrl: m.fromUserId != profile.id
                                            ? store.senders[m.fromUserId]?.avatarUrl : nil,
                                        grouped: !startsBlock,
                                        superseded: supersededIds.contains(m.id),
                                        onJumpToLatest: m.workoutId.flatMap { w in
                                            latestCardIds["\(m.kind):\(w)"].map { target in
                                                { withAnimation { proxy.scrollTo(target, anchor: .center) } }
                                            }
                                        },
                                        onOpenWorkout: { id in Task { await openTrace(id) } },
                                        quote: quote(for: m, proxy: proxy),
                                        highlighted: highlightedId == m.id,
                                        reactionKinds: ReactionSummary.badges(store.reactions, messageId: m.id),
                                        reactionCount: ReactionSummary.count(store.reactions, messageId: m.id),
                                        reactedByMe: !ReactionSummary.mine(store.reactions, messageId: m.id, me: profile.id).isEmpty,
                                        onTapReactions: { reactionsFor = m.id }
                                    )
                                    .contextMenu { messageMenu(m) }
                                    .id(m.id)
                                }
                            }
                        }
                        .padding(.horizontal, 12)
                        .padding(.top, 8)
                        .padding(.bottom, 12)
                    }
                    // Short threads sit at the bottom, so older messages slide
                    // down when a newer one is deleted.
                    .defaultScrollAnchor(.bottom)
                    .refreshable { await reopen() }
                    // Drag follows the finger to tuck the keyboard away; a plain
                    // tap on the thread dismisses it too. Buttons inside message
                    // rows still win over the tap gesture.
                    .scrollDismissesKeyboard(.interactively)
                    .onTapGesture { composerFocused = false }
                    .onChange(of: store.messages.count) {
                        if let last = store.messages.last?.id {
                            withAnimation { proxy.scrollTo(last, anchor: .bottom) }
                        }
                    }
                    // Editing my last message adds its "Edited" tag below the bubble.
                    .onChange(of: store.messages.last?.editedAt) {
                        if let last = store.messages.last?.id {
                            withAnimation { proxy.scrollTo(last, anchor: .bottom) }
                        }
                    }
                }

                if case .error(let msg) = store.phase {
                    Label(msg, systemImage: "wifi.exclamationmark")
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .padding(.bottom, 4)
                }
                if let sendError {
                    Text(sendError)
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 16)
                        .padding(.bottom, 2)
                }

                Group {
                    if readOnly {
                        Text("This conversation is read-only.")
                            .font(.footnote)
                            .foregroundStyle(RB.textMute)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                    } else {
                        inputBar
                            .padding(.horizontal, 12)
                            .padding(.vertical, 10)
                    }
                }
                .background(RB.bg)
                .overlay(
                    Rectangle().fill(RB.line).frame(height: 1),
                    alignment: .top
                )
                }
            }
        }
        // Re-opens when a coach is added/removed (hasCoach flips) so the
        // no-coach empty state and a fresh thread appear without a relaunch.
        .task(id: session.hasCoach) { await reopen() }
        .onChange(of: store.thread?.id, initial: true) { _, id in AppRouter.shared.viewingThreadId = id }
        .onDisappear {
            if AppRouter.shared.viewingThreadId == store.thread?.id { AppRouter.shared.viewingThreadId = nil }
            Task { await store.close() }
        }
        .sheet(isPresented: Binding(get: { reactionsFor != nil }, set: { if !$0 { reactionsFor = nil } })) {
            if let id = reactionsFor {
                ReactionsDetailSheet(rows: ReactionSummary.names(store.reactions, messageId: id) { uid in
                    uid == profile.id ? "You" : (store.senders[uid]?.name ?? "Someone")
                })
            }
        }
        .sheet(item: $reportTarget) { target in
            ReportSheet(target: target) { await afterBlock() }
        }
        .confirmationDialog("Delete this message?",
            isPresented: Binding(get: { pendingDelete != nil }, set: { if !$0 { pendingDelete = nil } }),
            titleVisibility: .visible, presenting: pendingDelete
        ) { m in
            Button("Delete", role: .destructive) { Task { await deleteMessage(m) } }
            Button("Cancel", role: .cancel) {}
        } message: { _ in
            Text("It's removed for everyone in this conversation.")
        }
        .confirmationDialog(
            pendingBlock.map { "Block \($0.userName)?" } ?? "",
            isPresented: Binding(get: { pendingBlock != nil }, set: { if !$0 { pendingBlock = nil } }),
            titleVisibility: .visible,
            presenting: pendingBlock
        ) { target in
            Button("Block", role: .destructive) { Task { await block(target) } }
            Button("Cancel", role: .cancel) {}
        } message: { target in
            Text(MessageMenu.blockMessage(name: target.userName,
                                          isCoach: store.senders[target.userId]?.title != nil))
        }
        .sheet(item: $traceWorkout) { w in
            WorkoutDetailSheet(workout: w, store: tracePlanStore, unit: unit,
                               fetchedActual: traceActual)
        }
        // "Message coach about this" from a workout sheet.
        .onChange(of: router.pendingWorkoutQuote, initial: true) { _, q in
            // Only the team chat takes a workout from the calendar.
            guard let q, !isChat else { return }
            workoutQuote = q
            router.pendingWorkoutQuote = nil
            composerFocused = true
        }
        .onChange(of: imageItems) { _, newItems in
            guard !newItems.isEmpty else { return }
            Task { await stageImagesFromPicker(newItems) }
        }
    }

    // ── Custom header ──────────────────────────────────────────────────────

    /// One member avatar — photo when set (public avatars bucket), else
    /// initials. A bg-colored ring separates avatars in the overlap stack.
    private func memberAvatar(_ m: ThreadPerson) -> some View {
        ZStack {
            Circle()
                .fill(RB.surface2)
                .frame(width: 36, height: 36)
            if let url = m.avatarUrl.flatMap(URL.init(string:)) {
                AsyncImage(url: url) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    Text(m.initials).font(.caption.weight(.bold)).foregroundStyle(.white)
                }
                .frame(width: 36, height: 36)
                .clipShape(Circle())
            } else {
                Text(m.initials).font(.caption.weight(.bold)).foregroundStyle(.white)
            }
        }
        .overlay(Circle().stroke(RB.bg, lineWidth: 2))
    }

    private var chatHeader: some View {
        HStack(spacing: 12) {
            if threadId != nil {
                Button { dismiss() } label: {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(RB.accent)
                        .frame(width: 28, height: 36)
                }
                .accessibilityLabel("Back to chats")
            }
            headerMenu

            Spacer()
        }
        .sheet(isPresented: $infoOpen, onDismiss: {
            // Replacing the stack while the sheet is still up gets undone, so wait for it to close.
            if let id = openAfterInfo { openAfterInfo = nil; AppRouter.shared.openThreadId = id; return }
            Task { await store.refreshThread() }
        }) {
            if let id = store.thread?.id {
                ConversationInfoView(threadId: id, title: chatTitle, me: profile.id, meInitials: profile.initials,
                                     people: team, readOnly: readOnly,
                                     isGroup: isChat && (conversation?.members.count ?? team.count) >= 2,
                                     isTeam: !isChat, startedAt: store.thread?.createdAt,
                                     onOpenThread: { id in openAfterInfo = id; infoOpen = false }) {
                    infoOpen = false
                    dismiss()
                }
            }
        }
        .onChange(of: stagedVideo?.file) { _, _ in stagedPreview?.pause(); stagedPreview = nil }
        .alert("Rename Chat", isPresented: $renaming) {
            TextField("Chat name", text: $newName)
            Button("Save") { Task { await saveName() } }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Everyone in this chat sees the new name. Leave it empty to show members' names.")
        }
        .alert("Couldn't rename", isPresented: Binding(get: { renameError != nil }, set: { if !$0 { renameError = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(renameError ?? "")
        }
    }

    private var headerActions: [ChatHeaderMenu.Action] {
        ChatHeaderMenu.actions(isTeam: !isChat, otherCount: conversation?.members.count ?? team.count, readOnly: readOnly)
    }

    /// Photos + names. Tapping offers Rename Chat (team chats and groups) and
    /// Chat Details; a 1:1 opens its details directly.
    @ViewBuilder private var headerMenu: some View {
        if store.thread == nil {
            headerIdentity
        } else if headerActions.contains(.rename) {
            Menu {
                Button { newName = store.thread?.title ?? ""; renaming = true } label: {
                    Label("Rename Chat", systemImage: "pencil")
                }
                Button { infoOpen = true } label: {
                    Label("Chat Details", systemImage: "info.circle")
                }
            } label: { headerIdentity }
            .accessibilityLabel("\(chatTitle), chat options")
        } else {
            Button { infoOpen = true } label: { headerIdentity }
                .buttonStyle(.plain)
                .accessibilityLabel("\(chatTitle), chat details")
        }
    }

    private func saveName() async {
        do { try await store.rename(newName) }
        catch { renameError = Moderation.filterMessage(error) ?? "Try again." }
    }

    private var headerIdentity: some View {
        HStack(spacing: 12) {
            // Overlapping avatar stack — every team member (up to three shown)
            HStack(spacing: -10) {
                if team.isEmpty {
                    ZStack {
                        Circle().fill(RB.surface2).frame(width: 36, height: 36)
                        Text("?").font(.caption.weight(.bold)).foregroundStyle(.white)
                    }
                } else {
                    ForEach(team.prefix(3), id: \.userId) { m in
                        memberAvatar(m)
                    }
                }
            }
            .accessibilityHidden(true)

            // Member names + role line
            VStack(alignment: .leading, spacing: 2) {
                Text(chatTitle)
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                Text(chatSubtitle)
                    .font(.caption)
                    .foregroundStyle(RB.accent)
            }
        }
        .contentShape(Rectangle())
    }

    // ── Input bar ─────────────────────────────────────────────────────────

    /// Nothing to send: no staged photos and an empty draft.
    private var sendDisabled: Bool {
        if let editing { return busy || !MessageMenu.canSaveEdit(kind: editing.message.kind, draft: draft) }
        return busy || preparingVideo
            || (staged.isEmpty && stagedVideo == nil && draft.trimmingCharacters(in: .whitespaces).isEmpty)
    }

    private var inputBar: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let editing {
                composerContext(
                    title: "Editing message",
                    detail: MessageText.quotePreview(editing.message, unit: unit),
                    clearLabel: "Cancel edit") { endEdit() }
            }
            if let replyingTo {
                composerContext(
                    title: "Replying to \(authorName(replyingTo))",
                    detail: MessageText.quotePreview(replyingTo, unit: unit),
                    clearLabel: "Cancel reply") { self.replyingTo = nil }
            }
            if let workoutQuote {
                composerContext(
                    title: "About a workout",
                    detail: "\(workoutQuote.title) · \(Week.fmtDayDate(workoutQuote.date))",
                    clearLabel: "Remove workout") { self.workoutQuote = nil }
            }
            // Staged photo/video previews — remove any, caption once, then send
            if let stagedPreview, let v = stagedVideo {
                let fit = MediaFit.size(w: v.w, h: v.h, in: CGSize(width: 160, height: 220))
                InlineVideoView(player: stagedPreview)
                    .frame(width: fit.width, height: fit.height)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.top, 8)
            }
            if !staged.isEmpty || stagedVideo != nil || preparingVideo {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 12) {
                        ForEach(staged) { photo in
                            Image(uiImage: photo.preview)
                                .resizable()
                                .scaledToFill()
                                .frame(width: 56, height: 56)
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                                .overlay(alignment: .topTrailing) {
                                    Button { staged.removeAll { $0.id == photo.id } } label: {
                                        Image(systemName: "xmark.circle.fill")
                                            .font(.system(size: 18))
                                            .symbolRenderingMode(.palette)
                                            .foregroundStyle(.white, RB.surface2)
                                    }
                                    .offset(x: 7, y: -7)
                                    .accessibilityLabel("Remove attachment")
                                }
                        }
                        if preparingVideo {
                            HStack(spacing: 6) { ProgressView().tint(RB.accent); Text("Preparing…") }
                                .font(.caption).foregroundStyle(RB.textMute)
                                .frame(height: 56)
                        }
                        if let v = stagedVideo {
                            Image(uiImage: v.posterImage)
                                .resizable()
                                .scaledToFill()
                                .frame(width: 56, height: 56)
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                                .overlay { Image(systemName: stagedPreview == nil ? "play.fill" : "stop.fill").font(.system(size: 14)).foregroundStyle(.white) }
                                .contentShape(Rectangle())
                                .onTapGesture { toggleStagedPreview(v) }
                                .accessibilityAddTraits(.isButton)
                                .accessibilityLabel(stagedPreview == nil ? "Preview video" : "Hide preview")
                                .overlay(alignment: .bottomTrailing) {
                                    Text(VideoText.duration(v.duration))
                                        .font(.system(size: 10, weight: .semibold).monospacedDigit())
                                        .foregroundStyle(.white)
                                        .padding(.horizontal, 3)
                                        .background(.black.opacity(0.6), in: RoundedRectangle(cornerRadius: 4))
                                        .padding(3)
                                }
                                .overlay(alignment: .topTrailing) {
                                    Button { stagedVideo = nil } label: {
                                        Image(systemName: "xmark.circle.fill")
                                            .font(.system(size: 18))
                                            .symbolRenderingMode(.palette)
                                            .foregroundStyle(.white, RB.surface2)
                                    }
                                    .offset(x: 7, y: -7)
                                    .accessibilityLabel("Remove video")
                                }
                        }
                    }
                    .padding(.top, 8)
                    .padding(.trailing, 8)
                }
                Text(attachedLine)
                    .font(.caption)
                    .foregroundStyle(RB.textFaint)
            }

            HStack(spacing: 8) {
                PhotosPicker(selection: $imageItems,
                             maxSelectionCount: Self.maxPhotos - staged.count,
                             matching: .any(of: [.images, .videos])) {
                    Image(systemName: "photo")
                        .font(.system(size: 20))
                        .foregroundStyle(busy || staged.count >= Self.maxPhotos ? RB.textFaint : RB.textMute)
                }
                .disabled(busy || editing != nil || staged.count >= Self.maxPhotos)
                .accessibilityLabel("Attach photos or a video")

                ComposerTextView(text: $draft, isFocused: $composerFocused,
                                 onPasteImages: { stageImages($0) },
                                 onPasteVideo: { url in Task { await stageVideo(url) } })
                    .overlay(alignment: .topLeading) {
                        if draft.isEmpty {
                            Text(staged.isEmpty && stagedVideo == nil ? (isChat ? "Message" : "Message your coach…") : "Add a caption…")
                                .foregroundStyle(RB.textFaint)
                                .allowsHitTesting(false)
                                .accessibilityHidden(true)
                        }
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(RB.surface2)
                    .clipShape(RoundedRectangle(cornerRadius: 20))
                    .overlay(
                        RoundedRectangle(cornerRadius: 20).stroke(RB.line, lineWidth: 1)
                    )

                // Volt lime send button
                Button {
                    Task { await send() }
                } label: {
                    ZStack {
                        Circle()
                            .fill(sendDisabled ? RB.surface2 : RB.accent)
                            .frame(width: 36, height: 36)
                        Image(systemName: editing == nil ? "arrow.up" : "checkmark")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(sendDisabled ? RB.textMute : RB.onAccent)
                    }
                }
                .disabled(sendDisabled)
                .accessibilityLabel(editing == nil ? "Send message" : "Save edit")
            }
        }
    }

    // ── Long-press menu ────────────────────────────────────────────────────

    /// Actions for one message. Copy for any message with text; Copy Photo for
    /// images. (Report / Block for coach messages live here too.)
    @ViewBuilder
    private func messageMenu(_ m: Message) -> some View {
        if !readOnly {
            ControlGroup {
                ForEach(ReactionKind.allCases) { k in
                    Button { react(m, k) } label: { Text(k.emoji) }
                        .accessibilityLabel(k.label)
                }
            }
            .controlGroupStyle(.palette)
            .menuActionDismissBehavior(.enabled)   // close the menu after reacting, like Messages
            ForEach(ReactionSummary.mine(store.reactions, messageId: m.id, me: profile.id)) { k in
                Button { react(m, k) } label: {
                    Label("Remove \(k.emoji)", systemImage: "xmark.circle")
                }
            }
        }
        if MessageMenu.showsReply(readOnly: readOnly) {
            Button {
                replyingTo = m
                composerFocused = true
            } label: {
                Label("Reply", systemImage: "arrowshape.turn.up.left")
            }
        }
        if let text = MessageText.copyText(m, unit: unit) {
            Button {
                UIPasteboard.general.string = text
            } label: {
                Label("Copy", systemImage: "doc.on.doc")
            }
        }
        if m.kind == "image" {
            Button {
                Task { await copyPhoto(m) }
            } label: {
                Label("Copy Photo", systemImage: "photo.on.rectangle")
            }
        }
        if MessageMenu.showsEdit(kind: m.kind, mine: m.fromUserId == profile.id, readOnly: readOnly) {
            Button { startEdit(m) } label: { Label("Edit", systemImage: "pencil") }
        }
        if MessageMenu.showsDelete(mine: m.fromUserId == profile.id) {
            Divider()
            Button(role: .destructive) { pendingDelete = m } label: { Label("Delete", systemImage: "trash") }
                .tint(.red)   // the app-wide lime accent would tint the icon
        }
        // Report / Block (App Store 1.2) for other people's messages.
        if m.fromUserId != profile.id {
            let name = store.senders[m.fromUserId]?.name ?? "this person"
            Divider()
            Button {
                reportTarget = .init(userId: m.fromUserId, userName: name, messageId: m.id)
            } label: {
                Label("Report message", systemImage: "exclamationmark.bubble")
            }
            Button(role: .destructive) {
                pendingBlock = .init(userId: m.fromUserId, userName: name)
            } label: {
                Label("Block \(name)", systemImage: "hand.raised")
            }
        }
    }

    private func toggleStagedPreview(_ v: PreparedVideo) {
        if let p = stagedPreview { p.pause(); stagedPreview = nil; return }
        let p = AVPlayer(url: v.file)
        stagedPreview = p
        p.play()
    }

    private func react(_ m: Message, _ k: ReactionKind) {
        Task {
            do { try await store.react(messageId: m.id, kind: k) }
            catch { sendError = "Couldn't add that reaction — try again." }
        }
    }

    private func copyPhoto(_ m: Message) async {
        sendError = nil
        if let image = await ChatImageLoader.image(for: m) {
            UIPasteboard.general.image = image
        } else {
            sendError = "Couldn't copy that photo — try again."
        }
    }

    /// "Replying to …" / "About a workout" bar above the composer.
    private func composerContext(title: String, detail: String, clearLabel: String,
                                 clear: @escaping () -> Void) -> some View {
        HStack(spacing: 10) {
            RoundedRectangle(cornerRadius: 1.5).fill(RB.accent).frame(width: 3)
            VStack(alignment: .leading, spacing: 1) {
                Text(title).font(.caption.weight(.bold)).foregroundStyle(RB.accent)
                Text(detail).font(.caption).foregroundStyle(RB.textMute).lineLimit(1)
            }
            Spacer(minLength: 8)
            Button(action: clear) {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 18))
                    .symbolRenderingMode(.palette)
                    .foregroundStyle(.white, RB.surface2)
            }
            .accessibilityLabel(clearLabel)
        }
        .padding(.top, 6)
        .fixedSize(horizontal: false, vertical: true)
    }

    // ── Send action ────────────────────────────────────────────────────────

    private func startEdit(_ m: Message) {
        editing = (m, editing?.draft ?? draft)
        draft = m.body ?? ""
        replyingTo = nil
        composerFocused = true
    }

    private func endEdit() {
        draft = editing?.draft ?? ""
        editing = nil
    }

    private func deleteMessage(_ m: Message) async {
        if editing?.message.id == m.id { endEdit() }
        if replyingTo?.id == m.id { replyingTo = nil }
        do { try await store.delete(messageId: m.id) }
        catch { sendError = "Couldn't delete that message — try again." }
    }

    private func send() async {
        if let editing {
            let body = draft.trimmingCharacters(in: .whitespacesAndNewlines)
            guard MessageMenu.canSaveEdit(kind: editing.message.kind, draft: body) else { return }
            busy = true
            defer { busy = false }
            do {
                if body != (editing.message.body ?? "") {
                    try await store.edit(messageId: editing.message.id, body: body)
                }
                endEdit()
            } catch {
                sendError = "Couldn't save your edit — try again."
            }
            return
        }
        let body = draft.trimmingCharacters(in: .whitespaces)
        busy = true
        sendError = nil
        defer { busy = false }
        do {
            if let video = stagedVideo {
                // Photos first (the reply rides on the first), then the video
                // with the caption, so the caption reads beneath the batch.
                try await ComposerBatch.send(staged, one: { photo, i in
                    try await store.sendImage(photo.data, width: photo.w, height: photo.h,
                                              from: profile.id, replyTo: i == 0 ? replyingTo?.id : nil)
                }, sent: { photo in
                    staged.removeAll { $0.id == photo.id }
                    replyingTo = nil
                })
                do {
                    try await store.sendVideo(video, from: profile.id, body: body.isEmpty ? nil : body,
                                              replyTo: replyingTo?.id)
                } catch {
                    sendError = Moderation.filterMessage(error) ?? VideoText.sendFailed
                    return
                }
                stagedVideo = nil
                replyingTo = nil
                draft = ""
            } else if !staged.isEmpty {
                // Photos upload sequentially; the caption rides on the LAST one
                // so it reads beneath the batch. Sent photos leave the tray as
                // they go — a mid-batch failure keeps only the unsent ones.
                // The reply rides on the FIRST photo (it answers the quoted message).
                let batch = staged
                for (i, photo) in batch.enumerated() {
                    let caption = i == batch.count - 1 && !body.isEmpty ? body : nil
                    try await store.sendImage(photo.data, width: photo.w, height: photo.h,
                                              from: profile.id, body: caption,
                                              replyTo: i == 0 ? replyingTo?.id : nil)
                    staged.removeAll { $0.id == photo.id }
                    if i == 0 { replyingTo = nil }
                }
                draft = ""
            } else {
                guard !body.isEmpty else { return }
                try await store.send(body, from: profile.id, replyTo: replyingTo?.id, workout: workoutQuote)
                draft = ""  // clear only on success — a failed send keeps the text
                replyingTo = nil
                workoutQuote = nil
            }
        } catch {
            sendError = Moderation.filterMessage(error) ?? "Couldn't send — try again."
        }
    }

    private func block(_ target: ReportSheet.Target) async {
        sendError = nil
        do {
            try await Moderation.block(userId: target.userId)
            await afterBlock()
        } catch {
            sendError = "Couldn't block \(target.userName) — try again."
        }
    }

    /// The team changed and the blocked user's messages are now hidden: refresh
    /// the profile (hasCoach may flip to the no-coach state) and the thread.
    private func afterBlock() async {
        await session.refreshProfile()
        await reopen()
    }

    /// Fetch the referenced workout (and its logged actual, if any) and open
    /// the detail sheet — the same results-vs-prescribed view as the calendar.
    private func openTrace(_ workoutId: String) async {
        sendError = nil
        let rows: [Workout] = (try? await Supa.shared.from("workouts")
            .select().eq("id", value: workoutId).limit(1).execute().value) ?? []
        guard let w = rows.first else {
            sendError = "Couldn't open that workout — it may have been removed."
            return
        }
        let actuals: [WorkoutActual] = (try? await Supa.shared.from("workout_actuals")
            .select().eq("workout_id", value: workoutId).limit(1).execute().value) ?? []
        traceActual = actuals.first
        traceWorkout = w
    }

    /// Load + downscale the picked photos and hold them in the composer; the
    /// user adds a caption (optional) and sends explicitly.
    private func stageImagesFromPicker(_ items: [PhotosPickerItem]) async {
        sendError = nil
        defer { imageItems = [] }
        var images: [UIImage] = []
        var failed = 0
        for item in items {
            if item.supportedContentTypes.contains(where: { $0.conforms(to: .movie) }) {
                if let movie = try? await item.loadTransferable(type: PickedMovie.self) {
                    await stageVideo(movie.url)
                } else {
                    failed += 1
                }
                continue
            }
            if let rawData = try? await item.loadTransferable(type: Data.self),
               let uiImage = UIImage(data: rawData) {
                images.append(uiImage)
            } else {
                failed += 1
            }
        }
        // Only when photos were picked: stageImages clears sendError, which would
        // wipe a video refusal shown a moment ago.
        if !images.isEmpty || failed > 0 { stageImages(images, alreadyFailed: failed) }
    }

    /// "Photo attached", "2 photos attached · Video attached", … — then the hint.
    private var attachedLine: String {
        let photos = staged.isEmpty ? nil : (staged.count == 1 ? "Photo attached" : "\(staged.count) photos attached")
        let parts = [photos, stagedVideo == nil ? nil : "Video attached"].compactMap { $0 }
        return parts.isEmpty ? "Preparing video…" : parts.joined(separator: " · ") + " — add a caption, then send."
    }

    /// Compress a picked or pasted clip into the tray (one video per message).
    private func stageVideo(_ source: URL) async {
        sendError = nil
        preparingVideo = true
        defer { preparingVideo = false; try? FileManager.default.removeItem(at: source) }
        do {
            stagedVideo = try await VideoPrep.prepare(source: source)
        } catch VideoPrep.Refusal.tooLong {
            sendError = VideoText.tooLong
        } catch VideoPrep.Refusal.tooBig {
            sendError = VideoText.tooBig
        } catch {
            sendError = "Couldn't process that video."
        }
    }

    /// Downscale photos (picked or pasted) into the composer tray, up to maxPhotos.
    private func stageImages(_ images: [UIImage], alreadyFailed: Int = 0) {
        if alreadyFailed == 0 { sendError = nil }
        var failed = alreadyFailed
        var dropped = 0
        for uiImage in images {
            guard staged.count < Self.maxPhotos else { dropped += 1; continue }
            guard let (jpegData, w, h) = ImageShrink.jpegForChat(uiImage),
                  let preview = UIImage(data: jpegData) else {
                failed += 1
                continue
            }
            staged.append(StagedImage(data: jpegData, w: w, h: h, preview: preview))
        }
        if failed > 0 {
            sendError = failed == 1 ? "Couldn't process one of the images."
                                    : "Couldn't process \(failed) of the images."
        } else if dropped > 0 {
            sendError = "You can attach up to \(Self.maxPhotos) photos at a time."
        }
    }
}
