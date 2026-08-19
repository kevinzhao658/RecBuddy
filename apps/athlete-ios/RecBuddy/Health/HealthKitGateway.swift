import Foundation
import HealthKit

/// The ONLY component that touches HKHealthStore. Maps HKWorkout -> the
/// provider-neutral ActivitySample. Safe on simulator: isHealthDataAvailable
/// guards every call.
final class HealthKitGateway: ActivityProvider {
    private let store = HKHealthStore()

    func requestAuthorization() async throws {
        guard HKHealthStore.isHealthDataAvailable() else { return }
        let read: Set<HKObjectType> = [
            HKObjectType.workoutType(),
            HKQuantityType(.heartRate),
            HKQuantityType(.distanceWalkingRunning),
            HKQuantityType(.distanceCycling),
        ]
        try await store.requestAuthorization(toShare: [], read: read)
    }

    func fetchActivities(since: Date) async throws -> [ActivitySample] {
        guard HKHealthStore.isHealthDataAvailable() else { return [] }
        let predicate = HKQuery.predicateForSamples(withStart: since, end: nil, options: .strictStartDate)
        let workouts: [HKWorkout] = try await withCheckedThrowingContinuation { cont in
            let q = HKSampleQuery(sampleType: .workoutType(), predicate: predicate, limit: HKObjectQueryNoLimit,
                                  sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)]) { _, samples, error in
                if let error { cont.resume(throwing: error) }
                else { cont.resume(returning: (samples as? [HKWorkout]) ?? []) }
            }
            store.execute(q)
        }
        return workouts.map { w in
            let kind: ActivityKind = switch w.workoutActivityType {
                case .running: .running
                case .cycling: .cycling
                default: .other
            }
            let distType: HKQuantityType = kind == .cycling
                ? HKQuantityType(.distanceCycling) : HKQuantityType(.distanceWalkingRunning)
            let meters = w.statistics(for: distType)?.sumQuantity()?
                .doubleValue(for: .meter()) ?? 0
            let hr = w.statistics(for: HKQuantityType(.heartRate))?.averageQuantity()?
                .doubleValue(for: HKUnit.count().unitDivided(by: .minute()))
            return ActivitySample(sourceId: w.uuid.uuidString, source: .appleHealth,
                                  startDate: w.startDate, distanceMeters: meters,
                                  durationSeconds: Int(w.duration.rounded()),
                                  avgHR: hr.map { Int($0.rounded()) }, kind: kind)
        }
    }

    func startObserving(_ onChange: @escaping () async -> Void) {
        guard HKHealthStore.isHealthDataAvailable() else { return }
        let q = HKObserverQuery(sampleType: .workoutType(), predicate: nil) { _, completion, _ in
            // ALWAYS complete, success or failure, so iOS keeps delivering.
            Task { await onChange(); completion() }
        }
        store.execute(q)
        store.enableBackgroundDelivery(for: .workoutType(), frequency: .immediate) { _, _ in }
    }
}
