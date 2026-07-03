import Testing
import Foundation
@testable import RecBuddy

@Suite struct EstMinutesTests {
    @Test func restIsZero() {
        #expect(EstMinutes.compute(type: "rest", estMinutes: nil, dist: nil, pace: nil, dur: nil) == 0)
    }
    @Test func usesExplicitOverride() {
        #expect(EstMinutes.compute(type: "easy", estMinutes: 40, dist: 5, pace: "9:00/mi", dur: nil) == 40)
    }
    @Test func computesDistTimesPace() {
        #expect(EstMinutes.compute(type: "easy", estMinutes: nil, dist: 5, pace: "9:00/mi", dur: nil) == 45)
    }
    @Test func fallsBackToDurThenCrossDefault() {
        #expect(EstMinutes.compute(type: "cross", estMinutes: nil, dist: nil, pace: nil, dur: 30) == 30)
        #expect(EstMinutes.compute(type: "cross", estMinutes: nil, dist: nil, pace: nil, dur: nil) == 45)
    }
}
