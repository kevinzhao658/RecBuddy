import SwiftUI

/// Icon + tint per workout type (visual language matching the coach app).
struct TypeBadge: View {
    let type: String
    var body: some View {
        Image(systemName: Self.symbol(for: type))
            .foregroundStyle(Self.tint(for: type))
    }
    static func symbol(for type: String) -> String {
        switch type {
        case "easy": return "figure.run"
        case "long": return "arrow.right.to.line"
        case "speed": return "bolt.fill"
        case "tempo": return "gauge.with.needle"
        case "recovery": return "heart"
        case "cross": return "arrow.2.circlepath"
        case "rest": return "moon.zzz"
        case "race": return "flag.checkered"
        case "other": return "ellipsis.circle"
        default: return "figure.run"
        }
    }
    /// One voice: every type icon renders in the accent. Intensity is carried
    /// by the plan, not the icon; kept as a function so call sites are stable.
    static func tint(for type: String) -> Color { RB.accent }
}
