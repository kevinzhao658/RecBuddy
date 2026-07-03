import SwiftUI

struct RootView: View {
    @Environment(SessionStore.self) private var session

    var body: some View {
        switch session.state {
        case .loading:
            ProgressView()
        case .networkError:
            VStack(spacing: 12) {
                Image(systemName: "wifi.exclamationmark").font(.largeTitle).foregroundStyle(.secondary)
                Text("Can't reach the server").font(.headline)
                Button("Retry") { Task { await session.refreshProfile() } }
                Button("Sign out") { Task { await session.signOut() } }
                    .font(.footnote).foregroundStyle(.secondary)
            }
            .padding(32)
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
    @State private var tab = 0
    var body: some View {
        // Both tabs stay ALIVE (opacity toggle, not if/else): switching is
        // instant — no refetch, and the chat's realtime subscription persists.
        ZStack {
            CalendarView(profile: profile)
                .opacity(tab == 0 ? 1 : 0)
                .allowsHitTesting(tab == 0)
                .accessibilityHidden(tab != 0)
            ChatView(profile: profile)
                .opacity(tab == 1 ? 1 : 0)
                .allowsHitTesting(tab == 1)
                .accessibilityHidden(tab != 1)
        }
        .safeAreaInset(edge: .bottom) { RBTabBar(tab: $tab) }
        .background(RB.bg.ignoresSafeArea())
    }
}

struct RBTabBar: View {
    @Binding var tab: Int
    var body: some View {
        HStack(spacing: 12) {
            tabButton(0, icon: "calendar", label: "Calendar")
            tabButton(1, icon: "bubble.left", label: "Chat")
        }
        .padding(.horizontal, 16).padding(.vertical, 10)
        .background(RB.bg.opacity(0.94))
        .overlay(Rectangle().fill(RB.line).frame(height: 1), alignment: .top)
    }
    private func tabButton(_ i: Int, icon: String, label: String) -> some View {
        Button {
            tab = i
        } label: {
            HStack(spacing: 7) {
                Image(systemName: icon)
                Text(label).font(.subheadline.weight(.semibold))
            }
            .foregroundStyle(tab == i ? RB.accent : RB.textMute)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 11)
            .background(tab == i ? RB.accent.opacity(0.14) : .clear)
            .clipShape(Capsule())
            .contentShape(Capsule()) // inactive tab (clear bg) stays tappable
        }
        .accessibilityLabel(label)
        .accessibilityAddTraits(tab == i ? .isSelected : [])
    }
}
