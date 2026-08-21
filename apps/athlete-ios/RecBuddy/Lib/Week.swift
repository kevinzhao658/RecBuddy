import Foundation

/// ISO "YYYY-MM-DD" date math in UTC — a direct port of coach-web's lib/week.ts
/// so both clients agree on week boundaries. todayISO() alone is local-time.
enum Week {
    static let DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    private static let MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                              "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    private static let FULLMON = ["January", "February", "March", "April", "May", "June",
                                  "July", "August", "September", "October", "November", "December"]

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

    /// First day of the month containing `iso`: '2026-06-21' -> '2026-06-01'.
    static func firstOfMonth(_ iso: String) -> String {
        guard iso.count >= 8 else { return iso }
        return String(iso.prefix(8)) + "01"
    }

    /// Add `n` calendar months (call on a day-01 date to avoid end-of-month rollover).
    static func addMonths(_ iso: String, _ n: Int) -> String {
        guard let d = parse(iso), let out = utcCal.date(byAdding: .month, value: n, to: d) else { return iso }
        return format(out)
    }

    /// Mon-first calendar grid (35 or 42 days) covering the month containing `anchor`.
    static func monthGridDates(anchor: String) -> [String] {
        let first = firstOfMonth(anchor)
        let start = mondayOf(first)
        let lastDay = addDays(addMonths(first, 1), -1)
        let end = addDays(mondayOf(lastDay), 6)
        guard let startDate = parse(start), let endDate = parse(end) else { return [] }
        let span = Int(endDate.timeIntervalSince(startDate) / 86400) + 1
        return (0..<span).map { addDays(start, $0) }
    }

    /// '2026-06-21' -> 'June 2026'.
    static func fmtMonthYear(_ iso: String) -> String {
        guard let d = parse(iso) else { return iso }
        let c = utcCal.dateComponents([.year, .month], from: d)
        return "\(FULLMON[c.month! - 1]) \(c.year!)"
    }

    /// 'YYYY-MM-DD' -> 'Aug 23'. Empty for nil; passthrough if unparseable.
    static func fmtShortDate(_ iso: String?) -> String {
        guard let iso else { return "" }
        guard let d = parse(iso) else { return iso }
        let c = utcCal.dateComponents([.month, .day], from: d)
        return "\(MON[c.month! - 1]) \(c.day!)"
    }

    /// 'YYYY-MM-DD' -> 'Tue, Jun 2' using Monday-first DOW labels.
    static func fmtDayDate(_ iso: String) -> String {
        let monday = mondayOf(iso)
        let dates = weekDates(mondayIso: monday)
        guard let idx = dates.firstIndex(of: iso) else { return fmtShortDate(iso) }
        return "\(DOW[idx]), \(fmtShortDate(iso))"
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

    // ── Local-day parsing (for DatePicker round trips) ────────────────────
    // DatePicker displays a Date in the LOCAL timezone: a 'YYYY-MM-DD' parsed
    // as UTC midnight renders as the PREVIOUS day west of Greenwich (Nov 1 ->
    // "Oct 31" in PDT). Parse/format calendar dates through the local zone so
    // the picker shows exactly the stored day and saves exactly what it shows.

    static func parseLocalDay(_ iso: String) -> Date? {
        let p = iso.split(separator: "-").compactMap { Int($0) }
        guard p.count == 3 else { return nil }
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = .current
        return cal.date(from: DateComponents(year: p[0], month: p[1], day: p[2]))
    }

    static func formatLocalDay(_ date: Date) -> String {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = .current
        let c = cal.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year!, c.month!, c.day!)
    }

    // ── Training-block week math (mirrors web lib/week.ts) ────────────────

    /// 1-based week number of the week containing `monday` within a block
    /// starting the Monday of `start`. 0 or negative = before the block.
    static func blockWeek(monday: String, start: String) -> Int {
        guard let m = parse(monday), let s = parse(mondayOf(start)) else { return 0 }
        let days = utcCal.dateComponents([.day], from: s, to: m).day ?? 0
        return Int(floor(Double(days) / 7.0)) + 1
    }

    /// Total weeks in a block: Monday-of-start through the week containing `goal`.
    static func blockWeeks(start: String, goal: String) -> Int {
        max(1, blockWeek(monday: mondayOf(goal), start: start))
    }

    /// Supabase timestamptz -> local 'YYYY-MM-DD'. Strips fractional seconds
    /// first (Postgres emits 6 digits; ISO8601DateFormatter only parses 3).
    static func localDay(fromTimestamp ts: String, calendar: Calendar = .current) -> String? {
        let stripped = ts.replacingOccurrences(of: #"\.\d+"#, with: "", options: .regularExpression)
        let iso = ISO8601DateFormatter()
        guard let date = iso.date(from: stripped) else { return nil }
        let f = DateFormatter()
        f.calendar = calendar
        f.timeZone = calendar.timeZone
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: date)
    }

    /// Noon LOCAL time of a 'YYYY-MM-DD' day as an ISO-8601 timestamp — a
    /// recorded_at that always buckets back onto the same local day via
    /// localDay(fromTimestamp:), whatever the timezone offset.
    static func localNoonTimestamp(_ dayIso: String, calendar: Calendar = .current) -> String {
        let parts = dayIso.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return dayIso + "T12:00:00Z" }
        var comps = DateComponents()
        comps.year = parts[0]; comps.month = parts[1]; comps.day = parts[2]; comps.hour = 12
        let date = calendar.date(from: comps) ?? Date()
        return ISO8601DateFormatter().string(from: date)
    }
}
