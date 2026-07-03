import SwiftUI

struct ChatView: View {
    let profile: Profile
    @State private var store = ChatStore()
    @State private var draft = ""
    @State private var busy = false
    @State private var sendError: String?

    // ── Coach resolved from thread ─────────────────────────────────────────

    private var coach: Profile? {
        guard let coachId = store.thread?.coachId else { return nil }
        return store.senders[coachId]
    }

    // ── Date-separator helpers ─────────────────────────────────────────────

    private enum ChatItem: Identifiable {
        case separator(String)   // formatted day label
        case message(Message)
        var id: String {
            switch self {
            case .separator(let s): return "sep-\(s)"
            case .message(let m):   return m.id
            }
        }
    }

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
    private static let localDayFmt: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = .current
        return f
    }()
    private static let longDateFmt: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "EEEE, MMMM d"
        f.timeZone = .current
        return f
    }()

    /// Convert an ISO8601 timestamp to a "YYYY-MM-DD" string in local timezone.
    private func isoToLocalDay(_ iso: String) -> String {
        let date = Self.isoFull.date(from: iso) ?? Self.isoBasic.date(from: iso)
            ?? Self.localDayFmt.date(from: String(iso.prefix(10)))
        guard let date else { return String(iso.prefix(10)) }
        return Self.localDayFmt.string(from: date)
    }

    /// Format a local "YYYY-MM-DD" as "Saturday, May 30".
    private func dayLabel(_ localDay: String) -> String {
        guard let date = Self.localDayFmt.date(from: localDay) else { return localDay }
        return Self.longDateFmt.string(from: date)
    }

    private var chatItems: [ChatItem] {
        var items: [ChatItem] = []
        var lastDay = ""
        for m in store.messages {
            let day = isoToLocalDay(m.createdAt)
            if day != lastDay {
                items.append(.separator(dayLabel(day)))
                lastDay = day
            }
            items.append(.message(m))
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
                        LazyVStack(spacing: 10) {
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
                                case .message(let m):
                                    MessageRow(
                                        message: m,
                                        mine: m.fromUserId == profile.id,
                                        senderName: store.senders[m.fromUserId]?.name)
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

    private var inputBar: some View {
        HStack(spacing: 8) {
            TextField("Message your coach…", text: $draft, axis: .vertical)
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
                        .fill(busy || draft.trimmingCharacters(in: .whitespaces).isEmpty
                              ? RB.surface2 : RB.accent)
                        .frame(width: 36, height: 36)
                    Image(systemName: "arrow.up")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(
                            busy || draft.trimmingCharacters(in: .whitespaces).isEmpty
                            ? RB.textMute : RB.onAccent)
                }
            }
            .disabled(busy || draft.trimmingCharacters(in: .whitespaces).isEmpty)
            .accessibilityLabel("Send message")
        }
    }

    // ── Send action ────────────────────────────────────────────────────────

    private func send() async {
        let body = draft.trimmingCharacters(in: .whitespaces)
        guard !body.isEmpty else { return }
        busy = true
        sendError = nil
        defer { busy = false }
        do {
            try await store.send(body, from: profile.id)
            draft = ""  // clear only on success — a failed send keeps the text
        } catch {
            sendError = "Couldn't send — try again."
        }
    }
}
