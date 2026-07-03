import Testing
import Foundation
@testable import RecBuddy

@Suite struct UnitsTests {
    @Test func milesIsTheIdentityUnit() {
        #expect(Units.fromMiles(6, .mi) == 6)
        #expect(Units.toMiles(6, .mi) == 6)
        #expect(Units.fmtDist(6, .mi) == "6")
        #expect(Units.fmtDist(4.5, .mi) == "4.5")
        #expect(Units.fmtPace("8:30/mi", .mi) == "8:30/mi")
    }
    @Test func kmConversionForDistanceAndPace() {
        #expect(Units.fmtDist(10, .km) == "16.1")          // 10 * 1.609344
        #expect(Units.fmtPace("8:30/mi", .km) == "5:17/km") // 510s/mi -> ~317s/km
        #expect((Units.toMiles(16.1, .km)).rounded() == 10)
    }
    @Test func nilInputsFormatToEmpty() {
        #expect(Units.fmtDist(nil, .km) == "")
        #expect(Units.fmtPace(nil, .km) == "")
    }
}
