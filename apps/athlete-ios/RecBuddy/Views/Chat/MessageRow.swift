import SwiftUI

/// One message row — mirrors the web MessageItem layout:
/// - Mine (athlete): right-aligned accent bubble, no avatar or name.
/// - Others (coach): 24 pt avatar column on the left (visible only on the last
///   message of a sender's run), name caption above the first message of a block.
/// - Timestamps live only in the centered session-separator headers rendered by
///   ChatView; there are no per-bubble time labels here.
struct MessageRow: View {
    let message: Message
    let mine: Bool
    let senderName: String?
    var showAvatar: Bool = false
    var senderAvatarUrl: String? = nil
    var grouped: Bool = false
    /// Tap-through for workout/runcard references — called with the workout id
    /// so the chat can open results-vs-prescribed. Cards without a workout_id
    /// (legacy shares) stay static.
    var onOpenWorkout: ((String) -> Void)? = nil
    @AppStorage("unit") private var unitRaw = "mi"
    private var unit: Unit { Unit(rawValue: unitRaw) ?? .mi }

    private var canOpen: Bool { onOpenWorkout != nil && message.workoutId != nil }

    /// ' · SUN, AUG 23' header suffix when the payload carries the day.
    private func daySuffix(_ iso: String?) -> String {
        guard let iso else { return "" }
        return " · \(Week.fmtDayDate(iso).uppercased())"
    }

    /// Wraps a card in a button when it can trace back to its workout.
    @ViewBuilder
    private func openable<C: View>(@ViewBuilder content: () -> C) -> some View {
        if canOpen, let id = message.workoutId, let onOpenWorkout {
            Button { onOpenWorkout(id) } label: { content() }
                .buttonStyle(.plain)
                .accessibilityHint("Opens the workout details")
        } else {
            content()
        }
    }

    // ── Layout ─────────────────────────────────────────────────────────────

