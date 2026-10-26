import SwiftUI
import AVKit

/// A chat video: poster, play glyph and length; tapping plays it right in the
/// bubble, and the corner button continues it full screen. The clip downloads to this
/// iPhone (VideoStore) as soon as the bubble appears, so it keeps playing after
/// the server deletes its copy at 7 days. With no copy here, an expired clip
/// shows its poster dimmed with "Video expired".
struct VideoBubble: View {
    let message: Message
    @State private var hasLocal = false
    @State private var posterURL: URL?
    @State private var player: AVPlayer?
    @State private var fullScreen = false
    @State private var loading = false
    @State private var failed = false

    private var w: Int { message.payloadInt("w") ?? 16 }
    private var h: Int { message.payloadInt("h") ?? 9 }
    private var expiresAt: Date? { message.expiresAt.flatMap(VideoText.parse) }
    /// Fit the clip's shape inside 220 × 300 pt.
    private var size: CGSize {
        let ratio = CGFloat(max(w, 1)) / CGFloat(max(h, 1))
        let width = min(220, 300 * ratio)
        return CGSize(width: width, height: width / ratio)
    }
    private var state: VideoState {
        VideoState.of(hasLocal: hasLocal, purged: message.mediaPurgedAt != nil,
                      expired: expiresAt.map { $0 <= Date() } ?? false)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            ZStack {
                if let player {
                    InlineVideoView(player: player)
                } else {
                poster
                    .opacity(state == .expired ? 0.4 : 1)
                if state == .expired {
                    Text(VideoText.expired)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.white)
                } else if loading {
                    ProgressView()
                        .tint(.white)
                        .frame(width: 44, height: 44)
                        .background(.black.opacity(0.55), in: Circle())
                } else {
                    Image(systemName: "play.fill")
                        .font(.system(size: 18))
                        .foregroundStyle(.white)
                        .frame(width: 44, height: 44)
                        .background(.black.opacity(0.55), in: Circle())
                }
                }
            }
            .frame(width: size.width, height: size.height)
            .background(Color.black)
            .clipped()
            .overlay(alignment: .topTrailing) {
                if player != nil {
                    Button { fullScreen = true } label: {
                        Image(systemName: "arrow.up.left.and.arrow.down.right")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(.white)
                            .frame(width: 30, height: 30)
                            .background(.ultraThinMaterial, in: Circle())
                    }
                    .padding(6)
                    .accessibilityLabel("Full screen")
                }
            }
            .overlay(alignment: .bottomTrailing) {
                if player == nil {
                Text(VideoText.duration(message.payloadInt("duration_s") ?? 0))
                    .font(.caption2.weight(.semibold).monospacedDigit())
                    .foregroundStyle(.white)
                    .padding(.horizontal, 5).padding(.vertical, 1)
                    .background(.black.opacity(0.6), in: RoundedRectangle(cornerRadius: 5))
                    .padding(6)
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .contentShape(Rectangle())
            // Once playing, taps belong to the player's controls.
            .onTapGesture { if player == nil { Task { await play() } } }
            .accessibilityElement(children: .combine)
            .accessibilityLabel(state == .expired ? VideoText.expired : "Video, \(VideoText.duration(message.payloadInt("duration_s") ?? 0))")
            .accessibilityAddTraits(state == .expired ? [] : .isButton)

            if failed {
                Text(VideoText.loadFailed).font(.caption2).foregroundStyle(.red)
            } else if state == .remote, let expiresAt, let note = VideoText.expiry(expiresAt: expiresAt) {
                Text(note).font(.caption2).foregroundStyle(RB.textFaint)
            }
        }
        .task(id: message.id) { await load() }
        .onDisappear { if !fullScreen { player?.pause() } }   // scrolled away: stop the sound
        .fullScreenCover(isPresented: $fullScreen) {
            if let player {
                FullScreenPlayer(player: player)
                    .ignoresSafeArea()
                    .overlay(alignment: .topLeading) {
                        Button { fullScreen = false } label: {
                            Image(systemName: "xmark")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(.white)
                                .frame(width: 40, height: 40)
                                .background(.ultraThinMaterial, in: Circle())
                        }
                        .padding(.leading, 16)
                        .accessibilityLabel("Close full screen")
                    }
            }
        }
    }

    @ViewBuilder private var poster: some View {
        if let posterURL {
            AsyncImage(url: posterURL) { phase in
                if case .success(let img) = phase {
                    img.resizable().scaledToFill().frame(width: size.width, height: size.height).clipped()
                } else { RB.surface }
            }
        } else {
            RB.surface
        }
    }

