import Foundation

/// Pure classification of one provider activity against one day's plan.
/// No HealthKit, no network, no store — the correctness core, fully unit-tested.
/// Ambiguity is judged WITHIN an activity family (running vs cycling) so a run
/// and a ride on the same day never make each other ambiguous.
enum HealthMatcher {
    static let noiseFloorMiles = 0.25
    static let runningTypes: Set<String> = ["easy", "long", "speed", "tempo", "recovery", "race"]

    /// Workout types an activity kind may attach to; nil = unsupported kind.
    static func candidateTypes(for kind: ActivityKind) -> Set<String>? {
        switch kind {
        case .running: return runningTypes
        case .cycling: return ["cross"]
        case .other:   return nil
        }
    }

    /// Local calendar day ('YYYY-MM-DD') of an activity — matches plan day keys.
    static func localDay(of date: Date, calendar: Calendar = .current) -> String {
        let f = DateFormatter()
        f.calendar = calendar
        f.timeZone = calendar.timeZone
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: date)
    }

    static func classify(activity: ActivitySample,
                         dayActivities: [ActivitySample],
                         dayWorkouts: [Workout],
                         loggedWorkoutIds: Set<String>,
                         excludedSourceIds: Set<String>) -> MatchOutcome {
        if excludedSourceIds.contains(activity.sourceId) { return .skip(.excluded) }
        guard let types = candidateTypes(for: activity.kind) else { return .skip(.unsupportedKind) }
        if activity.miles < noiseFloorMiles { return .skip(.belowNoiseFloor) }

        // Candidates: same family, not already logged (never overwrite).
        let candidates = dayWorkouts.filter { types.contains($0.type) && !loggedWorkoutIds.contains($0.id) }
        if candidates.isEmpty { return .standalone }

        // Family siblings that will actually be considered (excluded/noise don't ambiguate).
        let familyCount = dayActivities.filter {
            $0.kind == activity.kind && !excludedSourceIds.contains($0.sourceId) && $0.miles >= noiseFloorMiles
        }.count

        if candidates.count == 1 && familyCount == 1 { return .autoLog(workoutId: candidates[0].id) }
        return .needsConfirm(candidateWorkoutIds: candidates.map(\.id))
    }
}

enum SkipReason: Equatable { case belowNoiseFloor, unsupportedKind, excluded }

enum MatchOutcome: Equatable {
    case autoLog(workoutId: String)
    case needsConfirm(candidateWorkoutIds: [String])
    case standalone
    case skip(SkipReason)
}
