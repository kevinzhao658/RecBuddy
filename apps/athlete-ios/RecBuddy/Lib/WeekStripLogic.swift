import Foundation

/// Which status marks a day-strip pill shows under its date.
enum DayMark: Equatable {
    case none            // empty or rest-only day
    case allDone         // lime ✓ — everything logged
    case dots([Bool])    // one dot per unit, true = done; capped at 3
}

/// Pure rules for the athlete week strip — selection defaults, edge-rollover
/// landing day, and per-day status marks. No SwiftUI, fully unit-tested.
enum WeekStripLogic {
    /// Today when the displayed week contains it; else Monday.
    static func defaultSelection(weekDates: [String], today: String) -> String {
        weekDates.contains(today) ? today : (weekDates.first ?? today)
    }

    /// Swiping past Sunday lands on next week's Monday; past Monday on the
    /// previous week's Sunday. Called with the NEW week's dates.
    static func rolloverLanding(forward: Bool, weekDates: [String]) -> String {
        (forward ? weekDates.first : weekDates.last) ?? ""
    }

    /// ✓ when every unit is done; otherwise one dot per unit (done = lime),
    /// capped at 3. Rest workouts don't count; extras always count as done.
    static func marks(workouts: [Workout], extras: [WorkoutActual]) -> DayMark {
        let active = workouts.filter { $0.type != "rest" && $0.status != "rest" }
        let flags = active.map { $0.status == "done" } + extras.map { _ in true }
        if flags.isEmpty { return .none }
        if !flags.contains(false) { return .allDone }
        return .dots(Array(flags.prefix(3)))
    }
}
