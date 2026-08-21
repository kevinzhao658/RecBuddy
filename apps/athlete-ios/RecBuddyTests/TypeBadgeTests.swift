import Testing
import SwiftUI
@testable import RecBuddy

@Suite struct TypeBadgeTests {
    @Test func crossIsCirclingArrowsNotABicycle() {
        #expect(TypeBadge.symbol(for: "cross") == "arrow.2.circlepath")
    }
    @Test func recoveryIsAPlainHeart() {
        #expect(TypeBadge.symbol(for: "recovery") == "heart")
    }
    @Test func everyTypeTintsAccent() {
        for t in ["easy", "long", "speed", "tempo", "recovery", "cross", "rest", "race", "other"] {
            #expect(TypeBadge.tint(for: t) == RB.accent)
        }
    }
    @Test func unknownTypeFallsBackToRunner() {
        #expect(TypeBadge.symbol(for: "mystery") == "figure.run")
    }
}
