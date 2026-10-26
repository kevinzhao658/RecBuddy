import Testing
@testable import RecBuddy

@Suite struct ChatFollowupTests {
    @Test func inboxShowsAnErrorInsteadOfTheEmptyStateWhenLoadingFails() {
        #expect(InboxDisplay.state(loaded: false, error: nil, count: 0) == .loading)
        #expect(InboxDisplay.state(loaded: true, error: "Couldn't load chats.", count: 0) == .error)
        #expect(InboxDisplay.state(loaded: true, error: nil, count: 0) == .empty)
        #expect(InboxDisplay.state(loaded: true, error: "stale", count: 2) == .list)
    }

    @Test func replyIsOfferedOnlyWhereYouCanSend() {
        #expect(MessageMenu.showsReply(readOnly: false))
        #expect(!MessageMenu.showsReply(readOnly: true))
    }

    @Test func blockWordingDependsOnWhoIsBeingBlocked() {
        let coach = MessageMenu.blockMessage(name: "Marcus Hale", isCoach: true)
        #expect(coach.contains("removed from your team"))
        let athlete = MessageMenu.blockMessage(name: "Jordan Lee", isCoach: false)
        #expect(athlete == "Jordan Lee can't message you and you won't see their messages. Unblock anytime in Settings → Coaches.")
    }
}
