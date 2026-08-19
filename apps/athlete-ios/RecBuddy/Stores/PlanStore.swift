import Foundation
import Observation
import Supabase

/// The athlete's own plan + workouts, fetched per week (Mon..Sun window).
/// Mark-done goes through the mark_workout_status RPC (athlete-settable
/// 'done'/'planned'); logging inserts workout_actuals (source 'manual').
@Observable @MainActor
final class PlanStore {
    enum Phase: Equatable { case idle, loading, error(String) }
    private(set) var phase: Phase = .idle
    private(set) var workoutsByDate: [String: [Workout]] = [:]  // date -> that day's workouts (created_at order)
    private(set) var actualsByWorkout: [String: WorkoutActual] = [:]
    /// Off-plan "extra" runs/rides (workout_id null) for the displayed week,
    /// keyed by LOCAL day of recorded_at.
    private(set) var standaloneByDate: [String: [WorkoutActual]] = [:]
    private(set) var plan: Plan?
    private(set) var monthWorkouts: [String: [Workout]] = [:]
    var weekMonday: String = Week.mondayOf(Week.todayISO())

    var weekDates: [String] { Week.weekDates(mondayIso: weekMonday) }

    /// Run and ride volumes are tracked SEPARATELY so the gauge never mixes
    /// them: cross workouts (and ride actuals — pace == nil) are the ride
    /// side; every other non-rest type is the run side.
    var weekPlannedRunMiles: Double { plannedMiles(ride: false) }
    var weekPlannedRideMiles: Double { plannedMiles(ride: true) }
    var weekDoneRunMiles: Double { doneMiles(ride: false) }
    var weekDoneRideMiles: Double { doneMiles(ride: true) }
    /// Any ride volume this week? Drives the gauge's Run/Ride swap chip.
    var weekHasRideVolume: Bool { weekPlannedRideMiles > 0 || weekDoneRideMiles > 0 }

    private func plannedMiles(ride: Bool) -> Double {
        workoutsByDate.values.flatMap { $0 }
            .filter { $0.type != "rest" && (($0.type == "cross") == ride) }
            .compactMap(\.dist)
            .reduce(0, +)
    }

    /// ACTUAL miles completed: each done workout counts its logged actual's
    /// distance, bucketed by the log's kind (pace == nil -> ride); a workout
    /// marked complete WITHOUT a log falls back to its planned dist, bucketed
    /// by its type. Off-plan extras bucket by the same kind rule.
    private func doneMiles(ride: Bool) -> Double {
        let attached = workoutsByDate.values.flatMap { $0 }
            .filter { $0.status == "done" }
            .map { w -> Double in
                if let a = actualsByWorkout[w.id] { return ((a.pace == nil) == ride) ? a.dist : 0 }
                return ((w.type == "cross") == ride) ? (w.dist ?? 0) : 0
            }
            .reduce(0, +)
        let extras = standaloneByDate.values.flatMap { $0 }
            .filter { ($0.pace == nil) == ride }
            .map(\.dist)
            .reduce(0, +)
        return attached + extras
    }

    func goToWeek(offset: Int) async {
        weekMonday = Week.addDays(weekMonday, offset * 7)
        await refresh()
    }

    func refresh() async {
        phase = .loading
        do {
            // Fetch the athlete's plan once (RLS scopes to the signed-in athlete).
            // Plan is week-independent so we do this before the stale-week guard.
            if plan == nil {
                let plans: [Plan] = try await Supa.shared.from("plans")
                    .select().limit(1).execute().value
                if plan == nil { plan = plans.first }
            }

            let from = weekMonday
            let to = Week.addDays(weekMonday, 6)
            let workouts: [Workout] = try await Supa.shared.from("workouts")
                .select().gte("date", value: from).lte("date", value: to)
                .order("date").order("created_at").execute().value
            guard weekMonday == from else { return } // stale response — a newer week won
            workoutsByDate = Dictionary(grouping: workouts, by: \.date)
            let ids = workouts.map(\.id)
            if ids.isEmpty { actualsByWorkout = [:] }
            else {
                let actuals: [WorkoutActual] = try await Supa.shared.from("workout_actuals")
                    .select().in("workout_id", values: ids)
                    .order("recorded_at", ascending: false).execute().value
                guard weekMonday == from else { return } // stale response — a newer week won
                // Newest-first + keep-first: legacy duplicate rows resolve to the latest log.
                actualsByWorkout = Dictionary(
                    actuals.compactMap { a in a.workoutId.map { ($0, a) } },
                    uniquingKeysWith: { first, _ in first })
            }
            // Standalone extras: fetch a padded UTC range, bucket by local day.
            let padFrom = Week.addDays(from, -1) + "T00:00:00+00:00"
            let padTo = Week.addDays(to, 2) + "T00:00:00+00:00"
            let extras: [WorkoutActual] = try await Supa.shared.from("workout_actuals")
                .select().is("workout_id", value: nil)
                .gte("recorded_at", value: padFrom).lt("recorded_at", value: padTo)
                .order("recorded_at").execute().value
            guard weekMonday == from else { return } // stale response — a newer week won
            let wanted = Set(Week.weekDates(mondayIso: from))
            standaloneByDate = Dictionary(grouping: extras.filter { a in
                guard let ts = a.recordedAt, let day = Week.localDay(fromTimestamp: ts) else { return false }
                return wanted.contains(day)
            }, by: { Week.localDay(fromTimestamp: $0.recordedAt ?? "") ?? "" })
            phase = .idle
            publishTodaySnapshot()
        } catch {
            phase = .error("Couldn't load your plan. Pull to retry.")
        }
    }

