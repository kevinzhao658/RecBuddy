import Foundation
import Observation
import UserNotifications

/// App-facing wiring hub: owns the gateway + state, builds a coordinator per
/// athlete, requests notification permission at connect, and posts the
/// "Confirm your run/ride" local notification after a background pass.
@Observable @MainActor
final class HealthSyncService {
    let state = SyncState()
    /// True while a sync pass is running — drives the header sync badge.
    private(set) var isSyncing = false
    private let gateway = HealthKitGateway()
    private var coordinator: HealthSyncCoordinator?
    private var coordinatorAthleteId: String?
    /// The athlete the app is currently signed in as — observer wakes resolve
    /// against this at fire time, so an account switch never leaks the old id.
    private var activeAthleteId: String?
    private var observing = false

    /// One coordinator per signed-in athlete — rebuilt if a different athlete
    /// signs in (the sink is athlete-scoped; a stale one would write the
    /// previous athlete's rows).
    private func coordinator(for athleteId: String) -> HealthSyncCoordinator {
        if let coordinator, coordinatorAthleteId == athleteId { return coordinator }
        let c = HealthSyncCoordinator(provider: gateway, sink: SupabaseLogSink(athleteId: athleteId), state: state)
        coordinator = c
        coordinatorAthleteId = athleteId
        return c
    }

    /// Connect flow from Settings: HK read auth + notification permission,
    /// flip the toggle on, start observing, run a first pass.
    func connect(athleteId: String) async {
        try? await gateway.requestAuthorization()
        _ = try? await UNUserNotificationCenter.current()
            .requestAuthorization(options: [.alert, .badge, .sound])
        state.connected = true
        state.autoSyncEnabled = true
        await syncNow(athleteId: athleteId)
        startObservingIfNeeded(athleteId: athleteId)
    }

    /// One pass; from a background wake, notify if anything needs confirming.
    func syncNow(athleteId: String, background: Bool = false) async {
        activeAthleteId = athleteId
        isSyncing = true
        defer { isSyncing = false }
        let newPending = await coordinator(for: athleteId).sync()
        if background && newPending > 0 {
            let content = UNMutableNotificationContent()
            content.title = "RecBuddy"
            let kinds = Set(state.pending.map(\.sample.kind))
            content.body = kinds == [.cycling] ? "Confirm your ride" : "Confirm your run"
            try? await UNUserNotificationCenter.current().add(
                UNNotificationRequest(identifier: "health-confirm", content: content, trigger: nil))
        }
    }

    /// Register the HK observer once per launch (no-op until connected). The
    /// closure deliberately captures NO athlete id — it reads the current one
    /// when it fires.
    func startObservingIfNeeded(athleteId: String) {
        activeAthleteId = athleteId
        guard state.connected, state.autoSyncEnabled, !observing else { return }
        observing = true
        gateway.startObserving { [weak self] in
            await self?.observerFired()
        }
    }

    private func observerFired() async {
        guard let id = activeAthleteId else { return }
        await syncNow(athleteId: id, background: true)
    }

    func resolve(_ pendingId: String, _ r: HealthSyncCoordinator.Resolution) async throws {
        guard let coordinator else { return }
        try await coordinator.resolve(pendingId, r)
    }

    func exclude(sourceId: String) { state.exclude(sourceId) }
}
