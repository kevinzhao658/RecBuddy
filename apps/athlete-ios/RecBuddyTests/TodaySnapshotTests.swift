import Testing
import Foundation
@testable import RecBuddy

@Suite struct TodaySnapshotTests {
    func w(_ id: String, type: String = "easy", dist: Double? = 5, status: String = "planned") -> Workout {
        Workout(id: id, planId: "p", athleteId: "a", date: "2026-08-19", type: type,
                title: "T-\(id)", dist: dist, pace: "9:00/mi", estMinutes: nil,
                dur: nil, note: nil, sets: [], status: status)
    }

    @Test func buildsToDosFirstAndExcludesRest() {
        let snap = TodaySnapshot(day: "2026-08-19",
                                 workouts: [w("done1", status: "done"), w("rest1", type: "rest", dist: nil), w("todo1")])
        #expect(snap.entries.map(\.id) == ["todo1", "done1"])   // to-dos first, rest gone
        #expect(snap.nextUp?.id == "todo1")
        #expect(snap.doneCount == 1)
        #expect(snap.remainingCount == 1)
    }
    @Test func allDoneHasNoNextUp() {
        let snap = TodaySnapshot(day: "2026-08-19", workouts: [w("a", status: "done")])
        #expect(snap.nextUp == nil)
        #expect(snap.remainingCount == 0)
    }
    @Test func stalenessComparesDays() {
        let snap = TodaySnapshot(day: "2026-08-18", workouts: [])
        #expect(snap.isStale(today: "2026-08-19"))
        #expect(!snap.isStale(today: "2026-08-18"))
    }
    @Test func roundTripsThroughJSON() throws {
        let snap = TodaySnapshot(day: "2026-08-19", workouts: [w("a"), w("b", status: "done")])
        let data = try JSONEncoder().encode(snap)
        #expect(try JSONDecoder().decode(TodaySnapshot.self, from: data) == snap)
    }
}
