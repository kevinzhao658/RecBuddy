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
}
