import Foundation

/// Provider-neutral activity value — the ONLY shape the matcher, coordinator,
/// confirm UI, and write paths ever see. Adding a provider (Garmin, Coros)
/// adds zero matching or UI logic.
enum ActivitySource: String, Codable { case appleHealth = "apple_health" }

enum ActivityKind: String, Codable { case running, cycling, other }

struct ActivitySample: Codable, Equatable, Identifiable {
    let sourceId: String        // provider's stable id (HealthKit workout UUID)
    let source: ActivitySource
    let startDate: Date
    let distanceMeters: Double
    let durationSeconds: Int
    let avgHR: Int?
    let kind: ActivityKind
    var id: String { sourceId }
    /// Canonical storage distance (miles, 2 dp).
    var miles: Double { (distanceMeters / 1609.344 * 100).rounded() / 100 }
}

/// One activity source. HealthKitGateway is the first implementation; tests
/// inject fakes; future providers slot in beside it.
protocol ActivityProvider {
    func requestAuthorization() async throws
    func fetchActivities(since: Date) async throws -> [ActivitySample]
    /// Register for change callbacks (HK observer + background delivery).
    /// The provider must call its own completion plumbing AFTER `onChange` returns.
    func startObserving(_ onChange: @escaping () async -> Void)
}
