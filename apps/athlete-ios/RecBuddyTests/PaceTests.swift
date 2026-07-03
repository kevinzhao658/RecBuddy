import Testing
import Foundation
@testable import RecBuddy

@Suite struct PaceTests {
    @Test func parsesPaceToSeconds() {
        #expect(Pace.toSeconds("7:30/mi") == 450)
        #expect(Pace.toSeconds("9:05/mi") == 545)
        #expect(Pace.toSeconds(nil) == nil)
        #expect(Pace.toSeconds("garbage") == nil)
    }
    @Test func formatsSecondsToCanonicalPace() {
        #expect(Pace.fromSeconds(450) == "7:30/mi")
        #expect(Pace.fromSeconds(545) == "9:05/mi")
        #expect(Pace.fromSeconds(-10) == "0:00/mi") // clamps at zero
    }
    @Test func derivesPaceFromDistanceAndTime() {
        // 5 mi in 45:00 -> 9:00/mi
        #expect(Pace.derive(miles: 5, totalSeconds: 2700) == "9:00/mi")
        #expect(Pace.derive(miles: 0, totalSeconds: 2700) == nil)
    }
}
