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
        case "easy": return "arrow.right"          // easy forward motion (runner stays a SPORT glyph)
        case "long": return "arrow.right.to.line"
        case "speed": return "bolt.fill"
        case "tempo": return "gauge.with.needle"
        case "recovery": return "heart"
        case "cross": return "arrow.2.circlepath"
        case "rest": return "moon.zzz"
        case "race": return "flag.checkered"
        case "other": return "ellipsis.circle"
        default: return "arrow.right"
        }
    }
    /// Intensity code: orange = effort, blue = long, green = aerobic,
    /// muted = off. (Accent-only was tried and reverted — color answers
    /// "which days are hard" at a glance.)
    static func tint(for type: String) -> Color {
        switch type {
        case "speed", "tempo", "race": return .orange
        case "long": return .blue
        case "rest", "other": return .secondary
        default: return .green
        }
    }
}
