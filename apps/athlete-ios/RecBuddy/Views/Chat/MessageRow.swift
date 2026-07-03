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
    @AppStorage("unit") private var unitRaw = "mi"
    private var unit: Unit { Unit(rawValue: unitRaw) ?? .mi }

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
            if mine {
                // Volt lime run stats card (reference: "9.1 mi  9:22  1:25:14  152")
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 16) {
                        if let dist = message.payloadString("dist") {
                            Text("\(dist) \(unit.rawValue)")
                                .font(.subheadline.weight(.bold))
                        }
                        if let pace = message.payloadString("pace") {
                            Text(Units.fmtPace(pace, unit))
                                .font(.subheadline.weight(.bold))
                        }
                        if let time = message.payloadString("time") {
                            Text(time).font(.subheadline.weight(.bold))
                        }
                        if let hr = message.payloadInt("hr") {
                            Text("\(hr)").font(.subheadline.weight(.bold))
                        }
                    }
                    if let note = message.payloadString("note"), !note.isEmpty {
                        Text(note).font(.caption)
                    }
                }
                .foregroundStyle(RB.onAccent)
                .padding(.horizontal, 16)
                .padding(.vertical, 14)
                .background(RB.accent)
                .clipShape(RoundedRectangle(cornerRadius: 16))
            } else {
                // Dark run card (coach-sent, rare)
                darkCard(header: "LOGGED RUN", icon: "figure.run") {
                    Text(message.payloadString("title") ?? "Run")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.white)
                    Text("\(message.payloadString("dist") ?? "") · \(Units.fmtPace(message.payloadString("pace"), unit)) · \(message.payloadString("time") ?? "")")
                        .font(.caption)
                        .foregroundStyle(RB.textMute)
                    if let note = message.payloadString("note"), !note.isEmpty {
                        Text(note).font(.caption).foregroundStyle(RB.textMute)
                    }
                }
            }

        case "workout":
            darkCard(header: "WORKOUT · \(Week.fmtShortDate(message.payloadString("date")))",
                     icon: "calendar") {
                Text(message.payloadString("title") ?? "Workout")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
                if let d = message.payloadDouble("dist") {
                    Text("\(Units.fmtDist(d, unit)) \(unit.rawValue) · \(Units.fmtPace(message.payloadString("pace"), unit))")
                        .font(.caption)
                        .foregroundStyle(RB.textMute)
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
            imageCard

        default:
            EmptyView()
        }
    }

    // ── Image bubble ──────────────────────────────────────────────────────

    @ViewBuilder private var imageCard: some View {
        if let urlStr = message.payloadString("url"), let url = URL(string: urlStr) {
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

    // ── Dark card (coach messages / workout / adjust) ──────────────────────

    private func darkCard<C: View>(
        header: String,
        icon: String,
        @ViewBuilder content: () -> C
    ) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Label(header, systemImage: icon)
                .font(.caption2.weight(.bold))
                .foregroundStyle(RB.accent)
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
