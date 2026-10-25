import Testing
import Foundation
@testable import RecBuddy

@Suite struct MessageTextTests {
    private func msg(_ kind: String, body: String? = nil, payload: String = "null") throws -> Message {
        let bodyJSON = body.map { "\"\($0)\"" } ?? "null"
        let json = """
        {"id":"m1","thread_id":"t1","from_user_id":"u1","kind":"\(kind)","body":\(bodyJSON),
         "payload":\(payload),"workout_id":null,"read":false,"created_at":"2026-10-18T10:00:00+00:00"}
        """.data(using: .utf8)!
        return try JSONDecoder().decode(Message.self, from: json)
    }

    @Test func copiesTextBody() throws {
        #expect(MessageText.copyText(try msg("text", body: "See you at 6"), unit: .mi) == "See you at 6")
    }

    @Test func copiesImageCaptionOrNothing() throws {
        #expect(MessageText.copyText(try msg("image", body: "Finish line!", payload: #"{"path":"t1/a.jpg","w":10,"h":10}"#), unit: .mi) == "Finish line!")
        #expect(MessageText.copyText(try msg("image", payload: #"{"path":"t1/a.jpg"}"#), unit: .mi) == nil)
    }

    @Test func copiesRunCardSummaryWithNote() throws {
        let m = try msg("runcard", payload: #"{"title":"Tempo 6 mi","dist":"6.0 mi","pace":"7:42","time":"46:12","hr":158,"note":"Felt strong"}"#)
        #expect(MessageText.copyText(m, unit: .mi) == "Tempo 6 mi — 6.0 mi · 7:42/mi · 46:12 · Avg HR 158\n\"Felt strong\"")
    }

    @Test func runCardSkipsMissingStats() throws {
        let m = try msg("runcard", payload: #"{"title":"Easy","dist":"4 mi"}"#)
        #expect(MessageText.copyText(m, unit: .mi) == "Easy — 4 mi")
    }

    @Test func copiesWorkoutInDisplayUnit() throws {
        let m = try msg("workout", payload: #"{"title":"Long Run","dist":10,"pace":"9:00","type":"long"}"#)
        #expect(MessageText.copyText(m, unit: .mi) == "Long Run — 10 mi · 9:00/mi")
        #expect(MessageText.copyText(m, unit: .km) == "Long Run — 16.1 km · 5:36/km")
    }

    @Test func copiesAdjustWithReason() throws {
        let m = try msg("adjust", payload: #"{"from":"6 × 800m","to":"4 × 1 mi","reason":"Ready for more"}"#)
        #expect(MessageText.copyText(m, unit: .mi) == "Workout adjusted: 6 × 800m → 4 × 1 mi\nReady for more")
    }

    @Test func quotePreviewIsOneLinePerKind() throws {
        #expect(MessageText.quotePreview(try msg("text", body: "Line one\\nline two"), unit: .mi) == "Line one line two")
        #expect(MessageText.quotePreview(try msg("image", payload: #"{"path":"x"}"#), unit: .mi) == "📷 Photo")
        #expect(MessageText.quotePreview(try msg("image", body: "Finish", payload: #"{"path":"x"}"#), unit: .mi) == "📷 Finish")
        #expect(MessageText.quotePreview(try msg("runcard", payload: #"{"title":"Tempo 6 mi","dist":"6 mi"}"#), unit: .mi) == "Logged run · Tempo 6 mi")
        #expect(MessageText.quotePreview(try msg("workout", payload: #"{"title":"Long Run","dist":10}"#), unit: .mi) == "Workout · Long Run")
        #expect(MessageText.quotePreview(try msg("adjust", payload: #"{"from":"a","to":"b"}"#), unit: .mi) == "Workout adjusted · b")
    }
}
