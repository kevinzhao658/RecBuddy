import SwiftUI

/// One message: my texts (volt lime) right; coach texts (dark surface) left with a name label;
/// runcard from me = lime stats card; runcard from coach = dark card;
/// workout/adjust = dark surface cards with accent header.
struct MessageRow: View {
    let message: Message
    let mine: Bool
    let senderName: String?
    @AppStorage("unit") private var unitRaw = "mi"
    private var unit: Unit { Unit(rawValue: unitRaw) ?? .mi }

    // ── Timestamp formatters (static to avoid per-render allocation) ───────

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

    private func timeLabel(_ iso: String) -> String {
        let date = Self.isoFull.date(from: iso) ?? Self.isoBasic.date(from: iso)
        guard let date else { return "" }
        return Self.timeFmt.string(from: date)
    }

    // ── Layout ─────────────────────────────────────────────────────────────

    var body: some View {
        HStack {
            if mine { Spacer(minLength: 52) }
            VStack(alignment: mine ? .trailing : .leading, spacing: 2) {
                if !mine, let senderName {
                    Text(senderName)
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(RB.textMute)
                }
                content
            }
            if !mine { Spacer(minLength: 52) }
        }
    }

    // ── Per-kind content ───────────────────────────────────────────────────

    @ViewBuilder private var content: some View {
        switch message.kind {

        case "text":
            VStack(alignment: mine ? .trailing : .leading, spacing: 4) {
                Text(message.body ?? "")
                    .foregroundStyle(mine ? RB.onAccent : .white)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(mine ? RB.accent : RB.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 18))
                timestamp
            }

        case "runcard":
            if mine {
                // Volt lime run stats card (reference: "9.1 mi  9:22  1:25:14  152")
                VStack(alignment: .trailing, spacing: 4) {
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
                    .foregroundStyle(RB.onAccent)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 14)
                    .background(RB.accent)
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                    timestamp
                }
            } else {
                // Dark run card (coach-sent, rare)
                VStack(alignment: .leading, spacing: 4) {
                    darkCard(header: "LOGGED RUN", icon: "figure.run") {
                        Text(message.payloadString("title") ?? "Run")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.white)
                        Text("\(message.payloadString("dist") ?? "") · \(Units.fmtPace(message.payloadString("pace"), unit)) · \(message.payloadString("time") ?? "")")
                            .font(.caption)
                            .foregroundStyle(RB.textMute)
                    }
                    timestamp
                }
            }

        case "workout":
            VStack(alignment: mine ? .trailing : .leading, spacing: 4) {
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
                timestamp
            }

        case "adjust":
            VStack(alignment: mine ? .trailing : .leading, spacing: 4) {
                darkCard(header: "WORKOUT ADJUSTED", icon: "arrow.triangle.2.circlepath") {
                    Text("\(message.payloadString("from") ?? "") → \(message.payloadString("to") ?? "")")
                        .font(.subheadline)
                        .foregroundStyle(.white)
                    if let reason = message.payloadString("reason"), !reason.isEmpty {
                        Text(reason).font(.caption).foregroundStyle(RB.textMute)
                    }
                }
                timestamp
            }

        default:
            EmptyView()
        }
    }

    // ── Timestamp caption ──────────────────────────────────────────────────

    private var timestamp: some View {
        Text(timeLabel(message.createdAt))
            .font(.caption2)
            .foregroundStyle(RB.textFaint)
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
