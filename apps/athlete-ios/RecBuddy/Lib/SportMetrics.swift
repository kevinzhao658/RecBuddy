import Foundation

/// Sport-native display metrics: rides read in average speed, swims in meters
/// and pace per 100 m (nobody swims in min/mi). Pure helpers, unit-tested.
enum SportMetrics {
    static let metersPerMile = 1609.344

    /// "17.7 mph" / "28.4 km/h" for a ride; nil until dist + time are valid.
    static func avgSpeedText(miles: Double, seconds: Int, unit: Unit) -> String? {
        guard miles > 0, seconds > 0 else { return nil }
        let dist = unit == .km ? miles * Units.kmPerMi : miles
        let v = dist / (Double(seconds) / 3600)
        return String(format: "%.1f %@", v, unit == .km ? "km/h" : "mph")
    }

    /// "1:45 /100m" — THE swim metric; nil until dist + time are valid.
    static func swimPace100Text(miles: Double, seconds: Int) -> String? {
        guard miles > 0, seconds > 0 else { return nil }
        let per100 = Int((Double(seconds) / (miles * metersPerMile / 100)).rounded())
        return "\(per100 / 60):" + String(format: "%02d", per100 % 60) + " /100m"
    }

    /// Stored miles -> whole meters (swim distances are entered/read in meters).
    static func meters(fromMiles miles: Double) -> Int {
        Int((miles * metersPerMile).rounded())
    }

    /// "1,500 m" for display.
    static func metersText(miles: Double) -> String {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.locale = Locale(identifier: "en_US")
        let m = meters(fromMiles: miles)
        return (f.string(from: NSNumber(value: m)) ?? "\(m)") + " m"
    }

    /// Entered meters -> canonical storage miles (2 dp, like Units.toMiles).
    static func miles(fromMeters m: Double) -> Double {
        (m / metersPerMile * 100).rounded() / 100
    }
}
