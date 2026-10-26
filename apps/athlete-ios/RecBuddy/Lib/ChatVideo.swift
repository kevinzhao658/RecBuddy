import CoreGraphics
import Foundation

/// Chat videos: the server keeps each clip for 7 days, and this iPhone keeps
/// its own copy (VideoStore) so a clip it has keeps playing. Mirrors coach-web
/// lib/videoExpiry.ts and lib/videoFile.ts.
enum VideoText {
    static let tooLong = "Videos can be up to 60 seconds."
    static let tooBig = "That video is too large to send. Try a shorter clip."
    static let sendFailed = "Couldn't send that video — try again."
    static let expired = "Video expired"
    static let loadFailed = "Couldn't load the video — tap to try again."

    /// "0:42", "1:00"
    static func duration(_ s: Int) -> String {
        let sec = max(0, s)
        return "\(sec / 60):" + String(format: "%02d", sec % 60)
    }

    /// A Postgres timestamp (any fractional precision; fractions are dropped).
    static func parse(_ iso: String) -> Date? {
        let trimmed = iso.replacingOccurrences(of: #"\.\d+"#, with: "", options: .regularExpression)
        return ISO8601DateFormatter().date(from: trimmed)
    }

    /// "Expires in 3 days" / "Expires in 1 day" / "Expires today"; nil once expired.
    static func expiry(expiresAt: Date, now: Date = Date()) -> String? {
        let left = expiresAt.timeIntervalSince(now)
        guard left > 0 else { return nil }
        let days = Int(left / 86_400)
        if days == 0 { return "Expires today" }
        return days == 1 ? "Expires in 1 day" : "Expires in \(days) days"
    }
}

enum VideoState: Equatable {
    case local, remote, expired
    /// A copy on this iPhone always plays; otherwise the server copy, while it lasts.
    static func of(hasLocal: Bool, purged: Bool, expired: Bool) -> VideoState {
        if hasLocal { return .local }
        return purged || expired ? .expired : .remote
    }
}

enum VideoPrep {
    static let maxSeconds: Double = 60
    /// The chat-videos bucket's upload limit.
    static let maxBytes = 50 * 1024 * 1024

    /// The refusal to show, or nil when the clip is short enough.
    static func check(duration: Double) -> String? {
        duration > maxSeconds ? VideoText.tooLong : nil
    }

    /// The refusal to show for a compressed clip the server would reject, or nil.
    /// (The 720p preset doesn't cap bitrate, so a busy 60 s clip can exceed it.)
    static func checkSize(bytes: Int) -> String? {
        bytes > maxBytes ? VideoText.tooBig : nil
    }
}

/// Sends a staged batch in order, taking each item off the tray as it goes, so
/// a retry after a mid-batch failure sends only what's left (no duplicates).
enum ComposerBatch {
    static func send<T>(_ items: [T], one: (T, Int) async throws -> Void, sent: (T) -> Void) async throws {
        for (i, item) in items.enumerated() {
            try await one(item, i)
            sent(item)
        }
    }
}

/// This iPhone's copies of chat videos, one file per message id, in
/// Application Support (not Caches, which iOS may empty under storage
/// pressure) and excluded from iCloud backup.
struct VideoStore {
    let root: URL

    static let shared: VideoStore = {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        return VideoStore(root: base.appendingPathComponent("ChatVideos", isDirectory: true))
    }()

    init(root: URL) { self.root = root }

    private func file(_ messageId: String) -> URL {
        // Message ids are UUIDs; anything else is reduced to a safe file name.
        let safe = messageId.filter { $0.isLetter || $0.isNumber || $0 == "-" }
        return root.appendingPathComponent("\(safe).mp4")
    }

    func url(for messageId: String) -> URL? {
        let f = file(messageId)
        return FileManager.default.fileExists(atPath: f.path) ? f : nil
    }

    func save(_ data: Data, messageId: String) throws {
        try ensureRoot()
        var f = file(messageId)
        try data.write(to: f, options: .atomic)
        try excludeFromBackup(&f)
    }

    /// Move an already-written file (e.g. the compressed clip just sent) into the store.
    func adopt(file source: URL, messageId: String) throws {
        try ensureRoot()
        var f = file(messageId)
        if FileManager.default.fileExists(atPath: f.path) { try FileManager.default.removeItem(at: f) }
        try FileManager.default.moveItem(at: source, to: f)
        try excludeFromBackup(&f)
    }

    func totalBytes() -> Int {
        let files = (try? FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: [.fileSizeKey])) ?? []
        return files.reduce(0) { $0 + ((try? $1.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0) }
    }

    func clear() throws {
        guard FileManager.default.fileExists(atPath: root.path) else { return }
        for f in try FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: nil) {
            try FileManager.default.removeItem(at: f)
        }
    }

    private func ensureRoot() throws {
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    }

    private func excludeFromBackup(_ f: inout URL) throws {
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try f.setResourceValues(values)
    }
}

/// Photo/video thumbnails: fit a w × h clip inside a box, never enlarged.
enum MediaFit {
    static func size(w: Int, h: Int, in box: CGSize) -> CGSize {
        let cw = CGFloat(max(w, 1)), ch = CGFloat(max(h, 1))
        let scale = min(box.width / cw, box.height / ch, 1)
        return CGSize(width: cw * scale, height: ch * scale)
    }
}
