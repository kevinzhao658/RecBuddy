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
}
