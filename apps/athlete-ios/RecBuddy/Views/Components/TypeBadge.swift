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
        case "recovery": return "arrow.clockwise.heart"
        case "cross": return "bicycle"
        case "rest": return "moon.zzz"
        case "race": return "flag.checkered"
        default: return "figure.run"
        }
    }
    static func tint(for type: String) -> Color {
        switch type {
        case "speed", "tempo", "race": return .orange
        case "long": return .blue
        case "rest": return .secondary
        default: return .green
        }
    }
}
