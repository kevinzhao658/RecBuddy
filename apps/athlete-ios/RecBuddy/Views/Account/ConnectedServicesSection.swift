import SwiftUI

/// Athlete Settings > Connected services. A LIST of providers (Apple Health is
/// the first; Garmin/Coros append here later). Each row: connection state +
/// the Auto-sync toggle. Toggle off = no foreground or background passes;
/// already-synced records are untouched.
struct ConnectedServicesSection: View {
    let athleteId: String
    @Environment(HealthSyncService.self) private var health
    @State private var connecting = false

    var body: some View {
        @Bindable var state = health.state
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 12) {
                Image(systemName: "heart.fill")
                    .foregroundStyle(RB.accent)
                    .frame(width: 34, height: 34)
                    .background(RB.surface2)
                    .clipShape(RoundedRectangle(cornerRadius: 9))
                VStack(alignment: .leading, spacing: 2) {
                    Text("Apple Health").font(.subheadline.weight(.semibold)).foregroundStyle(.white)
                    Text(health.state.connected ? connectedCaption : "Log runs & rides automatically")
                        .font(.caption).foregroundStyle(RB.textMute)
                }
                Spacer()
                if health.state.connected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(RB.accent)
                        .accessibilityLabel("Connected")
                } else {
                    Button(connecting ? "Connecting…" : "Connect") {
                        connecting = true
                        Task { await health.connect(athleteId: athleteId); connecting = false }
                    }
                    .font(.footnote.weight(.semibold)).foregroundStyle(RB.accent)
                    .disabled(connecting)
                }
            }
            if health.state.connected {
                Toggle("Auto-sync", isOn: $state.autoSyncEnabled)
                    .font(.subheadline).foregroundStyle(.white)
                    .tint(RB.accent)
                Text("If Health access was denied, enable it in iOS Settings > Privacy & Security > Health.")
                    .font(.caption2).foregroundStyle(RB.textFaint)
            }
        }
        .padding(14)
        .rbCard()
    }

    /// "Connected · Last synced 5 min. ago" once a pass has run.
    private var connectedCaption: String {
        guard let last = health.state.lastSync else { return "Connected" }
        let rel = RelativeDateTimeFormatter()
        rel.unitsStyle = .abbreviated
        return "Connected · Last synced \(rel.localizedString(for: last, relativeTo: Date()))"
    }
}
