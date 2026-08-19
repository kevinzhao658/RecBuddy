import Foundation

/// Everything the matcher needs about one plan day, straight from the DB —
/// works from a background wake with no store cache loaded.
protocol ActivityLogSink {
    func dayContext(_ day: String) async throws
        -> (workouts: [Workout], loggedWorkoutIds: Set<String>, knownSourceIds: Set<String>)
    func logAttached(_ sample: ActivitySample, workoutId: String) async throws
    func logStandalone(_ sample: ActivitySample) async throws
}

/// Orchestrates one sync pass over a provider: fetch since lastSync (with an
/// overlap window), classify per local day via HealthMatcher, route outcomes.
/// Ambiguous/standalone activities queue as pending confirmations; the caller
/// (HealthSyncService) decides whether to notify. Gated by the Settings toggle.
@MainActor
final class HealthSyncCoordinator {
    static let overlapSeconds: TimeInterval = 6 * 3600
    static let firstSyncLookbackDays = 7

    private let provider: ActivityProvider
    private let sink: ActivityLogSink
    let state: SyncState
    private let calendar: Calendar
    private let now: () -> Date

    init(provider: ActivityProvider, sink: ActivityLogSink, state: SyncState,
         calendar: Calendar = .current, now: @escaping () -> Date = Date.init) {
        self.provider = provider
        self.sink = sink
        self.state = state
        self.calendar = calendar
        self.now = now
    }

    func sync() async -> Int {
        guard state.autoSyncEnabled else { return 0 }
        let passStart = now()
        let since = (state.lastSync ?? passStart.addingTimeInterval(
            -Double(Self.firstSyncLookbackDays) * 86_400)).addingTimeInterval(-Self.overlapSeconds)
        guard let fetched = try? await provider.fetchActivities(since: since) else { return 0 }
        // Coros + Apple Watch can both write the same run to Health — collapse
        // overlapping same-kind recordings to the richest copy before classifying.
        let samples = HealthMatcher.dedupeOverlapping(fetched)

        var newPending = 0
        var allDaysSucceeded = true
        let byDay = Dictionary(grouping: samples) { HealthMatcher.localDay(of: $0.startDate, calendar: calendar) }
        for (day, dayActivities) in byDay.sorted(by: { $0.key < $1.key }) {
            guard let ctx = try? await sink.dayContext(day) else { allDaysSucceeded = false; continue }
            var logged = ctx.loggedWorkoutIds
            // Known DB source_ids + user exclusions both mean "don't touch".
            var excluded = state.excludedSourceIds.union(ctx.knownSourceIds)
            for activity in dayActivities.sorted(by: { $0.startDate < $1.startDate }) {
                let outcome = HealthMatcher.classify(activity: activity, dayActivities: dayActivities,
                                                     dayWorkouts: ctx.workouts, loggedWorkoutIds: logged,
                                                     excludedSourceIds: excluded)
                switch outcome {
                case .autoLog(let workoutId):
                    if (try? await sink.logAttached(activity, workoutId: workoutId)) != nil {
                        logged.insert(workoutId)       // a second sample reclassifies correctly
                        excluded.insert(activity.sourceId)
                    } else {
                        allDaysSucceeded = false
                    }
                case .needsConfirm(let candidateIds):
                    let candidates = ctx.workouts.filter { candidateIds.contains($0.id) }
                        .map { PendingCandidate(id: $0.id, title: $0.title, type: $0.type) }
                    if !state.pending.contains(where: { $0.id == activity.sourceId }) { newPending += 1 }
                    state.addPending(PendingActivity(sample: activity, candidates: candidates))
                case .standalone:
                    // Confirm-to-include per spec: queue with no candidates.
                    if !state.pending.contains(where: { $0.id == activity.sourceId }) { newPending += 1 }
                    state.addPending(PendingActivity(sample: activity, candidates: []))
                case .skip:
                    break
                }
            }
        }
        if allDaysSucceeded { state.markSynced(at: passStart) }
        return newPending
    }

    enum Resolution { case attach(workoutId: String), standalone, dismiss }

    func resolve(_ pendingId: String, _ resolution: Resolution) async throws {
        guard let p = state.pending.first(where: { $0.id == pendingId }) else { return }
        switch resolution {
        case .attach(let workoutId): try await sink.logAttached(p.sample, workoutId: workoutId)
        case .standalone:            try await sink.logStandalone(p.sample)
        case .dismiss:               state.exclude(p.sample.sourceId)
        }
        state.removePending(sourceId: pendingId)
    }
}
