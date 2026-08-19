import Foundation
#if canImport(WidgetKit)
import WidgetKit
#endif

/// Snapshot of TODAY's prescribed workouts, shared with the widget through the
/// App Group container. Extras (off-plan synced activities) and rest days are
/// deliberately excluded — the widget is the day's to-do list, not the log.
struct TodaySnapshot: Codable, Equatable {
    static let appGroup = "group.app.recbuddy.athlete"
    static let key = "todaySnapshot"
    static let widgetKind = "TodayWidget"

    let day: String
    let entries: [Entry]

    struct Entry: Codable, Equatable, Identifiable {
        let id: String
        let title: String
        let type: String
        let dist: Double?
        let done: Bool
    }

    var nextUp: Entry? { entries.first { !$0.done } }
    var doneCount: Int { entries.filter(\.done).count }
    var remainingCount: Int { entries.filter { !$0.done }.count }
    func isStale(today: String) -> Bool { day != today }

    func write() {
        guard let d = UserDefaults(suiteName: Self.appGroup),
              let data = try? JSONEncoder().encode(self) else { return }
        d.set(data, forKey: Self.key)
        #if canImport(WidgetKit)
        WidgetCenter.shared.reloadTimelines(ofKind: Self.widgetKind)
        #endif
    }
    static func load() -> TodaySnapshot? {
        guard let d = UserDefaults(suiteName: Self.appGroup),
              let data = d.data(forKey: Self.key) else { return nil }
        return try? JSONDecoder().decode(TodaySnapshot.self, from: data)
    }
    static func clear() {
        UserDefaults(suiteName: Self.appGroup)?.removeObject(forKey: Self.key)
        #if canImport(WidgetKit)
        WidgetCenter.shared.reloadTimelines(ofKind: Self.widgetKind)
        #endif
    }
}
