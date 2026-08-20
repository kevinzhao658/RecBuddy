import Foundation
import Supabase

/// ActivityLogSink backed by Supabase directly — no dependence on PlanStore's
/// week cache, so a background wake can classify and write on its own. A
/// unique-violation on (athlete_id, source, source_id) means "already synced"
/// and is treated as success, not an error.
@MainActor
final class SupabaseLogSink: ActivityLogSink {
    private let athleteId: String
    init(athleteId: String) { self.athleteId = athleteId }

    func dayContext(_ day: String) async throws
        -> (workouts: [Workout], loggedWorkoutIds: Set<String>, knownSourceIds: Set<String>) {
        let workouts: [Workout] = try await Supa.shared.from("workouts")
            .select().eq("date", value: day).order("created_at").execute().value
        struct Row: Decodable { let workout_id: String?; let source_id: String? }
        var logged = Set<String>(), known = Set<String>()
        if !workouts.isEmpty {
            let rows: [Row] = try await Supa.shared.from("workout_actuals")
                .select("workout_id, source_id")
                .in("workout_id", values: workouts.map(\.id)).execute().value
            logged = Set(rows.compactMap(\.workout_id))
            known = Set(rows.compactMap(\.source_id))
        }
        // Standalone rows near this day (padded UTC window) also count as known.
        struct SRow: Decodable { let source_id: String? }
        let srows: [SRow] = try await Supa.shared.from("workout_actuals")
            .select("source_id").is("workout_id", value: nil)
            .gte("recorded_at", value: Week.addDays(day, -1) + "T00:00:00+00:00")
            .lt("recorded_at", value: Week.addDays(day, 2) + "T00:00:00+00:00")
            .execute().value
        known.formUnion(srows.compactMap(\.source_id))
        return (workouts, logged, known)
    }

    func logAttached(_ sample: ActivitySample, workoutId: String) async throws {
        struct NewActual: Encodable {
            let workout_id: String; let athlete_id: String; let dist: Double
            let pace: String?; let time: String; let hr: Int?
            let source: String; let source_id: String; let recorded_at: String
            let activity: String?
        }
        let pace = sample.kind == .running
            ? Pace.derive(miles: sample.miles, totalSeconds: sample.durationSeconds) : nil
        let row = NewActual(workout_id: workoutId, athlete_id: athleteId, dist: sample.miles,
                            pace: pace, time: Pace.timeString(fromSeconds: sample.durationSeconds),
                            hr: sample.avgHR, source: sample.source.rawValue,
                            source_id: sample.sourceId,
                            recorded_at: ISO8601DateFormatter().string(from: sample.startDate),
                            activity: sample.kind.activityString)
        do {
            try await Supa.shared.from("workout_actuals").insert(row).execute()
        } catch {
            // 23505 unique violation on the dedup index = already synced -> success.
            guard "\(error)".contains("23505") || "\(error)".contains("duplicate key") else { throw error }
        }
        try await Supa.shared.rpc("mark_workout_status",
            params: ["p_workout_id": workoutId, "p_status": "done"]).execute()
    }

    func logStandalone(_ sample: ActivitySample) async throws {
        struct NewStandalone: Encodable {
            let athlete_id: String; let dist: Double; let pace: String?
            let time: String; let hr: Int?; let source: String
            let source_id: String; let recorded_at: String
            let activity: String?
        }
        let pace = sample.kind == .running
            ? Pace.derive(miles: sample.miles, totalSeconds: sample.durationSeconds) : nil
        let row = NewStandalone(athlete_id: athleteId, dist: sample.miles, pace: pace,
                                time: Pace.timeString(fromSeconds: sample.durationSeconds),
                                hr: sample.avgHR, source: sample.source.rawValue,
                                source_id: sample.sourceId,
                                recorded_at: ISO8601DateFormatter().string(from: sample.startDate),
                                activity: sample.kind.activityString)
        do {
            try await Supa.shared.from("workout_actuals").insert(row).execute()
        } catch {
            guard "\(error)".contains("23505") || "\(error)".contains("duplicate key") else { throw error }
        }
    }
}
