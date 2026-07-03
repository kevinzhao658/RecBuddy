import SwiftUI

@main
struct RecBuddyApp: App {
    @State private var session = SessionStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(session)
                .task { await session.start() }
                .preferredColorScheme(.dark)
                .tint(RB.accent)
        }
    }
}
