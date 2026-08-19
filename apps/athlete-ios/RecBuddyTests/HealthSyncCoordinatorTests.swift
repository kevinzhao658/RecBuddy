import Testing
import Foundation
@testable import RecBuddy

@MainActor
final class FakeProvider: ActivityProvider {
    var samples: [ActivitySample] = []
    var thrown: Error?
    var fetchedSince: Date?
    func requestAuthorization() async throws {}
    func fetchActivities(since: Date) async throws -> [ActivitySample] {
        fetchedSince = since
        if let thrown { throw thrown }
        return samples
    }
    func startObserving(_ onChange: @escaping () async -> Void) {}
}

@MainActor
final class FakeSink: ActivityLogSink {
    var workouts: [Workout] = []
    var loggedIds: Set<String> = []
    var knownSourceIds: Set<String> = []
    var attached: [(String, String)] = []   // (sourceId, workoutId)
    var standalones: [String] = []
    func dayContext(_ day: String) async throws
        -> (workouts: [Workout], loggedWorkoutIds: Set<String>, knownSourceIds: Set<String>) {
        (workouts, loggedIds, knownSourceIds)
    }
    func logAttached(_ sample: ActivitySample, workoutId: String) async throws {
        attached.append((sample.sourceId, workoutId))
        loggedIds.insert(workoutId)             // mirrors the DB: workout now logged
        knownSourceIds.insert(sample.sourceId)
    }
    func logStandalone(_ sample: ActivitySample) async throws {
        standalones.append(sample.sourceId)
        knownSourceIds.insert(sample.sourceId)
    }
}

@Suite @MainActor struct HealthSyncCoordinatorTests {
    let t0 = Date(timeIntervalSince1970: 1_787_000_000)
    func sample(_ id: String, kind: ActivityKind = .running, miles: Double = 5,
                start: TimeInterval = 0, hr: Int? = nil) -> ActivitySample {
        ActivitySample(sourceId: id, source: .appleHealth, startDate: t0.addingTimeInterval(start),
                       distanceMeters: miles * 1609.344, durationSeconds: 2700, avgHR: hr, kind: kind)
    }
    func workout(_ id: String, type: String) -> Workout {
        Workout(id: id, planId: "p", athleteId: "a", date: HealthMatcher.localDay(of: t0),
                type: type, title: type, dist: 5, pace: "9:00/mi", estMinutes: nil,
                dur: nil, note: nil, sets: [], status: "planned")
    }
    func make(_ provider: FakeProvider, _ sink: FakeSink) -> (HealthSyncCoordinator, SyncState) {
        let state = SyncState(defaults: UserDefaults(suiteName: "CoordTests-\(UUID().uuidString)")!)
        state.autoSyncEnabled = true
        let c = HealthSyncCoordinator(provider: provider, sink: sink, state: state, now: { self.t0 })
        return (c, state)
    }