    var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            if mine {
                Spacer(minLength: 52)
                VStack(alignment: .trailing, spacing: 2) {
                    content
                }
            } else {
                avatarColumn
                VStack(alignment: .leading, spacing: 2) {
                    if let senderName {
                        Text(senderName)
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(RB.textMute)
                    }
                    content
                }
                Spacer(minLength: 52)
            }
        }
        .padding(.top, grouped ? 0 : 6)
    }

    // ── Avatar column (24 pt wide; empty spacer when not the last of a run) ──

    @ViewBuilder private var avatarColumn: some View {
        if showAvatar {
            if let urlStr = senderAvatarUrl, let url = URL(string: urlStr) {
                AsyncImage(url: url) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    avatarFallback
                }
                .frame(width: 24, height: 24)
                .clipShape(Circle())
            } else {
                avatarFallback
            }
        } else {
            Color.clear
                .frame(width: 24, height: 24)
        }
    }

    private var avatarFallback: some View {
        ZStack {
            Circle()
                .fill(RB.surface2)
                .frame(width: 24, height: 24)
            if let first = senderName?.first {
                Text(String(first))
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(.white)
            } else {
                Image(systemName: "person.fill")
                    .font(.system(size: 10))
                    .foregroundStyle(.white)
            }
        }
    }

    // ── Per-kind content (no timestamp captions) ───────────────────────────

    @ViewBuilder private var content: some View {
        switch message.kind {

        case "text":
            Text(message.body ?? "")
                .foregroundStyle(mine ? RB.onAccent : .white)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(mine ? RB.accent : RB.surface)
                .clipShape(RoundedRectangle(cornerRadius: 18))

        case "runcard":
            // Logged-run widget — same composition as the calendar workout card
            // (header eyebrow, title, divider, labeled stat columns), so a shared
            // run reads like a card, not a bare stat string. Used for both the
            // athlete's own share and the (rare) coach-sent variant.
            openable {
            darkCard(header: "LOGGED RUN\(daySuffix(message.payloadString("date")))",
                     icon: message.payloadString("type").map { TypeBadge.symbol(for: $0) } ?? "figure.run",
                     iconTint: message.payloadString("type").map { TypeBadge.tint(for: $0) },
                     chevron: canOpen) {
                Text(message.payloadString("title") ?? "Run")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
                Divider()
                    .overlay(RB.line)
                    .padding(.vertical, 5)
                HStack(alignment: .top, spacing: 26) {
                    if let dist = message.payloadString("dist") {
                        runStat("DISTANCE", dist)
                    }
                    if let pace = message.payloadString("pace") {
                        runStat("PACE", Units.fmtPace(pace, unit))
                    }
                    if let time = message.payloadString("time") {
                        runStat("TIME", time)
                    }
                    if let hr = message.payloadInt("hr") {
                        runStat("AVG HR", "\(hr)")
                    }
                }
                if let note = message.payloadString("note"), !note.isEmpty {
                    Text(note)
                        .font(.caption)
                        .foregroundStyle(RB.textMute)
                        .padding(.top, 3)
                }
            }
            }

        case "workout":
            // Same card the coach sees: type icon + WORKOUT · day, date header,
            // title, dist · pace, and a chevron when it traces to the live row.
            openable {
            darkCard(header: "WORKOUT\(daySuffix(message.payloadString("date")))",
                     icon: TypeBadge.symbol(for: message.payloadString("type") ?? "easy"),
                     iconTint: TypeBadge.tint(for: message.payloadString("type") ?? "easy"),
                     chevron: canOpen) {
                Text(message.payloadString("title") ?? "Workout")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
                if let d = message.payloadDouble("dist") {
                    Text("\(Units.fmtDist(d, unit)) \(unit.rawValue) · \(Units.fmtPace(message.payloadString("pace"), unit))")
                        .font(.caption)
                        .foregroundStyle(RB.textMute)
                }
            }
            }

        case "adjust":
            darkCard(header: "WORKOUT ADJUSTED", icon: "arrow.triangle.2.circlepath") {
                Text("\(message.payloadString("from") ?? "") → \(message.payloadString("to") ?? "")")
                    .font(.subheadline)
                    .foregroundStyle(.white)
                if let reason = message.payloadString("reason"), !reason.isEmpty {
                    Text(reason).font(.caption).foregroundStyle(RB.textMute)
                }
            }

        case "image":
            VStack(alignment: mine ? .trailing : .leading, spacing: 4) {
                imageCard
                // Optional caption sent with the photo (staged-composer flow)
                if let body = message.body, !body.isEmpty {
                    Text(body)
                        .foregroundStyle(mine ? RB.onAccent : .white)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(mine ? RB.accent : RB.surface)
                        .clipShape(RoundedRectangle(cornerRadius: 18))
                }
            }

        default:
            EmptyView()
        }
    }

    /// One labeled stat column in the logged-run widget (uppercase eyebrow + bold value).
    private func runStat(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(label)
                .font(.system(size: 9, weight: .bold))
                .tracking(1)
                .foregroundStyle(RB.textFaint)
            Text(value)
                .font(.subheadline.weight(.bold))
                .foregroundStyle(.white)
        }
    }

    // ── Image bubble ──────────────────────────────────────────────────────

    /// Routes to ChatImageView (new path-based private bucket) or falls back to
    /// the legacy url field — only if the url uses a strict https:// scheme.
    @ViewBuilder private var imageCard: some View {
        if let path = message.payloadString("path") {
            ChatImageView(
                path: path,
                w: message.payloadInt("w"),
                h: message.payloadInt("h")
            )
        } else if let urlStr = message.payloadString("url"),
                  urlStr.hasPrefix("https://"),
                  let url = URL(string: urlStr) {
            let w = message.payloadInt("w")
            let h = message.payloadInt("h")
            if let w, let h, w > 0, h > 0 {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let img): img.resizable().scaledToFit()
                    default: RB.surface.frame(height: 120)
                    }
                }
                .frame(maxWidth: 220)
                .aspectRatio(CGFloat(w) / CGFloat(h), contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: 16))
            } else {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let img): img.resizable().scaledToFit()
                    default: RB.surface.frame(height: 120)
                    }
                }
                .frame(maxWidth: 220)
                .clipShape(RoundedRectangle(cornerRadius: 16))
            }
        }
    }

    // ── Dark card (coach messages / workout / adjust) ─────────────────────

    private func darkCard<C: View>(
        header: String,
        icon: String,
        iconTint: Color? = nil,
        chevron: Bool = false,
        @ViewBuilder content: () -> C
    ) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(iconTint ?? RB.accent)
                Text(header)
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(RB.accent)
                if chevron {
                    Spacer(minLength: 8)
                    Image(systemName: "chevron.right")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(RB.textFaint)
                }
            }
            content()
        }
        .padding(10)
        .background(RB.surface)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14).stroke(RB.line, lineWidth: 1)
        )
    }
}

// ── ChatImageView ─────────────────────────────────────────────────────────────
/// Fetches a short-lived signed URL for a private-bucket chat image and renders
/// it asynchronously.  Shows a neutral placeholder box (preserving aspect ratio)
/// while the signed URL is loading.
/// Uses `.task(id: path)` so the fetch re-runs automatically if the path changes.
struct ChatImageView: View {
    let path: String
    let w: Int?
    let h: Int?
    @State private var signedURL: URL?

    var body: some View {
        imageContent
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .task(id: path) {
                signedURL = try? await Supa.shared.storage
                    .from("chat-images")
                    .createSignedURL(path: path, expiresIn: 3600)
            }
    }

    @ViewBuilder private var imageContent: some View {
        if let wr = w, let hr = h, wr > 0, hr > 0 {
            let ratio = CGFloat(wr) / CGFloat(hr)
            if let url = signedURL {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let img): img.resizable().scaledToFit()
                    default: RB.surface
                    }
                }
                .frame(maxWidth: 220)
                .aspectRatio(ratio, contentMode: .fit)
            } else {
                // Placeholder: preserve aspect ratio while the signed URL loads.
                RB.surface
                    .frame(maxWidth: 220)
                    .aspectRatio(ratio, contentMode: .fit)
            }
        } else {
            if let url = signedURL {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let img): img.resizable().scaledToFit()
                    default: RB.surface.frame(height: 120)
                    }
                }
                .frame(maxWidth: 220)
            } else {
                RB.surface
                    .frame(maxWidth: 220, minHeight: 120)
            }
        }
    }
}