    private func load() async {
        hasLocal = VideoStore.shared.url(for: message.id) != nil
        if let poster = message.payloadString("poster") {
            posterURL = try? await Supa.shared.storage.from("chat-images").createSignedURL(path: poster, expiresIn: 3600)
        }
        if state == .remote { _ = await download() } // a failure stays remote; tapping retries
    }

    /// Play the copy on this iPhone, downloading it first if needed (and retrying
    /// a download that failed earlier).
    private func play() async {
        if let url = VideoStore.shared.url(for: message.id) { start(url); return }
        hasLocal = false // e.g. cleared in Settings since this bubble appeared
        guard state == .remote, !loading else { return }
        loading = true
        failed = false
        let ok = await download()
        loading = false
        if ok, let url = VideoStore.shared.url(for: message.id) { start(url) } else { failed = true }
    }

    private func start(_ url: URL) {
        let p = AVPlayer(url: url)
        player = p
        p.play()
    }

    private func download() async -> Bool {
        guard let path = message.payloadString("path"),
              let url = try? await Supa.shared.storage.from("chat-videos").createSignedURL(path: path, expiresIn: 600),
              let (data, response) = try? await URLSession.shared.data(from: url),
              (response as? HTTPURLResponse)?.statusCode == 200 else { return false }
        try? VideoStore.shared.save(data, messageId: message.id)
        hasLocal = VideoStore.shared.url(for: message.id) != nil
        return hasLocal
    }
}

/// Full screen continues the bubble's playback (same AVPlayer, same spot).
/// Aspect-fit, so the whole frame shows, letterboxed, instead of zooming in
/// to fill the display.
struct FullScreenPlayer: UIViewControllerRepresentable {
    let player: AVPlayer

    static func configure(_ vc: AVPlayerViewController, player: AVPlayer) {
        vc.player = player
        vc.videoGravity = .resizeAspect
        vc.showsPlaybackControls = true
    }

    func makeUIViewController(context: Context) -> AVPlayerViewController {
        let vc = AVPlayerViewController()
        Self.configure(vc, player: player)
        return vc
    }
    func updateUIViewController(_ vc: AVPlayerViewController, context: Context) {}
}

/// The bubble's player: a plain video layer (the system player hides the status
/// bar while it plays, as if it were full screen). Tap to pause or resume; a
/// thin line shows progress; a finished clip restarts on tap.
struct InlineVideoView: View {
    let player: AVPlayer
    @State private var playing = true
    @State private var progress: Double = 0
    @State private var observer: Any?

    var body: some View {
        PlayerLayer(player: player)
            .overlay {
                if !playing {
                    Image(systemName: "play.fill")
                        .font(.system(size: 18))
                        .foregroundStyle(.white)
                        .frame(width: 44, height: 44)
                        .background(.black.opacity(0.55), in: Circle())
                }
            }
            .overlay(alignment: .bottom) {
                GeometryReader { g in
                    Capsule().fill(Color.white.opacity(0.9))
                        .frame(width: g.size.width * progress, height: 3)
                }
                .frame(height: 3)
                .background(Color.white.opacity(0.25))
            }
            .contentShape(Rectangle())
            .onTapGesture { toggle() }
            .accessibilityAddTraits(.isButton)
            .accessibilityLabel(playing ? "Pause video" : "Play video")
            .onAppear {
                observer = player.addPeriodicTimeObserver(forInterval: CMTime(value: 1, timescale: 10), queue: .main) { t in
                    let total = player.currentItem?.duration.seconds ?? 0
                    progress = total > 0 ? min(1, t.seconds / total) : 0
                    playing = player.rate != 0
                }
            }
            .onDisappear { if let observer { player.removeTimeObserver(observer) } }
            // Time updates stop at the end, so the finish needs its own signal.
            .onReceive(NotificationCenter.default.publisher(for: AVPlayerItem.didPlayToEndTimeNotification,
                                                            object: player.currentItem)) { _ in
                progress = 1
                playing = false
            }
    }

    private func toggle() {
        if player.rate != 0 { player.pause(); playing = false; return }
        if progress >= 0.999 { player.seek(to: .zero) }
        player.play(); playing = true
    }

    private struct PlayerLayer: UIViewRepresentable {
        let player: AVPlayer
        func makeUIView(context: Context) -> PlayerUIView {
            let v = PlayerUIView()
            v.attach(player)
            return v
        }
        func updateUIView(_ v: PlayerUIView, context: Context) {}
    }

    final class PlayerUIView: UIView {
        override static var layerClass: AnyClass { AVPlayerLayer.self }
        var playerLayer: AVPlayerLayer { layer as! AVPlayerLayer }
        /// Aspect-fit: the whole frame, never zoomed to fill.
        func attach(_ player: AVPlayer) {
            playerLayer.player = player
            playerLayer.videoGravity = .resizeAspect
            backgroundColor = .black
        }
    }
}
