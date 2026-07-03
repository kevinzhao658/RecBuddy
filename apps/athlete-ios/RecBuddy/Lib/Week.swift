import Foundation

/// ISO "YYYY-MM-DD" date math in UTC — a direct port of coach-web's lib/week.ts
/// so both clients agree on week boundaries. todayISO() alone is local-time.
enum Week {
    static let DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    private static let MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                              "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    private static let utcCal: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "UTC")!
        return c
    }()

    static func parse(_ iso: String) -> Date? {
        let parts = iso.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        return utcCal.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2]))
    }

    static func format(_ date: Date) -> String {
        let c = utcCal.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year!, c.month!, c.day!)
    }

    static func addDays(_ iso: String, _ n: Int) -> String {
        guard let d = parse(iso), let out = utcCal.date(byAdding: .day, value: n, to: d) else { return iso }
        return format(out)
    }

    static func mondayOf(_ iso: String) -> String {
        guard let d = parse(iso) else { return iso }
        let dow = (utcCal.component(.weekday, from: d) + 5) % 7 // Mon=0 ... Sun=6
        return addDays(iso, -dow)
    }

    static func weekDates(mondayIso: String) -> [String] {
        (0..<7).map { addDays(mondayIso, $0) }
    }

    /// 'YYYY-MM-DD' -> 'Aug 23'. Empty for nil; passthrough if unparseable.
    static func fmtShortDate(_ iso: String?) -> String {
        guard let iso else { return "" }
        guard let d = parse(iso) else { return iso }
        let c = utcCal.dateComponents([.month, .day], from: d)
        return "\(MON[c.month! - 1]) \(c.day!)"
    }

    /// Today's calendar date in the user's LOCAL timezone (matches what they see).
    /// Explicit Gregorian: Calendar.current honors the device calendar setting
    /// (e.g. Japanese era years), which would corrupt the ISO year.
    static func todayISO() -> String {
        var localCal = Calendar(identifier: .gregorian)
        localCal.timeZone = .current
        let c = localCal.dateComponents([.year, .month, .day], from: Date())
        return String(format: "%04d-%02d-%02d", c.year!, c.month!, c.day!)
    }
}
