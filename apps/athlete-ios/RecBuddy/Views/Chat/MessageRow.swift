import SwiftUI

/// One message: my texts right/green, coach texts left with a name label;
/// runcard/workout/adjust render as small cards (read-only).
struct MessageRow: View {
    let message: Message
    let mine: Bool
    let senderName: String?
    @AppStorage("unit") private var unitRaw = "mi"
    private var unit: Unit { Unit(rawValue: unitRaw) ?? .mi }

    var body: some View {
        HStack {
            if mine { Spacer(minLength: 48) }
            VStack(alignment: mine ? .trailing : .leading, spacing: 2) {
                if !mine, let senderName {
                    Text(senderName).font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
                }
                content
            }
            if !mine { Spacer(minLength: 48) }
        }
    }

    @ViewBuilder private var content: some View {
        switch message.kind {
        case "text":
            Text(message.body ?? "")
                .padding(.horizontal, 12).padding(.vertical, 8)
                .background(mine ? Color.green.opacity(0.25) : Color(.secondarySystemBackground))
                .clipShape(RoundedRectangle(cornerRadius: 14))
        case "runcard":
            card(header: "LOGGED RUN", icon: "figure.run") {
                Text(message.payloadString("title") ?? "Run").font(.subheadline.weight(.semibold))
                Text("\(message.payloadString("dist") ?? "") · \(Units.fmtPace(message.payloadString("pace"), unit)) · \(message.payloadString("time") ?? "")")
                    .font(.caption).foregroundStyle(.secondary)
            }
        case "workout":
            card(header: "WORKOUT · \(Week.fmtShortDate(message.payloadString("date")))", icon: "calendar") {
                Text(message.payloadString("title") ?? "Workout").font(.subheadline.weight(.semibold))
                if let d = message.payloadDouble("dist") {
                    Text("\(Units.fmtDist(d, unit)) \(unit.rawValue) · \(Units.fmtPace(message.payloadString("pace"), unit))")
                        .font(.caption).foregroundStyle(.secondary)
                }
            }
        case "adjust":
            card(header: "WORKOUT ADJUSTED", icon: "arrow.triangle.2.circlepath") {
                Text("\(message.payloadString("from") ?? "") → \(message.payloadString("to") ?? "")")
                    .font(.subheadline)
                if let reason = message.payloadString("reason"), !reason.isEmpty {
                    Text(reason).font(.caption).foregroundStyle(.secondary)
                }
            }
        default:
            EmptyView()
        }
    }

    private func card<C: View>(header: String, icon: String, @ViewBuilder content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Label(header, systemImage: icon).font(.caption2.weight(.bold)).foregroundStyle(.green)
            content()
        }
        .padding(10)
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }
}
