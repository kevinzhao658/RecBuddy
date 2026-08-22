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

    /// Run and CROSS volumes are tracked SEPARATELY so the gauge never mixes
    /// them: whatever gets logged against a cross workout (bike, swim, even a
    /// run) counts toward cross totals, never run. Every other non-rest type
    /// is the run side. Cross has NO planned mileage — prescriptions are
    /// time-based and the athlete picks the sport, so the cross gauge shows
    /// done miles only.
    var weekPlannedRunMiles: Double { plannedRunMiles() }
    var weekDoneRunMiles: Double { doneMiles(cross: false) }
    var weekDoneCrossMiles: Double { doneMiles(cross: true) }
    /// Any cross this week — PRESCRIBED cross counts (the chip must appear
    /// before anything is logged), as does logged cross volume.
    var weekHasCrossVolume: Bool {
        weekDoneCrossMiles > 0
            || workoutsByDate.values.flatMap({ $0 }).contains { $0.type == "cross" }
    }

    /// Done CROSS miles split by declared sport — drives the color-coded
    /// segments in the cross mileage bar. Unlogged done cross workouts count
    /// as ride (the log sheet's default); run extras live on the run side.
    var weekCrossDoneBySport: (run: Double, ride: Double, swim: Double) {
        var run = 0.0, ride = 0.0, swim = 0.0
        for w in workoutsByDate.values.flatMap({ $0 }) {
            guard w.status == "done", w.type == "cross" else { continue }
            guard let a = actualsByWorkout[w.id] else { ride += w.dist ?? 0; continue }
            switch a.declaredActivity {
            case "swim": swim += a.dist
            case "run":  run += a.dist
            default:     ride += a.dist
            }
        }
        for a in standaloneByDate.values.flatMap({ $0 }) {
            switch a.declaredActivity {
            case "swim": swim += a.dist
            case "ride": ride += a.dist
            default:     break
            }
        }
        return (run, ride, swim)
    }

    private func plannedRunMiles() -> Double {
        workoutsByDate.values.flatMap { $0 }
            .filter { $0.type != "rest" && $0.type != "cross" }
            .compactMap(\.dist)
            .reduce(0, +)
    }

    /// ACTUAL miles completed: each done workout counts its logged actual's
    /// distance, bucketed by the WORKOUT'S type (cross -> cross side); a
    /// workout marked complete WITHOUT a log falls back to its planned dist,
    /// same bucketing. Off-plan extras bucket by their declared activity
    /// ('run' -> run; 'ride'/'swim' -> cross; legacy rows infer from pace).
    private func doneMiles(cross: Bool) -> Double {
        var total = 0.0
        for w in workoutsByDate.values.flatMap({ $0 }) {
            guard w.status == "done", (w.type == "cross") == cross else { continue }
            total += actualsByWorkout[w.id]?.dist ?? w.dist ?? 0
        }
        for a in standaloneByDate.values.flatMap({ $0 }) {
            let isCrossExtra = a.declaredActivity != "run"
            if isCrossExtra == cross { total += a.dist }
        }
        return total
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
        setMonthStatus(workoutId: workout.id, date: workout.date, to: status)
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
            if let old { setMonthStatus(workoutId: workout.id, date: workout.date, to: old) }
            publishTodaySnapshot()   // roll the widget back too
            throw error
        }
    }

    /// Mirror a status change into the month cache — it's fetched separately
    /// (loadMonth) and only refetches on month change, so without this an
    /// unmarked workout kept its ✓ in the month grid until the anchor moved.
    private func setMonthStatus(workoutId: String, date: String, to status: String) {
        guard var day = monthWorkouts[date],
              let idx = day.firstIndex(where: { $0.id == workoutId }) else { return }
        day[idx].status = status
        monthWorkouts[date] = day
    }

    /// Save a manual actual and mark the workout done. `pace` is optional so
    /// the extra-activity edit flow (rides have no pace) reuses updateRun.
    /// `activity` is the declared sport ('run'/'ride'/'swim') — athletes pick
    /// it when completing a cross workout. Sync writes go through
    /// SupabaseLogSink, not this method.
    func logRun(workout: Workout, dist: Double, time: String, pace: String?,
                hr: Int?, feel: Int?, note: String?, activity: String? = nil,
                avgWatts: Int? = nil) async throws {
        struct ExistingRow: Decodable { let id: String }
        let existing: [ExistingRow] = try await Supa.shared.from("workout_actuals")
            .select("id").eq("workout_id", value: workout.id).limit(1).execute().value
        if let row = existing.first {
            try await updateRun(actualId: row.id, dist: dist, time: time, pace: pace,
                                hr: hr, feel: feel, note: note, activity: activity,
                                avgWatts: avgWatts)
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
                let activity: String?
                let avg_watts: Int?
            }
            let row = NewActual(workout_id: workout.id, athlete_id: workout.athleteId,
                                dist: dist, pace: pace, time: time, hr: hr, feel: feel,
                                note: note, source: "manual", activity: activity,
                                avg_watts: avgWatts)
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
                   hr: Int?, feel: Int?, note: String?, activity: String? = nil,
                   avgWatts: Int? = nil) async throws {
        var patch: [String: AnyJSON] = [
            "dist": .double(dist),
            "pace": pace.map { .string($0) } ?? .null,
            "time": .string(time),
            "hr": hr.map { .integer($0) } ?? .null,
            "feel": feel.map { .integer($0) } ?? .null,
            "note": note.map { .string($0) } ?? .null,
        ]
        // Only write activity when declared — an edit that doesn't touch the
        // sport must not null out a previously declared one.
        if let activity { patch["activity"] = .string(activity) }
        // Watts is authoritative when the caller declared a ride (nil clears
        // it); other flows leave a synced value untouched.
        if activity == "ride" { patch["avg_watts"] = avgWatts.map { .integer($0) } ?? .null }
        else if let avgWatts { patch["avg_watts"] = .integer(avgWatts) }
        try await Supa.shared.from("workout_actuals")
            .update(patch).eq("id", value: actualId).execute()
        await refresh()
    }

    /// Insert an ADDITIONAL manual activity for a day as a standalone extra
    /// (workout_id null) — a cross day can hold more than one sport, and the
    /// second-and-later entries live beside the attached log as extras. The
    /// recorded_at is local noon of the workout's day so it always buckets
    /// onto that day. Caller refreshes when done.
    func logExtraActivity(athleteId: String, date: String, activity: String,
                          dist: Double, time: String, pace: String? = nil,
                          avgWatts: Int? = nil) async throws {
        struct NewExtra: Encodable {
            let athlete_id: String
            let dist: Double
            let pace: String?
            let time: String
            let source: String
            let recorded_at: String
            let activity: String?
            let avg_watts: Int?
        }
        let row = NewExtra(athlete_id: athleteId, dist: dist, pace: pace, time: time,
                           source: "manual", recorded_at: Week.localNoonTimestamp(date),
                           activity: activity, avg_watts: avgWatts)
        try await Supa.shared.from("workout_actuals").insert(row).execute()
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
