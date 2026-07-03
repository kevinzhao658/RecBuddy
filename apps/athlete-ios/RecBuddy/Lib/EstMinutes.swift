import Foundation

/// Estimated workout minutes — port of coach-web's lib/estMinutes.ts.
enum EstMinutes {
    static func compute(type: String, estMinutes: Int?, dist: Double?, pace: String?, dur: Int?) -> Int {
        if type == "rest" { return 0 }
        if let estMinutes { return estMinutes }
        if let dist, dist > 0, let sec = Pace.toSeconds(pace) {
            return Int((dist * Double(sec) / 60).rounded())
        }
        if let dur { return dur }
        if type == "cross" { return 45 }
        return 0
    }
}
