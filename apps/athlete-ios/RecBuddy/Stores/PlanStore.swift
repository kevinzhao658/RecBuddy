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
    private(set) var workoutsByDate: [String: Workout] = [:]  // date -> workout (one per day)
    private(set) var actualsByWorkout: [String: WorkoutActual] = [:]
    var weekMonday: String = Week.mondayOf(Week.todayISO())

    var weekDates: [String] { Week.weekDates(mondayIso: weekMonday) }

    func goToWeek(offset: Int) async {
        weekMonday = Week.addDays(weekMonday, offset * 7)
        await refresh()
    }

    func refresh() async {
        phase = .loading
        do {
            let from = weekMonday
            let to = Week.addDays(weekMonday, 6)
            let workouts: [Workout] = try await Supa.shared.from("workouts")
                .select().gte("date", value: from).lte("date", value: to)
                .order("date").execute().value
            guard weekMonday == from else { return } // stale response — a newer week won
            workoutsByDate = Dictionary(uniqueKeysWithValues: workouts.map { ($0.date, $0) })
            let ids = workouts.map(\.id)
            if ids.isEmpty { actualsByWorkout = [:] }
            else {
                let actuals: [WorkoutActual] = try await Supa.shared.from("workout_actuals")
                    .select().in("workout_id", values: ids).execute().value
                guard weekMonday == from else { return } // stale response — a newer week won
                actualsByWorkout = Dictionary(uniqueKeysWithValues:
                    actuals.compactMap { a in a.workoutId.map { ($0, a) } })
            }
            phase = .idle
        } catch {
            phase = .error("Couldn't load your plan. Pull to retry.")
        }
    }

    /// Optimistic mark-done/undo via the mark_workout_status RPC; rolls back on failure.
    /// Uses explicit entry reassignment (not optional-chain mutation) so @Observable
    /// always sees the dictionary change and re-renders correctly.
    func setStatus(_ workout: Workout, to status: String) async throws {
        let old = workoutsByDate[workout.date]?.status
        // Explicit reassignment ensures @Observable tracks the dictionary write.
        if var w = workoutsByDate[workout.date] {
            w.status = status
            workoutsByDate[workout.date] = w
        }
        do {
            try await Supa.shared.rpc("mark_workout_status",
                params: ["p_workout_id": workout.id, "p_status": status]).execute()
        } catch {
            // Roll back optimistic update.
            if let old, var w = workoutsByDate[workout.date] {
                w.status = old
                workoutsByDate[workout.date] = w
            }
            throw error
        }
    }

    /// Insert a manual actual and mark the workout done. Pessimistic (caller shows
    /// busy state). Idempotent on retry: if an actual already exists for this
    /// workout (e.g. a prior attempt saved the row but mark-done failed), skip the
    /// insert and just complete the status step.
    func logRun(workout: Workout, dist: Double, time: String, pace: String, hr: Int?, feel: Int?) async throws {
        if actualsByWorkout[workout.id] == nil {
            struct NewActual: Encodable {
                let workout_id: String
                let athlete_id: String
                let dist: Double
                let pace: String
                let time: String
                let hr: Int?
                let feel: Int?
                let source: String
            }
            let row = NewActual(workout_id: workout.id, athlete_id: workout.athleteId,
                                dist: dist, pace: pace, time: time, hr: hr, feel: feel, source: "manual")
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
}
