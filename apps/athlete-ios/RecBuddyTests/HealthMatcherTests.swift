import Testing
import Foundation
@testable import RecBuddy

@Suite struct HealthMatcherTests {
    // Builders
    func run(_ id: String, miles: Double = 5, kind: ActivityKind = .running) -> ActivitySample {
        ActivitySample(sourceId: id, source: .appleHealth,
                       startDate: Date(timeIntervalSince1970: 1_787_000_000),
                       distanceMeters: miles * 1609.344,
                       durationSeconds: Int(miles * 540), avgHR: 150, kind: kind)
    }
    func workout(_ id: String, type: String) -> Workout {
        Workout(id: id, planId: "p", athleteId: "a", date: "2026-08-17", type: type,
                title: type.capitalized, dist: 5, pace: "9:00/mi", estMinutes: nil,
                dur: nil, note: nil, sets: [], status: "planned")
    }
    func classify(_ a: ActivitySample, day: [ActivitySample]? = nil, ws: [Workout],
                  logged: Set<String> = [], excluded: Set<String> = []) -> MatchOutcome {
        HealthMatcher.classify(activity: a, dayActivities: day ?? [a], dayWorkouts: ws,
                               loggedWorkoutIds: logged, excludedSourceIds: excluded)
    }

    @Test func oneRunOneCandidateAutoLogs() {
        #expect(classify(run("r1"), ws: [workout("w1", type: "easy")]) == .autoLog(workoutId: "w1"))
    }
    @Test func twoCandidatesNeedConfirm() {
        let ws = [workout("w1", type: "easy"), workout("w2", type: "tempo")]
        #expect(classify(run("r1"), ws: ws) == .needsConfirm(candidateWorkoutIds: ["w1", "w2"]))
    }
    @Test func twoRunsSameDayNeedConfirm() {
        let a = run("r1"), b = run("r2")
        #expect(classify(a, day: [a, b], ws: [workout("w1", type: "easy")])
                == .needsConfirm(candidateWorkoutIds: ["w1"]))
    }
    @Test func runAndRideDoNotCrossAmbiguate() {
        let r = run("r1"), ride = run("c1", kind: .cycling)
        let ws = [workout("w1", type: "easy"), workout("w2", type: "cross")]
        #expect(classify(r, day: [r, ride], ws: ws) == .autoLog(workoutId: "w1"))
        #expect(classify(ride, day: [r, ride], ws: ws) == .autoLog(workoutId: "w2"))
    }
    @Test func rideWithoutCrossDayIsStandalone() {
        #expect(classify(run("c1", kind: .cycling), ws: [workout("w1", type: "easy")]) == .standalone)
    }
    @Test func loggedWorkoutIsNeverACandidate() {
        // The only candidate already has an actual -> never overwrite -> standalone.
        #expect(classify(run("r1"), ws: [workout("w1", type: "easy")], logged: ["w1"]) == .standalone)
    }
    @Test func restAndOtherTypesAreNotCandidates() {
        let ws = [workout("w1", type: "rest"), workout("w2", type: "other")]
        #expect(classify(run("r1"), ws: ws) == .standalone)
    }
    @Test func noiseFloorSkips() {
        #expect(classify(run("r1", miles: 0.2), ws: [workout("w1", type: "easy")])
                == .skip(.belowNoiseFloor))
    }
    @Test func unsupportedKindSkips() {
        #expect(classify(run("s1", kind: .other), ws: []) == .skip(.unsupportedKind))
    }
    @Test func excludedSourceIdSkips() {
        #expect(classify(run("r1"), ws: [workout("w1", type: "easy")], excluded: ["r1"])
                == .skip(.excluded))
    }
    @Test func excludedSiblingDoesNotCountTowardAmbiguity() {
        let a = run("r1"), b = run("r2")
        #expect(classify(a, day: [a, b], ws: [workout("w1", type: "easy")], excluded: ["r2"])
                == .autoLog(workoutId: "w1"))
    }
    @Test func swimAutoLogsToACrossDay() {
        #expect(classify(run("s1", kind: .swimming), ws: [workout("w1", type: "cross")])
                == .autoLog(workoutId: "w1"))
    }
    @Test func swimWithoutCrossDayIsStandalone() {
        #expect(classify(run("s1", kind: .swimming), ws: [workout("w1", type: "easy")]) == .standalone)
    }
    @Test func rideAndSwimSameDayShareTheCrossFamilyAndNeedConfirm() {
        // Both kinds target the ONE cross workout — neither may auto-attach.
        let ride = run("c1", kind: .cycling), swim = run("s1", kind: .swimming)
        let ws = [workout("w1", type: "cross")]
        #expect(classify(ride, day: [ride, swim], ws: ws)
                == .needsConfirm(candidateWorkoutIds: ["w1"]))
        #expect(classify(swim, day: [ride, swim], ws: ws)
                == .needsConfirm(candidateWorkoutIds: ["w1"]))
    }
    @Test func runAndSwimDoNotCrossAmbiguate() {
        let r = run("r1"), swim = run("s1", kind: .swimming)
        let ws = [workout("w1", type: "easy"), workout("w2", type: "cross")]
        #expect(classify(r, day: [r, swim], ws: ws) == .autoLog(workoutId: "w1"))
        #expect(classify(swim, day: [r, swim], ws: ws) == .autoLog(workoutId: "w2"))
    }

    // ── dedupeOverlapping: duplicate recordings of one physical activity ──
    func rec(_ id: String, start: TimeInterval, dur: Int, kind: ActivityKind = .running,
             miles: Double = 5, hr: Int? = nil, laps: Int? = nil) -> ActivitySample {
        ActivitySample(sourceId: id, source: .appleHealth,
                       startDate: Date(timeIntervalSince1970: 1_787_000_000 + start),
                       distanceMeters: miles * 1609.344, durationSeconds: dur,
                       avgHR: hr, kind: kind, lapEventCount: laps)
    }

    @Test func overlappingRunsCollapseToTheLapRichRecording() {
        // Coros copy carries laps; Watch copy carries HR — laps win.
        let watch = rec("watch", start: 0, dur: 2700, hr: 152)
        let coros = rec("coros", start: 30, dur: 2650, laps: 8)
        let kept = HealthMatcher.dedupeOverlapping([watch, coros])
        #expect(kept.map(\.sourceId) == ["coros"])
    }
    @Test func hrBreaksTheTieWhenNeitherHasLaps() {
        let a = rec("a", start: 0, dur: 2700)
        let b = rec("b", start: 0, dur: 2700, hr: 150)
        #expect(HealthMatcher.dedupeOverlapping([a, b]).map(\.sourceId) == ["b"])
    }
    @Test func backToBackRunsBothSurvive() {
        let a = rec("a", start: 0, dur: 1800)
        let b = rec("b", start: 1800, dur: 1800) // starts exactly as a ends
        #expect(HealthMatcher.dedupeOverlapping([a, b]).count == 2)
    }
    @Test func overlappingRunAndRideBothSurvive() {
        let run = rec("r", start: 0, dur: 2700)
        let ride = rec("c", start: 0, dur: 2700, kind: .cycling)
        #expect(HealthMatcher.dedupeOverlapping([run, ride]).count == 2)
    }
    @Test func overlappingSwimsCollapseButRideAndSwimDoNot() {
        let s1 = rec("s1", start: 0, dur: 1800, kind: .swimming)
        let s2 = rec("s2", start: 60, dur: 1700, kind: .swimming, hr: 140)
        let ride = rec("c1", start: 0, dur: 1800, kind: .cycling)
        let kept = HealthMatcher.dedupeOverlapping([s1, s2, ride])
        #expect(Set(kept.map(\.sourceId)) == ["s2", "c1"]) // swims dedupe (HR wins); ride survives
    }
    @Test func chainedOverlapsCollapseToOne() {
        let a = rec("a", start: 0, dur: 1800)
        let b = rec("b", start: 1500, dur: 1800)      // overlaps a
        let c = rec("c", start: 3000, dur: 600, laps: 4) // overlaps b, not a
        let kept = HealthMatcher.dedupeOverlapping([a, b, c])
        #expect(kept.map(\.sourceId) == ["c"])
    }
    @Test func winnerIsDeterministicRegardlessOfInputOrder() {
        let a = rec("a", start: 0, dur: 2700, hr: 150)
        let b = rec("b", start: 60, dur: 2600, laps: 6)
        #expect(HealthMatcher.dedupeOverlapping([a, b]).map(\.sourceId)
                == HealthMatcher.dedupeOverlapping([b, a]).map(\.sourceId))
    }
}
