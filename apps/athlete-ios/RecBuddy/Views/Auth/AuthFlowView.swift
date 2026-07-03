import SwiftUI

struct AuthFlowView: View {
    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                Spacer()
                Image(systemName: "bolt.fill").font(.system(size: 56)).foregroundStyle(.green)
                    .accessibilityHidden(true)
                Text("RecBuddy").font(.largeTitle.bold())
                Text("Your training plan, in your pocket.").foregroundStyle(.secondary)
                Spacer()
                NavigationLink("Sign in") { SignInView() }
                    .buttonStyle(.borderedProminent).controlSize(.large)
                NavigationLink("I have an invite code") { InviteFlowView() }
                    .buttonStyle(.bordered).controlSize(.large)
                Spacer().frame(height: 24)
            }
            .padding(24)
        }
    }
}
