import Foundation

enum Unit: String { case mi, km }

/// mi/km display conversion — port of coach-web's lib/units.ts.
/// Storage is ALWAYS miles + "M:SS/mi"; unit only changes display.
enum Units {
    static let kmPerMi = 1.609344

    static func fromMiles(_ miles: Double, _ unit: Unit) -> Double {
        unit == .km ? miles * kmPerMi : miles
    }
    static func toMiles(_ value: Double, _ unit: Unit) -> Double {
        unit == .km ? value / kmPerMi : value
    }
    /// Stored mileage -> display number ("6", "4.5", "16.1"); "" for nil.
    static func fmtDist(_ miles: Double?, _ unit: Unit) -> String {
        guard let miles else { return "" }
        let v = fromMiles(miles, unit)
        let rounded = (v * 10).rounded() / 10
        return rounded == rounded.rounded() ? String(Int(rounded)) : String(format: "%.1f", rounded)
    }
    /// Stored "M:SS/mi" -> display pace in the unit, e.g. "5:17/km". "" for nil.
    static func fmtPace(_ pace: String?, _ unit: Unit) -> String {
        guard let pace else { return "" }
        guard var sec = Pace.toSeconds(pace) else { return pace }
        if unit == .km { sec = Int((Double(sec) / kmPerMi).rounded()) }
        return "\(sec / 60):" + String(format: "%02d", sec % 60) + "/\(unit.rawValue)"
    }
}
