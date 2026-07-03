import Foundation

/// Canonical pace is "M:SS/mi" (seconds per mile) — port of PaceField's
/// paceToSeconds/secondsToPace from coach-web.
enum Pace {
    /// "7:30/mi" -> 450. nil for nil/unparseable.
    static func toSeconds(_ pace: String?) -> Int? {
        guard let pace else { return nil }
        guard let m = pace.firstMatch(of: /(\d+):(\d{1,2})/) else { return nil }
        return Int(m.1)! * 60 + Int(m.2)!
    }
    /// 450 -> "7:30/mi" (clamped at 0).
    static func fromSeconds(_ s: Int) -> String {
        let t = max(0, s)
        return "\(t / 60):" + String(format: "%02d", t % 60) + "/mi"
    }
    /// Pace from a logged run: miles + total seconds -> canonical "/mi" string.
    static func derive(miles: Double, totalSeconds: Int) -> String? {
        guard miles > 0, totalSeconds > 0 else { return nil }
        return fromSeconds(Int((Double(totalSeconds) / miles).rounded()))
    }
    /// "45:00" or "1:25:14" -> total seconds. nil if unparseable.
    static func timeToSeconds(_ time: String) -> Int? {
        let parts = time.split(separator: ":")
        let nums = parts.compactMap { Int($0) }
        guard nums.count == parts.count else { return nil }
        switch nums.count {
        case 2: return nums[0] * 60 + nums[1]
        case 3: return nums[0] * 3600 + nums[1] * 60 + nums[2]
        default: return nil
        }
    }
}
