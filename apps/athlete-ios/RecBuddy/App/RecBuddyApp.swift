import SwiftUI

@main
struct RecBuddyApp: App {
    @State private var session = SessionStore()
    @State private var health = HealthSyncService()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(session)
                .environment(health)
                .task { await session.start() }
                .preferredColorScheme(.dark)
                .tint(RB.accent)
                // recbuddy:// just foregrounds the app; session comes from normal sign-in (v1)
                .onOpenURL { _ in }
        }
    }
}
