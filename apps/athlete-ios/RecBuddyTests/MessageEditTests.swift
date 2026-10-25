import Testing
import Foundation
@testable import RecBuddy

@Suite struct MessageEditTests {
    @Test func youCanEditYourOwnTextAndCaptionsButNotCards() {
        #expect(MessageMenu.showsEdit(kind: "text", mine: true, readOnly: false))
        #expect(MessageMenu.showsEdit(kind: "image", mine: true, readOnly: false))
        #expect(MessageMenu.showsEdit(kind: "video", mine: true, readOnly: false))
        #expect(!MessageMenu.showsEdit(kind: "runcard", mine: true, readOnly: false))
        #expect(!MessageMenu.showsEdit(kind: "text", mine: false, readOnly: false))
        #expect(!MessageMenu.showsEdit(kind: "text", mine: true, readOnly: true))
    }

    @Test func youCanDeleteOnlyYourOwnMessages() {
        #expect(MessageMenu.showsDelete(mine: true))
        #expect(!MessageMenu.showsDelete(mine: false))
    }

    @Test func aTextEditNeedsWordsButACaptionCanBeCleared() {
        #expect(!MessageMenu.canSaveEdit(kind: "text", draft: "   "))
        #expect(MessageMenu.canSaveEdit(kind: "text", draft: "fixed"))
        #expect(MessageMenu.canSaveEdit(kind: "image", draft: ""))
    }

    @Test func decodesWhenAMessageWasEdited() throws {
        let json = """
        {"id":"m1","thread_id":"t1","from_user_id":"u1","kind":"text","body":"fixed","payload":null,
         "workout_id":null,"read":false,"created_at":"2026-10-25T10:00:00+00:00","edited_at":"2026-10-25T10:05:00+00:00"}
        """.data(using: .utf8)!
        let m = try JSONDecoder().decode(Message.self, from: json)
        #expect(m.editedAt == "2026-10-25T10:05:00+00:00")
    }
}
