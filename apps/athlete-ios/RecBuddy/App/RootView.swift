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
            CoachJoinAsAthleteView()
        case .athlete(let profile):
            MainTabs(profile: profile)
        }
    }
}

/// A coach-only account signed into the athlete app. Dual-role: redeeming an
/// athlete invite code here grants the athlete role (roles add, never replace),
/// after which the tabs open like any athlete.
struct CoachJoinAsAthleteView: View {
    @Environment(SessionStore.self) private var session
    @State private var code = ""
    @State private var busy = false
    @State private var error: String?

    /// Show why an auto-redeem (queued from the signup wizard) failed, then
    /// clear it so the message doesn't reappear on the next visit.
    private func adoptRedeemNotice() {
        if let notice = session.redeemNotice {
            error = notice
            session.clearRedeemNotice()
        }
    }

    var body: some View {
        ZStack {
            RB.bg.ignoresSafeArea()
            VStack(spacing: 14) {
                Text("RecBuddy for athletes")
                    .font(.title2.bold())
                    .foregroundStyle(.white)
                Text("This account is a coach account — coaches use the web app. To train here too, redeem an invite code from your own coach.")
                    .multilineTextAlignment(.center)
                    .font(.subheadline)
                    .foregroundStyle(RB.textMute)

                TextField("Invite code", text: $code)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.white)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(RB.surface2)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(RB.line, lineWidth: 1))
                    .accessibilityLabel("Invite code")

                if let error {
                    Text(error).font(.footnote).foregroundStyle(.red)
                }

                Button(busy ? "Joining…" : "Join as an athlete") { Task { await join() } }
                    .buttonStyle(VoltButtonStyle())
                    .disabled(busy || code.trimmingCharacters(in: .whitespaces).isEmpty)

                Button("Sign out") { Task { await session.signOut() } }
                    .font(.footnote)
                    .foregroundStyle(RB.textMute)
            }
            .padding(32)
        }
        .onAppear { adoptRedeemNotice() }
    }

    private func join() async {
        busy = true; error = nil
        defer { busy = false }
        do {
            let trimmed = code.trimmingCharacters(in: .whitespaces).uppercased()
            try await Supa.shared.rpc("redeem_invite", params: ["p_code": trimmed]).execute()
            await session.refreshProfile()   // is_athlete now set → tabs open
        } catch {
            self.error = InviteErrors.friendly(error)
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
        .background(
            ZStack { // metal treatment: near-black base + ambient lime radial
                RB.bg
                RB.bgGlow
            }
            .ignoresSafeArea()
        )
    }
}

/// Floating capsule dock — modern/minimal: inactive tabs are bare icons, the
/// active tab is a sliding lime pill (spring matchedGeometryEffect) with label.
struct RBTabBar: View {
    @Binding var tab: Int
    @Namespace private var pill
    var body: some View {
        HStack(spacing: 4) {
            tabButton(0, icon: "calendar", label: "Calendar")
            tabButton(1, icon: "bubble.left", label: "Chat")
        }
        .padding(5)
        .background(RB.metalSurface2, in: Capsule())
        .overlay(Capsule().stroke(RB.line, lineWidth: 1))
        .shadow(color: .black.opacity(0.5), radius: 14, y: 6)
        .padding(.bottom, 8)
        .frame(maxWidth: .infinity) // centered, floating — content shows around it
    }
    private func tabButton(_ i: Int, icon: String, label: String) -> some View {
        Button {
            withAnimation(.spring(response: 0.32, dampingFraction: 0.82)) { tab = i }
        } label: {
            HStack(spacing: 6) {
                Image(systemName: icon).font(.system(size: 15, weight: .semibold))
                if tab == i {
                    Text(label).font(.footnote.weight(.semibold))
                        .transition(.opacity)
                }
            }
            .foregroundStyle(tab == i ? RB.onAccent : RB.textMute)
            .padding(.horizontal, tab == i ? 18 : 15)
            .padding(.vertical, 10)
            .background {
                if tab == i {
                    Capsule().fill(RB.accent)
                        .matchedGeometryEffect(id: "activePill", in: pill)
                        .shadow(color: RB.accent.opacity(0.35), radius: 10, y: 2)
                }
            }
            .contentShape(Capsule()) // inactive tab (no bg) stays tappable
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityAddTraits(tab == i ? .isSelected : [])
    }
}
