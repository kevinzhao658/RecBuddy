import Testing
import Foundation
@testable import RecBuddy

@Suite @MainActor struct SyncStateTests {
    func freshDefaults() -> UserDefaults {
        let d = UserDefaults(suiteName: "SyncStateTests-\(UUID().uuidString)")!
        return d
    }
    func sample(_ id: String) -> ActivitySample {
        ActivitySample(sourceId: id, source: .appleHealth, startDate: Date(timeIntervalSince1970: 1_787_000_000),
                       distanceMeters: 8046.72, durationSeconds: 2700, avgHR: nil, kind: .running)
    }

    @Test func persistsToggleExclusionsAndPendingAcrossInstances() {
        let d = freshDefaults()
        let s1 = SyncState(defaults: d)
        s1.connected = true
        s1.autoSyncEnabled = true
        s1.exclude("hk-1")
        s1.addPending(PendingActivity(sample: sample("hk-2"),
                                      candidates: [PendingCandidate(id: "w1", title: "Easy Run", type: "easy")]))
        s1.markSynced(at: Date(timeIntervalSince1970: 1_787_000_000))

        let s2 = SyncState(defaults: d) // fresh instance = relaunch
        #expect(s2.connected == true)
        #expect(s2.autoSyncEnabled == true)
        #expect(s2.excludedSourceIds.contains("hk-1"))
        #expect(s2.pending.count == 1)
        #expect(s2.pending[0].candidates[0].title == "Easy Run")
        #expect(s2.lastSync == Date(timeIntervalSince1970: 1_787_000_000))
    }
    @Test func addPendingDedupsBySourceId() {
        let s = SyncState(defaults: freshDefaults())
        s.addPending(PendingActivity(sample: sample("hk-2"), candidates: []))
        s.addPending(PendingActivity(sample: sample("hk-2"), candidates: []))
        #expect(s.pending.count == 1)
    }
    @Test func removePendingRemoves() {
        let s = SyncState(defaults: freshDefaults())
        s.addPending(PendingActivity(sample: sample("hk-2"), candidates: []))
        s.removePending(sourceId: "hk-2")
        #expect(s.pending.isEmpty)
    }
}