    @Test func autoLogsUnambiguousAndAdvancesLastSync() async {
        let p = FakeProvider(); p.samples = [sample("r1")]
        let s = FakeSink(); s.workouts = [workout("w1", type: "easy")]
        let (c, state) = make(p, s)
        let newPending = await c.sync()
        #expect(s.attached.map(\.1) == ["w1"])
        #expect(newPending == 0)
        #expect(state.lastSync == t0)
    }
    @Test func ambiguousGoesToPendingWithCandidates() async {
        let p = FakeProvider(); p.samples = [sample("r1")]
        let s = FakeSink(); s.workouts = [workout("w1", type: "easy"), workout("w2", type: "tempo")]
        let (c, state) = make(p, s)
        let newPending = await c.sync()
        #expect(newPending == 1)
        #expect(state.pending.first?.candidates.map(\.id) == ["w1", "w2"])
        #expect(s.attached.isEmpty)
    }
    @Test func standaloneOutcomeGoesToPendingWithNoCandidates() async {
        let p = FakeProvider(); p.samples = [sample("c1", kind: .cycling)]
        let s = FakeSink(); s.workouts = [workout("w1", type: "easy")]
        let (c, state) = make(p, s)
        _ = await c.sync()
        #expect(state.pending.first?.candidates.isEmpty == true) // confirm-to-include, per spec
        #expect(s.standalones.isEmpty)                            // nothing written yet
    }
    @Test func autoSyncOffIsANoOp() async {
        let p = FakeProvider(); p.samples = [sample("r1")]
        let s = FakeSink(); s.workouts = [workout("w1", type: "easy")]
        let (c, state) = make(p, s)
        state.autoSyncEnabled = false
        _ = await c.sync()
        #expect(s.attached.isEmpty)
        #expect(p.fetchedSince == nil)   // never even fetched
        #expect(state.lastSync == nil)
    }
    @Test func fetchFailureDoesNotAdvanceLastSync() async {
        struct Boom: Error {}
        let p = FakeProvider(); p.thrown = Boom()
        let (c, state) = make(p, FakeSink())
        _ = await c.sync()
        #expect(state.lastSync == nil)
    }
    @Test func resyncOverlapIsIdempotent() async {
        let p = FakeProvider(); p.samples = [sample("r1")]
        let s = FakeSink(); s.workouts = [workout("w1", type: "easy")]
        let (c, _) = make(p, s)
        _ = await c.sync()
        _ = await c.sync()   // overlap re-fetches r1; knownSourceIds now contains it
        #expect(s.attached.count == 1)
    }
    @Test func excludedIdsNeverReimport() async {
        let p = FakeProvider(); p.samples = [sample("r1")]
        let s = FakeSink(); s.workouts = [workout("w1", type: "easy")]
        let (c, state) = make(p, s)
        state.exclude("r1")   // athlete dismissed or deleted it earlier
        _ = await c.sync()
        #expect(s.attached.isEmpty)
        #expect(state.pending.isEmpty)
    }
    @Test func twoRunsQueueTwoPendings() async {
        let p = FakeProvider(); p.samples = [sample("r1"), sample("r2", start: 4000)]
        let s = FakeSink(); s.workouts = [workout("w1", type: "easy")]
        let (c, state) = make(p, s)
        let newPending = await c.sync()
        #expect(newPending == 2)
        #expect(state.pending.count == 2)
    }
    @Test func resolveAttachWritesAndClearsPending() async throws {
        let p = FakeProvider(); p.samples = [sample("r1")]
        let s = FakeSink(); s.workouts = [workout("w1", type: "easy"), workout("w2", type: "tempo")]
        let (c, state) = make(p, s)
        _ = await c.sync()
        try await c.resolve("r1", .attach(workoutId: "w2"))
        #expect(s.attached.map(\.1) == ["w2"])
        #expect(state.pending.isEmpty)
    }
    @Test func resolveStandaloneWritesExtra() async throws {
        let p = FakeProvider(); p.samples = [sample("c1", kind: .cycling)]
        let s = FakeSink()
        let (c, state) = make(p, s)
        _ = await c.sync()
        try await c.resolve("c1", .standalone)
        #expect(s.standalones == ["c1"])
        #expect(state.pending.isEmpty)
    }
    @Test func resolveDismissExcludes() async throws {
        let p = FakeProvider(); p.samples = [sample("r1"), sample("r2", start: 4000)]
        let s = FakeSink(); s.workouts = [workout("w1", type: "easy")]
        let (c, state) = make(p, s)
        _ = await c.sync()
        try await c.resolve("r1", .dismiss)
        #expect(state.excludedSourceIds.contains("r1"))
        #expect(state.pending.map(\.id) == ["r2"])
    }

    @Test func duplicateRecordingsOfOneRunAutoLogOnce() async {
        // Coros + Watch both wrote the same run; only the richer copy imports.
        let p = FakeProvider()
        p.samples = [sample("watch"), sample("coros", start: 30, hr: 151)]
        let s = FakeSink(); s.workouts = [workout("w1", type: "easy")]
        let (c, state) = make(p, s)
        let newPending = await c.sync()
        #expect(s.attached.map(\.0) == ["coros"])
        #expect(s.attached.map(\.1) == ["w1"])
        #expect(newPending == 0)
        #expect(state.pending.isEmpty)
    }
}
