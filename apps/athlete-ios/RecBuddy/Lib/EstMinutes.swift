import Foundation

/// Estimated workout minutes — port of coach-web's lib/estMinutes.ts.
enum EstMinutes {
    static func compute(type: String, estMinutes: Int?, dist: Double?, pace: String?, dur: Int?) -> Int {
        if type == "rest" { return 0 }
        if let estMinutes { return estMinutes }
        // TS parity: guard on dist>0 AND a non-empty pace STRING; garbage pace
        // parses to 0 (not a fall-through to dur), matching lib/estMinutes.ts.
        if let dist, dist > 0, let pace, !pace.isEmpty {
            let sec = Pace.toSeconds(pace) ?? 0
            return Int((dist * Double(sec) / 60).rounded())
        }
        if let dur { return dur }
        if type == "cross" { return 45 }
        return 0
    }
}
