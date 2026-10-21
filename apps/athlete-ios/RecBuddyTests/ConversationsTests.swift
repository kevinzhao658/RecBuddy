import Testing
import Foundation
@testable import RecBuddy

@Suite struct ConversationsTests {
    private func conversation(_ json: String) throws -> Conversation {
        try JSONDecoder().decode(Conversation.self, from: json.data(using: .utf8)!)
    }

    private func member(_ id: String, _ name: String) -> String {
        #"{"user_id":"\#(id)","name":"\#(name)","initials":"XX","avatar_url":null}"#
    }

    private func row(kind: String = "chat", title: String? = nil, members: [String], unread: Int = 0) -> String {
        let t = title.map { "\"\($0)\"" } ?? "null"
        return """
        {"thread_id":"t1","kind":"\(kind)","title":\(t),"team_athlete_id":null,
         "members":[\(members.joined(separator: ","))],"last_body":"See you at 7","last_kind":"text",
         "last_from":"u2","last_at":"2026-10-21T14:16:00+00:00","unread":\(unread),"read_only":false}
        """
    }

    @Test func decodesAnInboxRow() throws {
        let c = try conversation(row(members: [member("u2", "Dani Brooks")], unread: 3))
        #expect(c.id == "t1")
        #expect(c.isTeam == false)
        #expect(c.members.first?.name == "Dani Brooks")
        #expect(c.unread == 3)
        #expect(c.lastBody == "See you at 7")
        #expect(c.readOnly == false)
    }

    @Test func displayTitleRules() throws {
        #expect(try conversation(row(members: [member("a", "Dani Brooks")])).displayTitle == "Dani Brooks")
        #expect(try conversation(row(members: [member("a", "Dani Brooks"), member("b", "Marcus Hale")])).displayTitle == "Dani & Marcus")
        #expect(try conversation(row(members: [member("a", "Dani Brooks"), member("b", "Marcus Hale"), member("c", "Bea Lin")])).displayTitle
                == "Dani, Marcus & Bea")
        #expect(try conversation(row(title: "Long-run crew", members: [member("a", "Dani Brooks")])).displayTitle == "Long-run crew")
        #expect(try conversation(row(kind: "team", members: [])).displayTitle == "Team chat")
        #expect(try conversation(row(kind: "team", members: [member("a", "Dani Brooks"), member("b", "Marcus Hale")])).displayTitle
                == "Dani & Marcus")
    }

    @Test func reactionKindsAreCanonical() {
        #expect(ReactionKind.allCases.map(\.emoji) == ["👍", "‼️", "❓", "😂", "🎉"])
    }

    @Test func reactionSummary() throws {
        let json = """
        [{"message_id":"m1","user_id":"me","kind":"congrats"},
         {"message_id":"m1","user_id":"u2","kind":"like"},
         {"message_id":"m1","user_id":"u3","kind":"congrats"},
         {"message_id":"m1","user_id":"u4","kind":null},
         {"message_id":"m2","user_id":"u2","kind":"laugh"}]
        """
        let rs = try JSONDecoder().decode([Reaction].self, from: json.data(using: .utf8)!)
        #expect(ReactionSummary.badges(rs, messageId: "m1") == [.like, .congrats])  // canonical order, nulls ignored
        #expect(ReactionSummary.count(rs, messageId: "m1") == 3)
        #expect(ReactionSummary.mine(rs, messageId: "m1", me: "me") == .congrats)
        #expect(ReactionSummary.mine(rs, messageId: "m2", me: "me") == nil)
        let names = ReactionSummary.names(rs, messageId: "m1") { $0 == "me" ? "You" : $0 }
        #expect(names.map(\.name) == ["u2", "You", "u3"])  // grouped in canonical kind order
    }
}
