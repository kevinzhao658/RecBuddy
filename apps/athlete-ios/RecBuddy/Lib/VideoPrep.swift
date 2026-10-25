@preconcurrency import AVFoundation
import UIKit
import UniformTypeIdentifiers
import CoreTransferable

/// A clip ready to send: compressed to 720p .mp4 in a temp file, plus a JPEG
/// poster. `w`/`h` are the upright display size (the poster's).
struct PreparedVideo {
    let file: URL
    let poster: Data
    let posterImage: UIImage
    let w: Int
    let h: Int
    let duration: Int
}

extension VideoPrep {
    enum Refusal: Error { case tooLong, tooBig, unreadable }

    /// Check the length first (refuse over 60 s), then compress with the
    /// 1280x720 preset and grab a poster at 0.5 s.
    static func prepare(source: URL) async throws -> PreparedVideo {
        let asset = AVURLAsset(url: source)
        let seconds = try await asset.load(.duration).seconds
        guard seconds.isFinite else { throw Refusal.unreadable }
        if check(duration: seconds) != nil { throw Refusal.tooLong }

        let gen = AVAssetImageGenerator(asset: asset)
        gen.appliesPreferredTrackTransform = true
        gen.maximumSize = CGSize(width: 1280, height: 1280)
        let at = CMTime(seconds: min(0.5, seconds / 2), preferredTimescale: 600)
        let cg = try await gen.image(at: at).image
        guard let (poster, w, h) = ImageShrink.jpegForChat(UIImage(cgImage: cg)),
              let posterImage = UIImage(data: poster) else { throw Refusal.unreadable }

        let out = FileManager.default.temporaryDirectory.appendingPathComponent("\(UUID().uuidString).mp4")
        guard let session = AVAssetExportSession(asset: asset, presetName: AVAssetExportPreset1280x720) else {
            throw Refusal.unreadable
        }
        session.outputURL = out
        session.outputFileType = .mp4
        session.shouldOptimizeForNetworkUse = true
        await withCheckedContinuation { (done: CheckedContinuation<Void, Never>) in
            session.exportAsynchronously { done.resume() }
        }
        guard session.status == .completed else { throw session.error ?? Refusal.unreadable }
        let bytes = (try? out.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
        if checkSize(bytes: bytes) != nil {
            try? FileManager.default.removeItem(at: out)
            throw Refusal.tooBig
        }
        return PreparedVideo(file: out, poster: poster, posterImage: posterImage, w: w, h: h,
                             duration: Int(seconds.rounded()))
    }

    /// Write pasted or picked movie data to a temp file AVFoundation can open.
    static func tempFile(_ data: Data, type: UTType) throws -> URL {
        let ext = type.preferredFilenameExtension ?? "mov"
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("\(UUID().uuidString).\(ext)")
        try data.write(to: url)
        return url
    }
}

/// A movie from the Photos picker, copied to a temp file we own.
struct PickedMovie: Transferable {
    let url: URL
    static var transferRepresentation: some TransferRepresentation {
        FileRepresentation(contentType: .movie) { SentTransferredFile($0.url) } importing: { received in
            let ext = received.file.pathExtension.isEmpty ? "mov" : received.file.pathExtension
            let copy = FileManager.default.temporaryDirectory.appendingPathComponent("\(UUID().uuidString).\(ext)")
            try FileManager.default.copyItem(at: received.file, to: copy)
            return PickedMovie(url: copy)
        }
    }
}
