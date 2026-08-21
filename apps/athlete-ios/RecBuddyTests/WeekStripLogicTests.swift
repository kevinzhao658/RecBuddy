import Testing
import Foundation
@testable import RecBuddy

@Suite struct WeekStripLogicTests {
    let week = ["2026-08-17", "2026-08-18", "2026-08-19", "2026-08-20",
                "2026-08-21", "2026-08-22", "2026-08-23"]

    func workout(_ id: String, type: String = "easy", status: String = "planned",
                 dist: Double? = 5, estMinutes: Int? = nil) -> Workout {
        Workout(id: id, planId: "p", athleteId: "a", date: "2026-08-19", type: type,
                title: "W", dist: dist, pace: dist != nil ? "9:00/mi" : nil,
                estMinutes: estMinutes, dur: nil, note: nil, sets: [], status: status)
    }
    func extra(_ id: String, dist: Double = 3.0, activity: String = "ride") throws -> WorkoutActual {
        let json = """
        {"id":"\(id)","workout_id":null,"athlete_id":"a","dist":\(dist),"pace":null,
         "time":"30:00","hr":null,"feel":null,"note":null,"source":"manual",
         "source_id":null,"recorded_at":"2026-08-19T16:00:00+00:00","activity":"\(activity)"}
        """.data(using: .utf8)!
        return try JSONDecoder().decode(WorkoutActual.self, from: json)
    }

    @Test func selectsTodayWhenWeekContainsIt() {
        #expect(WeekStripLogic.defaultSelection(weekDates: week, today: "2026-08-19") == "2026-08-19")
    }
    @Test func selectsMondayWhenTodayOutsideWeek() {
        #expect(WeekStripLogic.defaultSelection(weekDates: week, today: "2026-09-01") == "2026-08-17")
    }

    @Test func distanceWorkoutsCarryUnitSuffix() {
        let p = WeekStripLogic.pairs(workouts: [workout("w1", dist: 5)], extras: [], unit: .mi)
        #expect(p == [GlancePair(icon: .type("easy"), text: "5.0 mi")])
    }
    @Test func timeOnlyWorkoutsUseApostropheMinutes() {
        let w = workout("c1", type: "cross", dist: nil, estMinutes: 45)
        #expect(WeekStripLogic.pairs(workouts: [w], extras: [], unit: .mi)
                == [GlancePair(icon: .type("cross"), text: "45'")])
    }
    @Test func noTargetMeansIconOnly() {
        let w = workout("c1", type: "cross", dist: nil, estMinutes: nil)
        #expect(WeekStripLogic.pairs(workouts: [w], extras: [], unit: .mi)
                == [GlancePair(icon: .type("cross"), text: nil)])
    }
    @Test func restWorkoutsAreExcludedFromPairs() {
        #expect(WeekStripLogic.pairs(workouts: [workout("r", type: "rest")], extras: [], unit: .mi).isEmpty)
    }
    @Test func extrasFollowPlannedAndSwimsReadMeters() throws {
        let p = try WeekStripLogic.pairs(
            workouts: [workout("w1", dist: 4)],
            extras: [extra("x1", dist: 12.4, activity: "ride"),
                     extra("x2", dist: 1500 / 1609.344, activity: "swim")],
            unit: .mi)
        #expect(p == [GlancePair(icon: .type("easy"), text: "4.0 mi"),
                      GlancePair(icon: .sport("ride"), text: "12.4 mi"),
                      GlancePair(icon: .sport("swim"), text: "1500m")])
    }
    @Test func restOnlyFlag() {
        #expect(WeekStripLogic.isRestOnly(workouts: [workout("r", type: "rest")], extras: []))
        #expect(!WeekStripLogic.isRestOnly(workouts: [], extras: []))
        #expect(!WeekStripLogic.isRestOnly(workouts: [workout("r", type: "rest"), workout("w")], extras: []))
    }
}
