import WidgetKit
import SwiftUI

@main
struct RecBuddyWidgets: WidgetBundle {
    var body: some Widget { TodayWidget() }
}

struct TodayWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: TodaySnapshot.widgetKind, provider: TodayProvider()) { entry in
            TodayWidgetView(entry: entry)
                .containerBackground(for: .widget) { Color(red: 0.04, green: 0.047, blue: 0.03) }
        }
        .configurationDisplayName("Today's Plan")
        .description("Your prescribed workouts for the day.")
        .supportedFamilies([.accessoryRectangular, .systemSmall, .systemMedium])
    }
}

struct TodayEntry: TimelineEntry {
    let date: Date
    let snapshot: TodaySnapshot?
    let today: String     // local 'YYYY-MM-DD' AT THIS ENTRY's date
}

struct TodayProvider: TimelineProvider {
    private func day(of date: Date) -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: date)
    }

    func placeholder(in context: Context) -> TodayEntry {
        TodayEntry(date: .now, snapshot: .sample, today: TodayProvider.sampleDay)
    }
    func getSnapshot(in context: Context, completion: @escaping (TodayEntry) -> Void) {
        completion(TodayEntry(date: .now, snapshot: TodaySnapshot.load(), today: day(of: .now)))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<TodayEntry>) -> Void) {
        let now = Date()
        let snap = TodaySnapshot.load()
        // One entry now, one just past local midnight so "today" rolls over and
        // yesterday's list becomes the stale prompt without an app open.
        let midnight = Calendar.current.startOfDay(for: Calendar.current.date(byAdding: .day, value: 1, to: now)!)
        let entries = [
            TodayEntry(date: now, snapshot: snap, today: day(of: now)),
            TodayEntry(date: midnight.addingTimeInterval(60), snapshot: snap, today: day(of: midnight.addingTimeInterval(60))),
        ]
        completion(Timeline(entries: entries, policy: .atEnd))
    }

    static let sampleDay = "2026-08-19"
}

extension TodaySnapshot {
    /// Gallery preview data.
    static let sample = TodaySnapshot(day: TodayProvider.sampleDay, entries: [
        Entry(id: "1", title: "5 × 800m", type: "speed", dist: 6, done: false),
        Entry(id: "2", title: "Shakeout", type: "easy", dist: 3, done: true),
    ])
}
