import Foundation

/// What one activity renders as in a week-glance column.
enum PairIcon: Equatable {
    case type(String)    // planned workout -> TypeBadge symbol + intensity tint
    case sport(String)   // extra's declared sport -> sport symbol, aerobic green
}
struct GlancePair: Equatable {
    let icon: PairIcon
    let text: String?    // "5.0 mi" / "6.4 km" / "45'" / nil (icon only)
}

/// Pure rules for the athlete week strip — selection defaults, glance pairs,
/// and rest-only detection. No SwiftUI, fully unit-tested.
enum WeekStripLogic {
    /// Today when the displayed week contains it; else Monday.
    static func defaultSelection(weekDates: [String], today: String) -> String {
        weekDates.contains(today) ? today : (weekDates.first ?? today)
    }
}

extension WeekStripLogic {
    /// Planned non-rest workouts first (distance in the athlete's unit;
    /// time-based targets as apostrophe minutes), then extras (swims in
    /// meters). Pure — drives every column.
    static func pairs(workouts: [Workout], extras: [WorkoutActual], unit: Unit) -> [GlancePair] {
        var out: [GlancePair] = []
        for w in workouts where w.type != "rest" && w.status != "rest" {
            let text: String?
            if let d = w.dist {
                let convertedDist = Units.fromMiles(d, unit)
                let formatted = String(format: "%.1f", convertedDist)
                text = "\(formatted) \(unit.rawValue)"
            } else if let mins = w.estMinutes ?? w.dur {
                text = "\(mins)'"
            } else {
                text = nil
            }
            out.append(GlancePair(icon: .type(w.type), text: text))
        }
        for a in extras {
            let text = a.declaredActivity == "swim"
                ? "\(SportMetrics.meters(fromMiles: a.dist))m"
                : {
                    let convertedDist = Units.fromMiles(a.dist, unit)
                    let formatted = String(format: "%.1f", convertedDist)
                    return "\(formatted) \(unit.rawValue)"
                }()
            out.append(GlancePair(icon: .sport(a.declaredActivity), text: text))
        }
        return out
    }

    /// True when the day is nothing but rest — the column shows the moon.
    static func isRestOnly(workouts: [Workout], extras: [WorkoutActual]) -> Bool {
        !workouts.isEmpty && extras.isEmpty
            && workouts.allSatisfy { $0.type == "rest" || $0.status == "rest" }
    }
}

// TEMPORARY back-compat for DayStrip/CalendarView until Task 4 deletes them.
enum DayMark: Equatable { case none; case allDone; case dots([Bool]) }
extension WeekStripLogic {
    static func marks(workouts: [Workout], extras: [WorkoutActual]) -> DayMark {
        let active = workouts.filter { $0.type != "rest" && $0.status != "rest" }
        let flags = active.map { $0.status == "done" } + extras.map { _ in true }
        if flags.isEmpty { return .none }
        if !flags.contains(false) { return .allDone }
        return .dots(Array(flags.prefix(3)))
    }
    static func rolloverLanding(forward: Bool, weekDates: [String]) -> String {
        (forward ? weekDates.first : weekDates.last) ?? ""
    }
}
