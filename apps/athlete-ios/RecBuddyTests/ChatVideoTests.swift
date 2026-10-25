import Testing
import Foundation
import AVKit
@testable import RecBuddy

@Suite struct ChatVideoTests {
    private let now = Date(timeIntervalSince1970: 1_792_000_000)
    private func inHours(_ h: Double) -> Date { now.addingTimeInterval(h * 3600) }

    private func video(body: String? = nil, extra: String = "") throws -> Message {
        let bodyJSON = body.map { "\"\($0)\"" } ?? "null"
        let json = """
        {"id":"m1","thread_id":"t1","from_user_id":"u1","kind":"video","body":\(bodyJSON),
         "payload":{"path":"t1/v.mp4","poster":"t1/p.jpg","w":720,"h":1280,"duration_s":42},
         "workout_id":null,"read":false,"created_at":"2026-10-25T10:00:00+00:00"\(extra)}
        """.data(using: .utf8)!
        return try JSONDecoder().decode(Message.self, from: json)
    }

    @Test func formatsClipLength() {
        #expect(VideoText.duration(42) == "0:42")
        #expect(VideoText.duration(60) == "1:00")
        #expect(VideoText.duration(5) == "0:05")
    }

    @Test func expiryCountsWholeDaysThenToday() {
        #expect(VideoText.expiry(expiresAt: inHours(3 * 24 + 2), now: now) == "Expires in 3 days")
        #expect(VideoText.expiry(expiresAt: inHours(24 + 5), now: now) == "Expires in 1 day")
        #expect(VideoText.expiry(expiresAt: inHours(20), now: now) == "Expires today")
        #expect(VideoText.expiry(expiresAt: inHours(-1), now: now) == nil)
    }

    @Test func aLocalCopyAlwaysPlays() {
        #expect(VideoState.of(hasLocal: true, purged: true, expired: true) == .local)
        #expect(VideoState.of(hasLocal: false, purged: true, expired: true) == .expired)
        #expect(VideoState.of(hasLocal: false, purged: false, expired: true) == .expired)
        #expect(VideoState.of(hasLocal: false, purged: false, expired: false) == .remote)
    }

    @Test func refusesClipsOverSixtySeconds() {
        #expect(VideoPrep.check(duration: 61) == "Videos can be up to 60 seconds.")
        #expect(VideoPrep.check(duration: 60) == nil)
    }

    @Test func decodesExpiryFieldsAndHasNoCopy() throws {
        let m = try video(body: "Nice form", extra: #","expires_at":"2026-11-01T10:00:00+00:00","media_purged_at":null"#)
        #expect(m.expiresAt == "2026-11-01T10:00:00+00:00")
        #expect(m.mediaPurgedAt == nil)
        #expect(MessageText.copyText(m, unit: .mi) == nil)
        #expect(MessageText.quotePreview(m, unit: .mi) == "🎥 Nice form")
        #expect(MessageText.quotePreview(try video(), unit: .mi) == "🎥 Video")
    }

    @Test func inboxPreviewForAVideo() throws {
        func row(_ body: String?) -> String {
            let b = body.map { "\"\($0)\"" } ?? "null"
            return """
            {"thread_id":"t1","kind":"chat","title":null,"team_athlete_id":null,
             "members":[{"user_id":"u2","name":"Dani Brooks","initials":"DB","avatar_url":null}],
             "last_body":\(b),"last_kind":"video","last_from":"u2","last_at":"2026-10-21T14:16:00+00:00","unread":0,"read_only":false}
            """
        }
        let bare = try JSONDecoder().decode(Conversation.self, from: row(nil).data(using: .utf8)!)
        let captioned = try JSONDecoder().decode(Conversation.self, from: row("Nice form").data(using: .utf8)!)
        #expect(bare.previewLine(me: "me") == "🎥 Video")
        #expect(captioned.previewLine(me: "me") == "🎥 Nice form")
    }

    @Test func storeSavesFindsMeasuresAndClears() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        let store = VideoStore(root: root)
        #expect(store.url(for: "m1") == nil)
        try store.save(Data(repeating: 7, count: 1000), messageId: "m1")
        let url = try #require(store.url(for: "m1"))
        #expect(try url.resourceValues(forKeys: [.isExcludedFromBackupKey]).isExcludedFromBackup == true)
        #expect(store.totalBytes() == 1000)

        let temp = FileManager.default.temporaryDirectory.appendingPathComponent("\(UUID().uuidString).mp4")
        try Data(repeating: 1, count: 500).write(to: temp)
        try store.adopt(file: temp, messageId: "m2")
        #expect(store.url(for: "m2") != nil)
        #expect(store.totalBytes() == 1500)

        try store.clear()
        #expect(store.url(for: "m1") == nil)
        #expect(store.totalBytes() == 0)
    }

    @Test func parsesServerTimestamps() {
        #expect(VideoText.parse("2026-11-01T10:00:00+00:00") == Date(timeIntervalSince1970: 1_793_527_200))
        #expect(VideoText.parse("2026-11-01T10:00:00.250000+00:00") == Date(timeIntervalSince1970: 1_793_527_200)) // fractions dropped
        #expect(VideoText.parse("not a date") == nil)
    }

    @Test func refusesCompressedClipsOverTheUploadLimit() {
        #expect(VideoPrep.checkSize(bytes: 50 * 1024 * 1024 + 1) == "That video is too large to send. Try a shorter clip.")
        #expect(VideoPrep.checkSize(bytes: 50 * 1024 * 1024) == nil)
    }

    @Test func aFailedBatchKeepsOnlyTheUnsentPhotosForRetry() async {
        struct Boom: Error {}
        var sent: [String] = []
        var tried: [String] = []
        await #expect(throws: Boom.self) {
            try await ComposerBatch.send(["a", "b", "c"], one: { item, _ in
                tried.append(item)
                if item == "b" { throw Boom() }
            }, sent: { sent.append($0) })
        }
        #expect(tried == ["a", "b"])
        #expect(sent == ["a"])
    }

    @MainActor @Test func fullScreenShowsTheWholeFrameAndContinuesTheSamePlayback() {
        let player = AVPlayer(url: URL(fileURLWithPath: "/tmp/clip.mp4"))
        let vc = AVPlayerViewController()
        FullScreenPlayer.configure(vc, player: player)
        #expect(vc.videoGravity == .resizeAspect)   // letterboxed, never zoomed to fill
        #expect(vc.showsPlaybackControls)
        #expect(vc.player === player)               // same playback, same position
    }

    @MainActor @Test func theBubblePlaysOnAPlainLayerThatFitsTheFrame() {
        let player = AVPlayer(url: URL(fileURLWithPath: "/tmp/clip.mp4"))
        let view = InlineVideoView.PlayerUIView()
        view.attach(player)
        #expect(view.playerLayer.player === player)
        #expect(view.playerLayer.videoGravity == .resizeAspect)
    }

    @Test func mediaFitsItsBoxWithoutEnlarging() {
        #expect(MediaFit.size(w: 720, h: 1280, in: CGSize(width: 160, height: 220)) == CGSize(width: 123.75, height: 220))
        #expect(MediaFit.size(w: 1280, h: 720, in: CGSize(width: 160, height: 220)) == CGSize(width: 160, height: 90))
        #expect(MediaFit.size(w: 100, h: 80, in: CGSize(width: 160, height: 220)) == CGSize(width: 100, height: 80))
    }
}
