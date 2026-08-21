import Foundation

extension TodaySnapshot {
    /// Prescribed workouts only, to-dos first then completed (headliner order);
    /// rest-type workouts are not to-dos and never appear.
    init(day: String, workouts: [Workout]) {
        let real = workouts.filter { $0.type != "rest" }
        let ordered = real.filter { $0.status != "done" } + real.filter { $0.status == "done" }
        self.init(day: day, entries: ordered.map {
            Entry(id: $0.id, title: $0.title, type: $0.type, dist: $0.dist, done: $0.status == "done")
        })
    }
}
