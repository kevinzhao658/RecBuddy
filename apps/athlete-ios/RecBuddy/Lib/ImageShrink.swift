import UIKit

/// Client-side image compression before uploading to chat-images bucket.
/// Mirrors the web compressImage.ts pipeline: scale to max 1280 px on the
/// long edge, then encode as JPEG at 0.7 quality.
enum ImageShrink {
    static func jpegForChat(_ ui: UIImage) -> (data: Data, w: Int, h: Int)? {
        let max: CGFloat = 1280
        let size = ui.size
        let scale = min(1, max / Swift.max(size.width, size.height))
        let w = Int((size.width  * scale).rounded())
        let h = Int((size.height * scale).rounded())
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: w, height: h))
        let scaled = renderer.image { _ in
            ui.draw(in: CGRect(origin: .zero, size: CGSize(width: w, height: h)))
        }
        guard let data = scaled.jpegData(compressionQuality: 0.7) else { return nil }
        return (data, w, h)
    }
}
