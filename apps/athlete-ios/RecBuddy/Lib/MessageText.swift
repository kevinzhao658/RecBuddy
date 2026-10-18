import Foundation

/// Plain-text forms of a chat message: what "Copy" puts on the pasteboard and
/// the one-line preview shown in reply quotes. Mirrors coach-web lib/messageText.ts.
enum MessageText {
    /// Text for the pasteboard, or nil when there's nothing textual to copy
    /// (a photo without a caption — use Copy Photo instead).
    static func copyText(_ m: Message, unit: Unit) -> String? {
        switch m.kind {
        case "text", "image":
            guard let body = m.body, !body.isEmpty else { return nil }
            return body
        case "runcard":
            var stats: [String] = []
            if let d = m.payloadString("dist"), !d.isEmpty { stats.append(d) }
            if let p = m.payloadString("pace"), !p.isEmpty { stats.append(Units.fmtPace(p, unit)) }
            if let t = m.payloadString("time"), !t.isEmpty { stats.append(t) }
            if let hr = m.payloadInt("hr") { stats.append("Avg HR \(hr)") }
            var out = m.payloadString("title") ?? "Run"
            if !stats.isEmpty { out += " — " + stats.joined(separator: " · ") }
            if let note = m.payloadString("note"), !note.isEmpty { out += "\n\"\(note)\"" }
            return out
        case "workout":
            var out = m.payloadString("title") ?? "Workout"
            var stats: [String] = []
            if let d = m.payloadDouble("dist") { stats.append("\(Units.fmtDist(d, unit)) \(unit.rawValue)") }
            if let p = m.payloadString("pace"), !p.isEmpty { stats.append(Units.fmtPace(p, unit)) }
            if !stats.isEmpty { out += " — " + stats.joined(separator: " · ") }
            return out
        case "adjust":
            var out = "Workout adjusted: \(m.payloadString("from") ?? "") → \(m.payloadString("to") ?? "")"
            if let r = m.payloadString("reason"), !r.isEmpty { out += "\n\(r)" }
            return out
        default:
            return m.body
        }
    }

    /// One-line summary for reply quotes.
    static func quotePreview(_ m: Message, unit: Unit) -> String {
        switch m.kind {
        case "image":
            if let body = m.body, !body.isEmpty { return "📷 " + oneLine(body) }
            return "📷 Photo"
        case "runcard": return "Logged run · \(m.payloadString("title") ?? "Run")"
        case "workout": return "Workout · \(m.payloadString("title") ?? "Workout")"
        case "adjust":  return "Workout adjusted · \(m.payloadString("to") ?? "")"
        default:        return oneLine(m.body ?? "")
        }
    }

    private static func oneLine(_ s: String) -> String {
        s.split(whereSeparator: \.isNewline).joined(separator: " ")
    }
}
