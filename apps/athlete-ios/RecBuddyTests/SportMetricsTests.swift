import Testing
import Foundation
@testable import RecBuddy

@Suite struct SportMetricsTests {
    @Test func avgSpeedDerivesMphAndKmh() {
        #expect(SportMetrics.avgSpeedText(miles: 15.3, seconds: 3120, unit: .mi) == "17.7 mph")
        #expect(SportMetrics.avgSpeedText(miles: 15.3, seconds: 3120, unit: .km) == "28.4 km/h")
        #expect(SportMetrics.avgSpeedText(miles: 0, seconds: 3120, unit: .mi) == nil)
        #expect(SportMetrics.avgSpeedText(miles: 15.3, seconds: 0, unit: .mi) == nil)
    }

    @Test func swimPacePer100m() {
        // 1500 m in 26:15 (1575 s) -> 1:45 per 100 m.
        #expect(SportMetrics.swimPace100Text(miles: 1500 / 1609.344, seconds: 1575) == "1:45 /100m")
        #expect(SportMetrics.swimPace100Text(miles: 0, seconds: 1575) == nil)
    }

    @Test func metersRoundTrip() {
        #expect(SportMetrics.meters(fromMiles: 1500 / 1609.344) == 1500)
        #expect(SportMetrics.metersText(miles: 1500 / 1609.344) == "1,500 m")
        #expect(SportMetrics.miles(fromMeters: 1609.344) == 1.0)
    }

    @Test func swimActualsDisplayInMeters() throws {
        let json = """
        {"id":"a1","workout_id":null,"athlete_id":"u1","dist":0.93,"pace":null,
         "time":"26:15","hr":null,"feel":null,"note":null,"source":"apple_health",
         "source_id":"HK1","recorded_at":"2026-08-20T14:00:00+00:00","activity":"swim"}
        """.data(using: .utf8)!
        let a = try JSONDecoder().decode(WorkoutActual.self, from: json)
        #expect(a.distDisplay(unit: .mi) == "1,497 m")
    }
}
