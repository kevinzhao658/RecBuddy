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
        #expect(ReactionSummary.mine(rs, messageId: "m1", me: "me") == [.congrats])
        #expect(ReactionSummary.mine(rs, messageId: "m2", me: "me").isEmpty)
        let names = ReactionSummary.names(rs, messageId: "m1") { $0 == "me" ? "You" : $0 }
        #expect(names.map(\.name) == ["u2", "You", "u3"])  // grouped in canonical kind order
    }

    @Test func previewLine() throws {
        func c(_ kind: String, from: String, body: String?, members: [String] = [], group: Bool = false) throws -> Conversation {
            let b = body.map { "\"\($0)\"" } ?? "null"
            let m = members.isEmpty ? [member("u2", "Dani Brooks")] : members
            let json = """
            {"thread_id":"t1","kind":"chat","title":\(group ? "\"Crew\"" : "null"),"team_athlete_id":null,
             "members":[\(m.joined(separator: ","))],"last_body":\(b),"last_kind":"\(kind)",
             "last_from":"\(from)","last_at":"2026-10-21T14:16:00+00:00","unread":0,"read_only":false}
            """
            return try conversation(json)
        }
        #expect(try c("text", from: "me", body: "On my way").previewLine(me: "me") == "You: On my way")
        #expect(try c("text", from: "u2", body: "Nice work").previewLine(me: "me") == "Nice work")
        #expect(try c("text", from: "u2", body: "Meet at 7", members: [member("u2", "Dani Brooks"), member("u3", "Bea Lin")], group: true)
                .previewLine(me: "me") == "Dani: Meet at 7")
        #expect(try c("image", from: "u2", body: nil).previewLine(me: "me") == "📷 Photo")
        #expect(try c("runcard", from: "me", body: nil).previewLine(me: "me") == "You: Logged a run")
        #expect(try c("workout", from: "u2", body: nil).previewLine(me: "me") == "Shared a workout")
        #expect(try conversation(row(members: [member("u2", "Dani Brooks")])).isEmptyPreview == false)
    }

    @Test func composeSelectionRules() throws {
        func person(_ id: String, _ kind: String) throws -> ChatPerson {
            try JSONDecoder().decode(ChatPerson.self, from: """
            {"user_id":"\(id)","name":"P \(id)","initials":"P","avatar_url":null,"person_kind":"\(kind)","context":"x"}
            """.data(using: .utf8)!)
        }
        var sel = ComposeSelection()
        #expect(sel.canSend == false)
        sel.toggle(try person("c1", "coach"))
        #expect(sel.isGroup == false)
        #expect(sel.canSend)
        sel.toggle(try person("a1", "athlete"))
        #expect(sel.isGroup)
        #expect(sel.showsAthleteNote == false)       // one athlete
        sel.toggle(try person("a2", "athlete"))
        #expect(sel.athleteCount == 2)
        #expect(sel.showsAthleteNote)
        sel.toggle(try person("a2", "athlete"))      // toggling again removes
        #expect(sel.people.map(\.userId) == ["c1", "a1"])
        #expect(sel.userIds == ["c1", "a1"])
        var mine = ComposeSelection(meIsAthlete: true)
        mine.toggle(try person("a9", "athlete"))
        #expect(mine.showsAthleteNote)               // me + one other athlete
    }
}

@MainActor @Suite struct BannerSuppressionTests {
    @Test func onlyTheOpenConversationIsSilenced() {
        let r = AppRouter()
        r.chatVisible = true
        #expect(r.showsBanner(forThread: "a"))          // inbox open, no conversation: banners show
        r.viewingThreadId = "a"
        #expect(r.showsBanner(forThread: "a") == false) // realtime paints it
        #expect(r.showsBanner(forThread: "b"))          // another conversation still alerts
        #expect(r.showsBanner(forThread: nil))
        r.chatVisible = false                           // switched to another tab
        #expect(r.showsBanner(forThread: "a"))
    }
}

@Suite struct ThreadPeopleTests {
    @Test func peopleListShowsOnlyCurrentMembersHeadCoachFirst() throws {
        let json = """
        [{"user_id":"me","name":"Maya Chen","initials":"MC","avatar_url":null,"title":null,"current":true},
         {"user_id":"a2","name":"Abe Gone","initials":"AG","avatar_url":null,"title":null,"current":false},
         {"user_id":"c2","name":"Bea Assistant","initials":"BA","avatar_url":null,"title":"Assistant","current":true},
         {"user_id":"c1","name":"Zed Head","initials":"ZH","avatar_url":null,"title":"Head Coach","current":true}]
        """
        let people = try JSONDecoder().decode([ThreadPerson].self, from: json.data(using: .utf8)!)
        #expect(people[1].isMember == false)
        #expect(ChatStore.currentPeople(people, me: "me", headCoach: "c1").map(\.userId) == ["c1", "c2"])
    }
}

@Suite struct MultiReactionTests {
    @Test func aPersonCanHoldSeveralKindsOneOfEach() throws {
        let json = """
        [{"message_id":"m1","user_id":"me","kind":"laugh","active":true},
         {"message_id":"m1","user_id":"me","kind":"question","active":true},
         {"message_id":"m1","user_id":"me","kind":"like","active":false},
         {"message_id":"m1","user_id":"u2","kind":"laugh","active":true}]
        """
        let rs = try JSONDecoder().decode([Reaction].self, from: json.data(using: .utf8)!)
        #expect(ReactionSummary.mine(rs, messageId: "m1", me: "me") == [.question, .laugh])   // canonical order
        #expect(ReactionSummary.badges(rs, messageId: "m1") == [.question, .laugh])
        #expect(ReactionSummary.count(rs, messageId: "m1") == 3)
    }
}
