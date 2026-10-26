import SwiftUI
import UIKit
import UniformTypeIdentifiers

/// The chat composer's text input. A UITextView instead of a SwiftUI TextField
/// because TextField can't accept pasted images: pasting a photo or video here
/// stages it as an attachment (onPasteImages / onPasteVideo), pasting text
/// behaves normally.
/// Grows from 1 to `maxLines` lines, then scrolls.
struct ComposerTextView: UIViewRepresentable {
    @Binding var text: String
    @Binding var isFocused: Bool
    var maxLines: Int = 4
    var onPasteImages: ([UIImage]) -> Void
    var onPasteVideo: (URL) -> Void = { _ in }

    func makeUIView(context: Context) -> PastingTextView {
        let tv = PastingTextView()
        tv.delegate = context.coordinator
        tv.font = .preferredFont(forTextStyle: .body)
        tv.adjustsFontForContentSizeCategory = true
        tv.textColor = .white
        tv.tintColor = UIColor(RB.accent)
        tv.backgroundColor = .clear
        tv.textContainerInset = .zero
        tv.textContainer.lineFragmentPadding = 0
        tv.isScrollEnabled = false
        tv.keyboardDismissMode = .interactive
        tv.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        tv.accessibilityLabel = "Message"
        tv.onPasteImages = { onPasteImages($0) }
        tv.onPasteVideo = { onPasteVideo($0) }
        return tv
    }

    func updateUIView(_ tv: PastingTextView, context: Context) {
        context.coordinator.parent = self
        tv.onPasteImages = { onPasteImages($0) }
        tv.onPasteVideo = { onPasteVideo($0) }
        if tv.text != text { tv.text = text }
        // Drive first-responder from the binding (async: avoids mutating
        // responder state during a SwiftUI update pass).
        if isFocused != tv.isFirstResponder {
            DispatchQueue.main.async {
                if isFocused { tv.becomeFirstResponder() } else { tv.resignFirstResponder() }
            }
        }
    }

    func sizeThatFits(_ proposal: ProposedViewSize, uiView tv: PastingTextView, context: Context) -> CGSize? {
        guard let width = proposal.width, width > 0, let font = tv.font else { return nil }
        let fit = tv.sizeThatFits(CGSize(width: width, height: .greatestFiniteMagnitude))
        let maxHeight = ceil(font.lineHeight * CGFloat(maxLines))
        let scrolls = fit.height > maxHeight
        if tv.isScrollEnabled != scrolls { tv.isScrollEnabled = scrolls }
        return CGSize(width: width, height: min(max(fit.height, ceil(font.lineHeight)), maxHeight))
    }

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, UITextViewDelegate {
        var parent: ComposerTextView
        init(_ parent: ComposerTextView) { self.parent = parent }

        func textViewDidChange(_ tv: UITextView) {
            parent.text = tv.text
        }
        func textViewDidBeginEditing(_ tv: UITextView) {
            if !parent.isFocused { parent.isFocused = true }
        }
        func textViewDidEndEditing(_ tv: UITextView) {
            if parent.isFocused { parent.isFocused = false }
        }
    }
}

/// UITextView whose Paste stages images and videos instead of dropping them.
final class PastingTextView: UITextView {
    var onPasteImages: (([UIImage]) -> Void)?
    var onPasteVideo: ((URL) -> Void)?

    /// Movie types we accept, most specific first.
    private static let movieTypes: [UTType] = [.mpeg4Movie, .quickTimeMovie, .movie]

    override func canPerformAction(_ action: Selector, withSender sender: Any?) -> Bool {
        // hasImages / contains(pasteboardTypes:) don't read the pasteboard, so
        // they never trigger the paste prompt.
        if action == #selector(paste(_:)),
           UIPasteboard.general.hasImages
            || UIPasteboard.general.contains(pasteboardTypes: Self.movieTypes.map(\.identifier)) { return true }
        return super.canPerformAction(action, withSender: sender)
    }

    override func paste(_ sender: Any?) {
        let pb = UIPasteboard.general
        for type in Self.movieTypes {
            if let data = pb.data(forPasteboardType: type.identifier),
               let url = try? VideoPrep.tempFile(data, type: type) {
                onPasteVideo?(url)
                return
            }
        }
        if pb.hasImages, let images = pb.images, !images.isEmpty {
            onPasteImages?(images)
            return
        }
        super.paste(sender)
    }
}
