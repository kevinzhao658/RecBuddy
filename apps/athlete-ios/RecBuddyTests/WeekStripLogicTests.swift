import Testing
import Foundation
@testable import RecBuddy

@Suite struct WeekStripLogicTests {
    let week = ["2026-08-17", "2026-08-18", "2026-08-19", "2026-08-20",
                "2026-08-21", "2026-08-22", "2026-08-23"]

    func workout(_ id: String, type: String = "easy", status: String = "planned") -> Workout {
        Workout(id: id, planId: "p", athleteId: "a", date: "2026-08-19", type: type,
                title: "W", dist: 5, pace: "9:00/mi", estMinutes: nil,
                dur: nil, note: nil, sets: [], status: status)
    }
    func extra(_ id: String) throws -> WorkoutActual {
        let json = """
        {"id":"\(id)","workout_id":null,"athlete_id":"a","dist":3.0,"pace":null,
         "time":"30:00","hr":null,"feel":null,"note":null,"source":"manual",
         "source_id":null,"recorded_at":"2026-08-19T16:00:00+00:00","activity":"ride"}
        """.data(using: .utf8)!
        return try JSONDecoder().decode(WorkoutActual.self, from: json)
    }

    @Test func selectsTodayWhenWeekContainsIt() {
        #expect(WeekStripLogic.defaultSelection(weekDates: week, today: "2026-08-19") == "2026-08-19")
    }
    @Test func selectsMondayWhenTodayOutsideWeek() {
        #expect(WeekStripLogic.defaultSelection(weekDates: week, today: "2026-09-01") == "2026-08-17")
    }
    @Test func rolloverLandsOnMondayForwardSundayBackward() {
        #expect(WeekStripLogic.rolloverLanding(forward: true, weekDates: week) == "2026-08-17")
        #expect(WeekStripLogic.rolloverLanding(forward: false, weekDates: week) == "2026-08-23")
    }
    @Test func emptyAndRestOnlyDaysHaveNoMarks() {
        #expect(WeekStripLogic.marks(workouts: [], extras: []) == .none)
        #expect(WeekStripLogic.marks(workouts: [workout("r", type: "rest")], extras: []) == .none)
    }
    @Test func allDoneCollapsesToCheck() throws {
        #expect(WeekStripLogic.marks(workouts: [workout("w1", status: "done")], extras: []) == .allDone)
        // Extras always count as done — an extras-only day is all-done too.
        #expect(try WeekStripLogic.marks(workouts: [], extras: [extra("x1")]) == .allDone)
    }
    @Test func mixedDaysShowPerWorkoutDots() throws {
        let m = try WeekStripLogic.marks(
            workouts: [workout("w1", status: "done"), workout("w2")], extras: [extra("x1")])
        #expect(m == .dots([true, false, true]))
    }
    @Test func dotsCapAtThree() {
        let ws = [workout("a"), workout("b"), workout("c"), workout("d", status: "done")]
        #expect(WeekStripLogic.marks(workouts: ws, extras: []) == .dots([false, false, false]))
    }
}
