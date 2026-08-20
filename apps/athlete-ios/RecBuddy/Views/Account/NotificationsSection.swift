import SwiftUI

/// Athlete Settings > Notifications. ON = permission + APNs registration
/// (token upserts via AppDelegate callback). OFF = delete this device's token
/// row — the server simply has nowhere to push. State persists per device.
struct NotificationsSection: View {
    @AppStorage("pushEnabled") private var pushEnabled = false
    @State private var busy = false

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 12) {
                Image(systemName: "bell.badge.fill")
                    .foregroundStyle(RB.accent)
                    .frame(width: 34, height: 34)
                    .background(RB.surface2)
                    .clipShape(RoundedRectangle(cornerRadius: 9))
                VStack(alignment: .leading, spacing: 2) {
                    Text("Message notifications").font(.subheadline.weight(.semibold)).foregroundStyle(.white)
                    Text("Get a push when your coach messages you — reply right from the notification.")
                        .font(.caption).foregroundStyle(RB.textMute)
                }
                Spacer()
                Toggle("", isOn: Binding(
                    get: { pushEnabled },
                    set: { on in Task { await set(on) } }
                ))
                .labelsHidden()
                .tint(RB.accent)
                .disabled(busy)
                .accessibilityLabel("Message notifications")
            }
            Text("If notifications were denied, enable them in iOS Settings > Notifications > RecBuddy.")
                .font(.caption2).foregroundStyle(RB.textFaint)
        }
        .padding(14)
        .rbCard()
    }

    private func set(_ on: Bool) async {
        busy = true
        defer { busy = false }
        if on {
            pushEnabled = await PushRegistrar.enable()
        } else {
            await PushRegistrar.deleteToken()
            pushEnabled = false
        }
    }
}
