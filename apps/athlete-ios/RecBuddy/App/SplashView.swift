import SwiftUI

/// The "Sprint" opening: shown while the session restores. It starts from the
/// exact frame of the launch screen (the wordmark centered on the full screen,
/// see LaunchWordmark), rocks back and lunges forward with speed lines, then a
/// sheen runs across the metal until the app is ready.
struct SplashView: View {
    /// Wordmark size; LaunchWordmark is rendered from this same size.
    static let wordmarkSize: CGFloat = 46
    /// Length of the opening move (every keyframe track ends by 0.85 s); the
    /// app is built only after this, since building it stalls animation frames.
    static let introSeconds = 0.9

    /// The splash stays while the session is loading, and also until the
    /// opening move has played once, so a fast sign-in never cuts it off.
    static func isShowing(loading: Bool, introDone: Bool) -> Bool { loading || !introDone }

    var onIntroDone: () -> Void = {}

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var started = false
    @State private var sheenX: CGFloat = -1

    private struct Pose {
        var x: CGFloat = 0
        var shear: CGFloat = 0           // added to the wordmark's own slant
        var streakScale: CGFloat = 0
        var streakOpacity: Double = 0
        var streakShift: CGFloat = 0
        var tagline: Double = 0
    }

    var body: some View {
        ZStack {
            RB.bg
            wordmark
        }
        .ignoresSafeArea() // centered on the whole screen, like the launch image
        .task {
            if reduceMotion {
                onIntroDone()
                return
            }
            started = true
            try? await Task.sleep(for: .seconds(Self.introSeconds))
            onIntroDone()
            withAnimation(.easeInOut(duration: 1.3).repeatForever(autoreverses: false)) { sheenX = 1 }
        }
    }

    private var wordmark: some View {
        Wordmark(size: Self.wordmarkSize)
            .overlay { sheen }
            .overlay(alignment: .leading) { streaks }
            .overlay(alignment: .bottom) { tagline }
            .keyframeAnimator(initialValue: Pose(), trigger: started) { content, p in
                content
                    .transformEffect(CGAffineTransform(a: 1, b: 0, c: p.shear, d: 1,
                                                       tx: -p.shear * Self.wordmarkSize / 2, ty: 0))
                    .offset(x: p.x)
                    .environment(\.splashPose, SplashPoseValue(p.streakScale, p.streakOpacity, p.streakShift, reduceMotion ? 1 : p.tagline))
            } keyframes: { _ in
                KeyframeTrack(\.x) {
                    CubicKeyframe(-15, duration: 0.21)
                    CubicKeyframe(12, duration: 0.21)
                    CubicKeyframe(0, duration: 0.28)
                }
                KeyframeTrack(\.shear) {
                    CubicKeyframe(0.07, duration: 0.21)   // leans back
                    CubicKeyframe(-0.14, duration: 0.21)  // drives forward
                    CubicKeyframe(0, duration: 0.28)
                }
                KeyframeTrack(\.streakScale) {
                    LinearKeyframe(0, duration: 0.22)
                    CubicKeyframe(1, duration: 0.22)
                }
                KeyframeTrack(\.streakOpacity) {
                    LinearKeyframe(0, duration: 0.22)
                    CubicKeyframe(0.9, duration: 0.22)
                    CubicKeyframe(0, duration: 0.33)
                }
                KeyframeTrack(\.streakShift) {
                    LinearKeyframe(0, duration: 0.44)
                    CubicKeyframe(-24, duration: 0.33)
                }
                KeyframeTrack(\.tagline) {
                    LinearKeyframe(0, duration: 0.45)
                    CubicKeyframe(1, duration: 0.4)
                }
            }
    }

    /// A light band that sweeps across the letters only.
    private var sheen: some View {
        GeometryReader { g in
            LinearGradient(stops: [.init(color: .clear, location: 0),
                                   .init(color: .white.opacity(0.9), location: 0.5),
                                   .init(color: .clear, location: 1)],
                           startPoint: .leading, endPoint: .trailing)
                .frame(width: g.size.width * 0.45)
                .offset(x: sheenX * g.size.width * 1.1 + g.size.width * 0.28)
        }
        .mask(Wordmark(size: Self.wordmarkSize, metal: false))
        .opacity(sheenX > -1 ? 1 : 0)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    private var streaks: some View { SpeedLines().accessibilityHidden(true) }

    private var tagline: some View {
        Tagline().alignmentGuide(.bottom) { d in d[.top] - 10 }
    }
}

// The keyframe pose reaches the overlays through the environment, so they
// animate without re-laying out the wordmark.
struct SplashPoseValue {
    var streakScale: CGFloat, streakOpacity: Double, streakShift: CGFloat, tagline: Double
    init(_ s: CGFloat = 0, _ o: Double = 0, _ x: CGFloat = 0, _ t: Double = 0) {
        streakScale = s; streakOpacity = o; streakShift = x; tagline = t
    }
}
private struct SplashPoseKey: EnvironmentKey { static let defaultValue = SplashPoseValue() }
extension EnvironmentValues {
    var splashPose: SplashPoseValue {
        get { self[SplashPoseKey.self] }
        set { self[SplashPoseKey.self] = newValue }
    }
}

private struct SpeedLines: View {
    @Environment(\.splashPose) private var pose
    var body: some View {
        VStack(alignment: .trailing, spacing: 10) {
            line(49); line(70); line(38)
        }
        .scaleEffect(x: pose.streakScale, y: 1, anchor: .trailing)
        .opacity(pose.streakOpacity)
        .offset(x: pose.streakShift)
        .alignmentGuide(.leading) { d in d[.trailing] + 6 } // trail off the wordmark's left edge
    }
    private func line(_ w: CGFloat) -> some View {
        Capsule()
            .fill(LinearGradient(colors: [.clear, RB.accent], startPoint: .leading, endPoint: .trailing))
            .frame(width: w, height: 3)
    }
}

private struct Tagline: View {
    @Environment(\.splashPose) private var pose
    var body: some View {
        Text("UNLEASH YOURSELF")
            .font(.caption)
            .kerning(3)
            .foregroundStyle(RB.textMute)
            .fixedSize()
            .opacity(pose.tagline)
    }
}

#Preview { SplashView() }
