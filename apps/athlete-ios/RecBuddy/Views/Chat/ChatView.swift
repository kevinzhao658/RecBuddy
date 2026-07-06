import SwiftUI
import PhotosUI
import UIKit

struct ChatView: View {
    let profile: Profile
    @State private var store = ChatStore()
    @State private var draft = ""
    @State private var busy = false
    @State private var sendError: String?
    @State private var imageItem: PhotosPickerItem?
    // A picked photo is STAGED (with a preview) so a caption can be typed
    // before sending — nothing uploads until the send button.
    @State private var staged: StagedImage?

    private struct StagedImage {
        let data: Data; let w: Int; let h: Int; let preview: UIImage
    }

    // ── Coach resolved from thread ─────────────────────────────────────────

    private var coach: Profile? {
        guard let coachId = store.thread?.coachId else { return nil }
        return store.senders[coachId]
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
                                        grouped: !startsBlock
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
        .task { await store.open(athleteId: profile.id) }
        .onDisappear { Task { await store.close() } }
        .onChange(of: imageItem) { _, newItem in
            guard let newItem else { return }
            Task { await stageImageFromPicker(newItem) }
        }
    }

    // ── Custom header ──────────────────────────────────────────────────────

    private var initialsCircle: some View {
        ZStack {
            Circle()
                .fill(RB.surface2)
                .frame(width: 36, height: 36)
            Text(coach?.initials ?? "?")
                .font(.caption.weight(.bold))
                .foregroundStyle(.white)
        }
    }

    private var chatHeader: some View {
        HStack(spacing: 12) {
            // Coach avatar — photo when set (public avatars bucket), else initials
            Group {
                if let url = coach?.avatarUrl.flatMap(URL.init(string:)) {
                    AsyncImage(url: url) { image in
                        image.resizable().scaledToFill()
                    } placeholder: {
                        initialsCircle
                    }
                    .frame(width: 36, height: 36)
                    .clipShape(Circle())
                } else {
                    initialsCircle
                }
            }
            .accessibilityHidden(true)

            // Coach name + role
            VStack(alignment: .leading, spacing: 2) {
                Text(coach?.name ?? "Coach")
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(.white)
                Text(coach?.title ?? "Head Coach")
                    .font(.caption)
                    .foregroundStyle(RB.accent)
            }

            Spacer()
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(coach?.name ?? "Coach"), \(coach?.title ?? "Head Coach")")
    }

    // ── Input bar ─────────────────────────────────────────────────────────

    /// Nothing to send: no staged photo and an empty draft.
    private var sendDisabled: Bool {
        busy || (staged == nil && draft.trimmingCharacters(in: .whitespaces).isEmpty)
    }

    private var inputBar: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Staged photo preview — remove or caption it before sending
            if let staged {
                HStack(spacing: 10) {
                    Image(uiImage: staged.preview)
                        .resizable()
                        .scaledToFill()
                        .frame(width: 56, height: 56)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                        .overlay(alignment: .topTrailing) {
                            Button { self.staged = nil } label: {
                                Image(systemName: "xmark.circle.fill")
                                    .font(.system(size: 18))
                                    .symbolRenderingMode(.palette)
                                    .foregroundStyle(.white, RB.surface2)
                            }
                            .offset(x: 7, y: -7)
                            .accessibilityLabel("Remove attachment")
                        }
                    Text("Photo attached — add a caption, then send.")
                        .font(.caption)
                        .foregroundStyle(RB.textFaint)
                    Spacer()
                }
                .padding(.top, 2)
            }

            HStack(spacing: 8) {
                PhotosPicker(selection: $imageItem, matching: .images) {
                    Image(systemName: "photo")
                        .font(.system(size: 20))
                        .foregroundStyle(busy ? RB.textFaint : RB.textMute)
                }
                .disabled(busy)
                .accessibilityLabel("Attach photo")

                TextField(staged == nil ? "Message your coach…" : "Add a caption…",
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
            if let staged {
                // Photo (with optional caption) — clear only on success
                try await store.sendImage(staged.data, width: staged.w, height: staged.h,
                                          from: profile.id, body: body.isEmpty ? nil : body)
                self.staged = nil
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

    /// Load + downscale the picked photo and hold it in the composer; the
    /// user adds a caption (optional) and sends explicitly.
    private func stageImageFromPicker(_ item: PhotosPickerItem) async {
        sendError = nil
        defer { imageItem = nil }
        guard let rawData = try? await item.loadTransferable(type: Data.self),
              let uiImage = UIImage(data: rawData),
              let (jpegData, w, h) = ImageShrink.jpegForChat(uiImage),
              let preview = UIImage(data: jpegData) else {
            sendError = "Couldn't process the image."
            return
        }
        staged = StagedImage(data: jpegData, w: w, h: h, preview: preview)
    }
}
