import SwiftUI
import AVKit

/// A chat video: poster, play glyph and length. The clip downloads to this
/// iPhone (VideoStore) as soon as the bubble appears, so it keeps playing after
/// the server deletes its copy at 7 days. With no copy here, an expired clip
/// shows its poster dimmed with "Video expired".
struct VideoBubble: View {
    let message: Message
    @State private var hasLocal = false
    @State private var posterURL: URL?
    @State private var player: PlayingVideo?
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
            .frame(width: size.width, height: size.height)
            .clipped()
            .overlay(alignment: .bottomTrailing) {
                Text(VideoText.duration(message.payloadInt("duration_s") ?? 0))
                    .font(.caption2.weight(.semibold).monospacedDigit())
                    .foregroundStyle(.white)
                    .padding(.horizontal, 5).padding(.vertical, 1)
                    .background(.black.opacity(0.6), in: RoundedRectangle(cornerRadius: 5))
                    .padding(6)
            }
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .contentShape(Rectangle())
            .onTapGesture { Task { await play() } }
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
        .fullScreenCover(item: $player) { PlayerView(url: $0.url).ignoresSafeArea() }
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
        if let url = VideoStore.shared.url(for: message.id) { player = PlayingVideo(url: url); return }
        hasLocal = false // e.g. cleared in Settings since this bubble appeared
        guard state == .remote, !loading else { return }
        loading = true
        failed = false
        let ok = await download()
        loading = false
        if ok, let url = VideoStore.shared.url(for: message.id) { player = PlayingVideo(url: url) } else { failed = true }
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

private struct PlayingVideo: Identifiable {
    let url: URL
    var id: URL { url }
}

/// Full-screen system player for a local file.
private struct PlayerView: UIViewControllerRepresentable {
    let url: URL
    func makeUIViewController(context: Context) -> AVPlayerViewController {
        let vc = AVPlayerViewController()
        vc.player = AVPlayer(url: url)
        vc.player?.play()
        return vc
    }
    func updateUIViewController(_ vc: AVPlayerViewController, context: Context) {}
}
