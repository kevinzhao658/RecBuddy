import Foundation
import Observation

struct PendingCandidate: Codable, Equatable { let id: String; let title: String; let type: String }

/// An activity awaiting the athlete's decision (attach / keep as extra / dismiss).
struct PendingActivity: Codable, Equatable, Identifiable {
    let sample: ActivitySample
    let candidates: [PendingCandidate]   // that day's attachable workouts
    var id: String { sample.sourceId }
}

/// Per-provider persisted sync state (UserDefaults, keys namespaced by provider
/// from day one so Garmin/Coros get their own). Everything survives relaunch:
/// pending confirmations from a background wake are never lost, and excluded
/// ids (dismissed or deleted activities) are never re-imported.
@Observable @MainActor
final class SyncState {
    private let defaults: UserDefaults
    private let ns: String
    private let encoder: JSONEncoder = { let e = JSONEncoder(); e.dateEncodingStrategy = .iso8601; return e }()
    private let decoder: JSONDecoder = { let d = JSONDecoder(); d.dateDecodingStrategy = .iso8601; return d }()

    var connected: Bool { didSet { defaults.set(connected, forKey: ns + "connected") } }
    var autoSyncEnabled: Bool { didSet { defaults.set(autoSyncEnabled, forKey: ns + "autoSync") } }
    private(set) var lastSync: Date?
    private(set) var excludedSourceIds: Set<String>
    private(set) var pending: [PendingActivity]

    init(provider: String = "apple_health", defaults: UserDefaults = .standard) {
        self.defaults = defaults
        self.ns = "health.\(provider)."
        self.connected = defaults.bool(forKey: ns + "connected")
        self.autoSyncEnabled = defaults.bool(forKey: ns + "autoSync")
        self.lastSync = defaults.object(forKey: ns + "lastSync") as? Date
        self.excludedSourceIds = Set(defaults.stringArray(forKey: ns + "excluded") ?? [])
        if let data = defaults.data(forKey: ns + "pending"),
           let decoded = try? decoder.decode([PendingActivity].self, from: data) {
            self.pending = decoded
        } else {
            self.pending = []
        }
    }

    func exclude(_ sourceId: String) {
        excludedSourceIds.insert(sourceId)
        defaults.set(Array(excludedSourceIds), forKey: ns + "excluded")
    }
    func addPending(_ p: PendingActivity) {
        guard !pending.contains(where: { $0.id == p.id }) else { return }
        pending.append(p)
        persistPending()
    }
    func removePending(sourceId: String) {
        pending.removeAll { $0.id == sourceId }
        persistPending()
    }
    func markSynced(at date: Date) {
        lastSync = date
        defaults.set(date, forKey: ns + "lastSync")
    }
    private func persistPending() {
        defaults.set((try? encoder.encode(pending)) ?? Data(), forKey: ns + "pending")
    }
}
