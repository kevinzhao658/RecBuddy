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

    /// Collapse duplicate recordings of the SAME physical activity: two
    /// same-kind samples with overlapping time ranges can't be two different
    /// efforts by one human — they're one run recorded twice (e.g. a Coros
    /// watch AND Apple Watch both writing to Health). Overlap clusters are
    /// built per kind with a start-sorted sweep; each cluster keeps its richest
    /// record (HR present, then distance, then duration, then sourceId), a
    /// DETERMINISTIC choice so repeat passes always pick the same winner and
    /// the source-id dedup drops the rest. Back-to-back activities (one ends
    /// exactly as the next starts) never collapse.
    static func dedupeOverlapping(_ samples: [ActivitySample]) -> [ActivitySample] {
        var kept: [ActivitySample] = []
        for kind in [ActivityKind.running, .cycling, .other] {
            let group = samples.filter { $0.kind == kind }.sorted { $0.startDate < $1.startDate }
            var cluster: [ActivitySample] = []
            var clusterEnd = Date.distantPast
            for s in group {
                if cluster.isEmpty || s.startDate < clusterEnd {
                    cluster.append(s)
                    clusterEnd = max(clusterEnd, s.endDate)
                } else {
                    kept.append(richest(of: cluster))
                    cluster = [s]
                    clusterEnd = s.endDate
                }
            }
            if !cluster.isEmpty { kept.append(richest(of: cluster)) }
        }
        return kept.sorted { $0.startDate < $1.startDate }
    }

    /// The most complete recording in an overlap cluster ("better" sorts
    /// first). Lap markers outrank everything — the lap-rich copy (usually the
    /// dedicated running watch) is the one segment analysis will want.
    private static func richest(of cluster: [ActivitySample]) -> ActivitySample {
        cluster.min { a, b in
            let aLaps = a.lapEventCount ?? 0, bLaps = b.lapEventCount ?? 0
            if aLaps != bLaps { return aLaps > bLaps }
            let aHR = a.avgHR != nil ? 1 : 0, bHR = b.avgHR != nil ? 1 : 0
            if aHR != bHR { return aHR > bHR }
            if a.distanceMeters != b.distanceMeters { return a.distanceMeters > b.distanceMeters }
            if a.durationSeconds != b.durationSeconds { return a.durationSeconds > b.durationSeconds }
            return a.sourceId < b.sourceId
        }!
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
