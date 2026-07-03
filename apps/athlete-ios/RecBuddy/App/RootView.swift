import SwiftUI

struct RootView: View {
    @Environment(SessionStore.self) private var session

    var body: some View {
        switch session.state {
        case .loading:
            ProgressView()
        case .signedOut:
            AuthFlowView()
        case .wrongRole:
            VStack(spacing: 12) {
                Text("RecBuddy for athletes").font(.title2.bold())
                Text("This account is a coach account — coaches use the web app. Sign in with an athlete account.")
                    .multilineTextAlignment(.center).foregroundStyle(.secondary)
                Button("Sign out") { Task { await session.signOut() } }
            }
            .padding(32)
        case .athlete(let profile):
            MainTabs(profile: profile)
        }
    }
}

struct MainTabs: View {
    let profile: Profile
    var body: some View {
        TabView {
            CalendarView(profile: profile)
                .tabItem { Label("Calendar", systemImage: "calendar") }
            ChatView(profile: profile)
                .tabItem { Label("Chat", systemImage: "bubble.left.and.bubble.right") }
        }
    }
}
