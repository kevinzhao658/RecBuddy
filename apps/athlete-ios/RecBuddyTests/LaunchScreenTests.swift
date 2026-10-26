import Testing
import UIKit
@testable import RecBuddy

/// The launch screen is the still wordmark iOS shows before the app runs; the
/// Sprint splash then animates from that exact frame, so the two must match.
@Suite struct LaunchScreenTests {
    @Test func launchScreenShowsTheWordmarkOnTheAppBackground() throws {
        let launch = try #require(Bundle.main.object(forInfoDictionaryKey: "UILaunchScreen") as? [String: Any])
        #expect(launch["UIImageName"] as? String == "LaunchWordmark")
        #expect(launch["UIColorName"] as? String == "LaunchBackground")
        // Centered on the whole screen, like the splash's wordmark.
        #expect(launch["UIImageRespectsSafeAreaInsets"] as? Bool == false)
        #expect(UIImage(named: "LaunchWordmark") != nil)
    }

    @Test func launchBackgroundIsTheAppBackground() throws {
        let launch = try #require(UIColor(named: "LaunchBackground"))
        var (r1, g1, b1, a1): (CGFloat, CGFloat, CGFloat, CGFloat) = (0, 0, 0, 0)
        var (r2, g2, b2, a2): (CGFloat, CGFloat, CGFloat, CGFloat) = (0, 0, 0, 0)
        launch.getRed(&r1, green: &g1, blue: &b1, alpha: &a1)
        UIColor(RB.bg).getRed(&r2, green: &g2, blue: &b2, alpha: &a2)
        #expect(abs(r1 - r2) < 0.01 && abs(g1 - g2) < 0.01 && abs(b1 - b2) < 0.01)
    }

    @Test func splashStaysUntilSignInAndTheOpeningMoveAreBothDone() {
        #expect(SplashView.isShowing(loading: true, introDone: false))
        #expect(SplashView.isShowing(loading: true, introDone: true))   // slow sign-in: keep looping
        #expect(SplashView.isShowing(loading: false, introDone: false)) // fast sign-in: finish the lunge
        #expect(!SplashView.isShowing(loading: false, introDone: true))
    }
}