    /// Fetch all workouts in the calendar grid for the month containing `anchor`.
    /// Updates monthWorkouts; silently ignores network errors (dots are best-effort).
    func loadMonth(anchor: String) async {
        let dates = Week.monthGridDates(anchor: anchor)
        guard let first = dates.first, let last = dates.last else { return }
        do {
            let workouts: [Workout] = try await Supa.shared.from("workouts")
                .select().gte("date", value: first).lte("date", value: last)
                .order("date").order("created_at").execute().value
            monthWorkouts = Dictionary(grouping: workouts, by: \.date)
        } catch {
            // Silently ignore — month grid dots are best-effort.
        }
    }

    /// Optimistic mark-done/undo via the mark_workout_status RPC; rolls back on failure.
    /// Uses explicit entry reassignment (not optional-chain mutation) so @Observable
    /// always sees the dictionary change and re-renders correctly.
    func setStatus(_ workout: Workout, to status: String) async throws {
        // Find the workout by ID within its day (a date can hold several now).
        let idx = workoutsByDate[workout.date]?.firstIndex { $0.id == workout.id }
        let old = idx.flatMap { workoutsByDate[workout.date]?[$0].status }
        // Explicit reassignment ensures @Observable tracks the dictionary write.
        if let idx, var day = workoutsByDate[workout.date] {
            day[idx].status = status
            workoutsByDate[workout.date] = day
        }
        publishTodaySnapshot()
        do {
            try await Supa.shared.rpc("mark_workout_status",
                params: ["p_workout_id": workout.id, "p_status": status]).execute()
        } catch {
            // Roll back optimistic update.
            if let old, var day = workoutsByDate[workout.date],
               let idx = day.firstIndex(where: { $0.id == workout.id }) {
                day[idx].status = old
                workoutsByDate[workout.date] = day
            }
            throw error
        }
    }

    /// Save a manual actual and mark the workout done. `pace` is optional so
    /// the extra-activity edit flow (rides have no pace) reuses updateRun.
    /// Sync writes go through SupabaseLogSink, not this method.
    func logRun(workout: Workout, dist: Double, time: String, pace: String?,
                hr: Int?, feel: Int?, note: String?) async throws {
        struct ExistingRow: Decodable { let id: String }
        let existing: [ExistingRow] = try await Supa.shared.from("workout_actuals")
            .select("id").eq("workout_id", value: workout.id).limit(1).execute().value
        if let row = existing.first {
            try await updateRun(actualId: row.id, dist: dist, time: time, pace: pace,
                                hr: hr, feel: feel, note: note)
        } else {
            struct NewActual: Encodable {
                let workout_id: String
                let athlete_id: String
                let dist: Double
                let pace: String?
                let time: String
                let hr: Int?
                let feel: Int?
                let note: String?
                let source: String
            }
            let row = NewActual(workout_id: workout.id, athlete_id: workout.athleteId,
                                dist: dist, pace: pace, time: time, hr: hr, feel: feel,
                                note: note, source: "manual")
            try await Supa.shared.from("workout_actuals").insert(row).execute()
        }
        do {
            try await setStatus(workout, to: "done")
        } catch {
            await refresh() // surface the saved actual even though mark-done failed
            throw error
        }
        await refresh()
    }

    func updateRun(actualId: String, dist: Double, time: String, pace: String?,
                   hr: Int?, feel: Int?, note: String?) async throws {
        let patch: [String: AnyJSON] = [
            "dist": .double(dist),
            "pace": pace.map { .string($0) } ?? .null,
            "time": .string(time),
            "hr": hr.map { .integer($0) } ?? .null,
            "feel": feel.map { .integer($0) } ?? .null,
            "note": note.map { .string($0) } ?? .null,
        ]
        try await Supa.shared.from("workout_actuals")
            .update(patch).eq("id", value: actualId).execute()
        await refresh()
    }

    /// Delete an actual row (used by the extra-card delete flow; the caller
    /// records the source_id in the excluded set so sync never re-imports it).
    func deleteActual(id: String) async throws {
        try await Supa.shared.from("workout_actuals").delete().eq("id", value: id).execute()
        await refresh()
    }

    /// Publish today's prescribed workouts to the widget. Only when the LOADED
    /// week contains today — browsing another week must never clobber the
    /// widget with an empty/wrong day.
    private func publishTodaySnapshot() {
        let today = Week.todayISO()
        guard weekDates.contains(today) else { return }
        TodaySnapshot(day: today, workouts: workoutsByDate[today] ?? []).write()
    }
}
