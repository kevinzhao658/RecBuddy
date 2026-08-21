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
    @Test func intensityTintsRestored() {
        for t in ["speed", "tempo", "race"] { #expect(TypeBadge.tint(for: t) == .orange) }
        #expect(TypeBadge.tint(for: "long") == .blue)
        for t in ["rest", "other"] { #expect(TypeBadge.tint(for: t) == .secondary) }
        for t in ["easy", "recovery", "cross"] { #expect(TypeBadge.tint(for: t) == .green) }
    }
    @Test func unknownTypeFallsBackToRunner() {
        #expect(TypeBadge.symbol(for: "mystery") == "figure.run")
    }
}
