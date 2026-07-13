import SwiftUI
import PhotosUI
import UIKit

struct ChatView: View {
    let profile: Profile
    @Environment(SessionStore.self) private var session
    @State private var store = ChatStore()
    @State private var draft = ""
    @State private var busy = false
    @State private var sendError: String?
    @State private var imageItems: [PhotosPickerItem] = []
    // Picked photos are STAGED (with previews) so a caption can be typed
    // before sending — nothing uploads until the send button. Capped at maxPhotos.
    @State private var staged: [StagedImage] = []
    private static let maxPhotos = 6

    // Workout trace: tapping a workout/runcard reference opens the detail
    // sheet (prescribed + logged run) for that workout.
    @State private var traceWorkout: Workout?
    @State private var traceActual: WorkoutActual?
    @State private var tracePlanStore = PlanStore()
    @AppStorage("unit") private var unitRaw = "mi"
    private var unit: Unit { Unit(rawValue: unitRaw) ?? .mi }

    private struct StagedImage: Identifiable {
        let id = UUID()
        let data: Data; let w: Int; let h: Int; let preview: UIImage
    }

    // ── Coaching team (head first, via get_team) ───────────────────────────

    private var team: [ChatSender] { store.team }

    /// Chat title = the other members' names (never the athlete's own):
    /// "Sarah" / "Sarah & Mike" / "Sarah, Mike & Dana".
    private var chatTitle: String {
        let names = team.map(\.name)
        switch names.count {
        case 0:  return "Coach"
        case 1:  return names[0]
        case 2:  return "\(names[0]) & \(names[1])"
        default: return names.dropLast().joined(separator: ", ") + " & " + names.last!
        }
    }

    private var chatSubtitle: String {
        team.count > 1 ? "Your coaching team" : (team.first?.title ?? "Head Coach")
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
                                        onOpenWorkout: { id in Task { await openTrace(id) } }
                                    )
                                    .id(m.id)
                                }
                            }
                        }
                        .padding(.horizontal, 12)
                        .padding(.top, 8)
                        .padding(.bottom, 12)
                    }
                    .refreshable { await store.open(athleteId: profile.id) }
                    .onChange(of: store.messages.count) {
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
                        .padding(.bottom, 2)
                }

                inputBar
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
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
        .task(id: session.hasCoach) { await store.open(athleteId: profile.id) }
        .onDisappear { Task { await store.close() } }
        .sheet(item: $traceWorkout) { w in
            WorkoutDetailSheet(workout: w, store: tracePlanStore, unit: unit,
                               fetchedActual: traceActual)
        }
        .onChange(of: imageItems) { _, newItems in
            guard !newItems.isEmpty else { return }
            Task { await stageImagesFromPicker(newItems) }
        }
    }

    // ── Custom header ──────────────────────────────────────────────────────

    /// One member avatar — photo when set (public avatars bucket), else
    /// initials. A bg-colored ring separates avatars in the overlap stack.
    private func memberAvatar(_ m: ChatSender) -> some View {
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
            // Overlapping avatar stack — every team member (up to three shown)
            HStack(spacing: -10) {
                if team.isEmpty {
                    ZStack {
                        Circle().fill(RB.surface2).frame(width: 36, height: 36)
                        Text("?").font(.caption.weight(.bold)).foregroundStyle(.white)
                    }
                } else {
                    ForEach(team.prefix(3), id: \.coachId) { m in
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

            Spacer()
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(chatTitle), \(chatSubtitle)")
    }

    // ── Input bar ─────────────────────────────────────────────────────────

    /// Nothing to send: no staged photos and an empty draft.
    private var sendDisabled: Bool {
        busy || (staged.isEmpty && draft.trimmingCharacters(in: .whitespaces).isEmpty)
    }

    private var inputBar: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Staged photo previews — remove any, caption once, then send
            if !staged.isEmpty {
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
                    }
                    .padding(.top, 8)
                    .padding(.trailing, 8)
                }
                Text(staged.count == 1
                     ? "Photo attached — add a caption, then send."
                     : "\(staged.count) photos attached — add a caption, then send.")
                    .font(.caption)
                    .foregroundStyle(RB.textFaint)
            }

            HStack(spacing: 8) {
                PhotosPicker(selection: $imageItems,
                             maxSelectionCount: Self.maxPhotos - staged.count,
                             matching: .images) {
                    Image(systemName: "photo")
                        .font(.system(size: 20))
                        .foregroundStyle(busy || staged.count >= Self.maxPhotos ? RB.textFaint : RB.textMute)
                }
                .disabled(busy || staged.count >= Self.maxPhotos)
                .accessibilityLabel("Attach photos")

                TextField(staged.isEmpty ? "Message your coach…" : "Add a caption…",
                          text: $draft, axis: .vertical)
                    .lineLimit(1...4)
                    .foregroundStyle(.white)
                    .tint(RB.accent)
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
                        Image(systemName: "arrow.up")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(sendDisabled ? RB.textMute : RB.onAccent)
                    }
                }
                .disabled(sendDisabled)
                .accessibilityLabel("Send message")
            }
        }
    }

    // ── Send action ────────────────────────────────────────────────────────

    private func send() async {
        let body = draft.trimmingCharacters(in: .whitespaces)
        busy = true
        sendError = nil
        defer { busy = false }
        do {
            if !staged.isEmpty {
                // Photos upload sequentially; the caption rides on the LAST one
                // so it reads beneath the batch. Sent photos leave the tray as
                // they go — a mid-batch failure keeps only the unsent ones.
                let batch = staged
                for (i, photo) in batch.enumerated() {
                    let caption = i == batch.count - 1 && !body.isEmpty ? body : nil
                    try await store.sendImage(photo.data, width: photo.w, height: photo.h,
                                              from: profile.id, body: caption)
                    staged.removeAll { $0.id == photo.id }
                }
                draft = ""
            } else {
                guard !body.isEmpty else { return }
                try await store.send(body, from: profile.id)
                draft = ""  // clear only on success — a failed send keeps the text
            }
        } catch {
            sendError = "Couldn't send — try again."
        }
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
        var failed = 0
        for item in items {
            guard staged.count < Self.maxPhotos else { break }
            guard let rawData = try? await item.loadTransferable(type: Data.self),
                  let uiImage = UIImage(data: rawData),
                  let (jpegData, w, h) = ImageShrink.jpegForChat(uiImage),
                  let preview = UIImage(data: jpegData) else {
                failed += 1
                continue
            }
            staged.append(StagedImage(data: jpegData, w: w, h: h, preview: preview))
        }
        if failed > 0 {
            sendError = failed == 1 ? "Couldn't process one of the images."
                                    : "Couldn't process \(failed) of the images."
        }
    }
}
