import Testing
@testable import RecBuddy

@Suite struct MessageAvatarTests {
    // The avatar sits on the LAST message of a run, where the name caption is
    // hidden, so its initial must come from the sender, not the caption.
    @Test func avatarShowsTheSendersInitialEvenWithoutANameCaption() {
        #expect(MessageRow.avatarInitial(senderName: nil, avatarName: "Dani Brooks") == "D")
        #expect(MessageRow.avatarInitial(senderName: "Dani Brooks", avatarName: nil) == "D")
        #expect(MessageRow.avatarInitial(senderName: nil, avatarName: "  ") == nil)   // unknown → person icon
        #expect(MessageRow.avatarInitial(senderName: nil, avatarName: nil) == nil)
    }
}
