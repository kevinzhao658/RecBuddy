import Foundation
import Testing
@testable import RecBuddy

@Suite struct WeekTests {
    @Test func addDaysAddsCalendarDays() {
        #expect(Week.addDays("2026-06-15", 7) == "2026-06-22")
    }
    @Test func mondayOfAWednesday() {
        #expect(Week.mondayOf("2026-06-17") == "2026-06-15") // 2026-06-15 is a Monday
    }
    @Test func weekDatesReturnsMonThroughSun() {
        let d = Week.weekDates(mondayIso: "2026-06-15")
        #expect(d.count == 7)
        #expect(d.first == "2026-06-15")
        #expect(d.last == "2026-06-21")
    }
    @Test func shortDateFormats() {
        #expect(Week.fmtShortDate("2026-08-23") == "Aug 23")
        #expect(Week.fmtShortDate(nil) == "")
    }
    @Test func todayISOIsLocalDate() {
        let expected = { () -> String in
            let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.timeZone = .current
            f.calendar = Calendar(identifier: .gregorian) // guard against device-calendar era years
            return f.string(from: Date())
        }()
        #expect(Week.todayISO() == expected)
    }
    @Test func mondayOfAMonday() {
        #expect(Week.mondayOf("2026-06-15") == "2026-06-15") // identity
    }
    @Test func mondayOfASunday() {
        #expect(Week.mondayOf("2026-06-21") == "2026-06-15") // crosses to prior Monday
    }
    @Test func dowLabels() {
        #expect(Week.DOW == ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"])
    }
    @Test func monthHelpers() {
        #expect(Week.firstOfMonth("2026-06-21") == "2026-06-01")
        #expect(Week.addMonths("2026-06-01", 1) == "2026-07-01")
        #expect(Week.addMonths("2026-01-01", -1) == "2025-12-01")
        #expect(Week.fmtMonthYear("2026-06-21") == "June 2026")
    }
    @Test func monthGridIsMonFirstWholeWeeks() {
        let grid = Week.monthGridDates(anchor: "2026-06-15") // June 1 2026 is a Monday
        #expect(grid.count % 7 == 0)
        #expect(grid.first == "2026-06-01")
        #expect(grid.contains("2026-06-30"))
        let july = Week.monthGridDates(anchor: "2026-07-10") // July 1 2026 is a Wednesday
        #expect(july.first == "2026-06-29")
        #expect(july.contains("2026-07-31"))
    }
}

@Suite struct BlockWeekTests {
    @Test func blockWeekCountsFromStartMonday() {
        #expect(Week.blockWeek(monday: "2026-06-29", start: "2026-06-29") == 1)
        #expect(Week.blockWeek(monday: "2026-06-29", start: "2026-07-01") == 1) // mid-week start -> same week
        #expect(Week.blockWeek(monday: "2026-07-06", start: "2026-06-29") == 2)
        #expect(Week.blockWeek(monday: "2026-06-22", start: "2026-06-29") == 0) // before the block
    }
    @Test func blockWeeksSpansStartThroughGoalWeek() {
        #expect(Week.blockWeeks(start: "2026-06-29", goal: "2026-09-20") == 12) // Sunday race, 12th week
        #expect(Week.blockWeeks(start: "2026-06-29", goal: "2026-06-30") == 1)
    }
}

@Suite struct LocalDayTests {
    @Test func localDayRoundTripsExactly() {
        // The UTC-parse bug rendered stored Nov 1 as "Oct 31" in DatePickers
        // west of Greenwich — local parse/format must round-trip the same day.
        for iso in ["2026-11-01", "2026-01-01", "2026-12-31", "2026-07-04"] {
            let d = Week.parseLocalDay(iso)
            #expect(d != nil)
            #expect(Week.formatLocalDay(d!) == iso)
        }
    }
    @Test func localDayRejectsMalformed() {
        #expect(Week.parseLocalDay("not-a-date") == nil)
    }
}
