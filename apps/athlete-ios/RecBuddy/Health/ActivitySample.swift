import Foundation

/// Provider-neutral activity value — the ONLY shape the matcher, coordinator,
/// confirm UI, and write paths ever see. Adding a provider (Garmin, Coros)
/// adds zero matching or UI logic.
enum ActivitySource: String, Codable { case appleHealth = "apple_health" }

enum ActivityKind: String, Codable {
    case running, cycling, swimming, other

    /// The workout_actuals.activity value for this kind; nil for unsupported.
    var activityString: String? {
        switch self {
        case .running:  return "run"
        case .cycling:  return "ride"
        case .swimming: return "swim"
        case .other:    return nil
        }
    }
    /// Display noun for confirm UI/notifications ("run"/"ride"/"swim").
    var noun: String { activityString ?? "activity" }
    /// SF Symbol for the kind.
    var symbol: String {
        switch self {
        case .cycling:  return "bicycle"
        case .swimming: return "figure.pool.swim"
        default:        return "figure.run"
        }
    }
}

struct ActivitySample: Codable, Equatable, Identifiable {
    let sourceId: String        // provider's stable id (HealthKit workout UUID)
    let source: ActivitySource
    let startDate: Date
    let distanceMeters: Double
    let durationSeconds: Int
    let avgHR: Int?
    let kind: ActivityKind
    /// Lap markers on the recording (nil when the provider doesn't expose
    /// them). A lap-rich copy is the one worth keeping when duplicates
    /// collapse — laps are what future segment analysis reads.
    let lapEventCount: Int?

    init(sourceId: String, source: ActivitySource, startDate: Date, distanceMeters: Double,
         durationSeconds: Int, avgHR: Int?, kind: ActivityKind, lapEventCount: Int? = nil) {
        self.sourceId = sourceId
        self.source = source
        self.startDate = startDate
        self.distanceMeters = distanceMeters
        self.durationSeconds = durationSeconds
        self.avgHR = avgHR
        self.kind = kind
        self.lapEventCount = lapEventCount
    }
    var id: String { sourceId }
    /// Canonical storage distance (miles, 2 dp).
    var miles: Double { (distanceMeters / 1609.344 * 100).rounded() / 100 }
    /// When the recording ended — drives overlap-based duplicate collapsing.
    var endDate: Date { startDate.addingTimeInterval(Double(durationSeconds)) }
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
