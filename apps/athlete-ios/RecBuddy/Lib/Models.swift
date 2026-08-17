import Foundation

/// Rows mirroring the shared Supabase schema (see coach-web lib/types.ts).
/// Enums stay Strings (matching the web) — exhaustive Swift enums would break
/// decoding if the backend adds a value.

struct Profile: Codable, Identifiable, Equatable {
    let id: String
    let role: String            // 'coach' | 'athlete' — primary/display role
    /// Dual-role flags — gates use these; optional so pre-migration rows decode.
    let isCoach: Bool?
    let isAthlete: Bool?
    var name: String
    let email: String
    let initials: String
    let title: String?
    let avatarUrl: String?
    let experienceLevel: String? // 'new'|'returning'|'experienced'|'competitive'
    let primaryGoal: String?     // 'fit'|'first-race'|'pr'|'distance'
    enum CodingKeys: String, CodingKey {
        case id, role, name, email, initials, title
        case isCoach = "is_coach"
        case isAthlete = "is_athlete"
        case avatarUrl = "avatar_url"
        case experienceLevel = "experience_level"
        case primaryGoal = "primary_goal"
    }
    /// The athlete gate: flag when present, else legacy role fallback.
    var athleteAccess: Bool { isAthlete ?? (role == "athlete") }
}

struct Plan: Codable, Identifiable, Equatable {
    let id: String
    let athleteId: String
    let goalRace: String?
    let goalDate: String?
    let goalDistance: String?
    let goalTime: String?
    let goalPace: String?
    /// Training-block start; WEEK x OF y derives from startDate -> goalDate.
    let startDate: String?
    let planWeek: Int
    let planWeeks: Int
    let status: String
    enum CodingKeys: String, CodingKey {
        case id, status
        case athleteId = "athlete_id"
        case goalRace = "goal_race"
        case goalDate = "goal_date"
        case goalDistance = "goal_distance"
        case goalTime = "goal_time"
        case goalPace = "goal_pace"
        case startDate = "start_date"
        case planWeek = "plan_week"
        case planWeeks = "plan_weeks"
    }
}

struct Workout: Codable, Identifiable, Equatable {
    let id: String
    let planId: String
    let athleteId: String
    let date: String            // 'YYYY-MM-DD'
    let type: String            // easy|long|speed|tempo|recovery|cross|rest|race
    let title: String
    let dist: Double?
    let pace: String?           // canonical 'M:SS/mi'
    let estMinutes: Int?
    let dur: Int?
    let note: String?
    let sets: [[String]]        // [label, detail] pairs
    var status: String          // done|today|planned|missed|rest
    enum CodingKeys: String, CodingKey {
        case id, date, type, title, dist, pace, dur, note, sets, status
        case planId = "plan_id"
        case athleteId = "athlete_id"
        case estMinutes = "est_minutes"
    }
}

struct WorkoutActual: Codable, Identifiable, Equatable {
    let id: String
    let workoutId: String?
    let athleteId: String
    let dist: Double
    let pace: String?            // nil for rides — pace is a running concept
    let time: String
    let hr: Int?
    let feel: Int?
    let note: String?
    let source: String
    let sourceId: String?        // provider's stable id (HealthKit UUID); nil for manual
    let recordedAt: String?      // timestamptz — the activity's start time for synced rows
    enum CodingKeys: String, CodingKey {
        case id, dist, pace, time, hr, feel, note, source
        case workoutId = "workout_id"
        case athleteId = "athlete_id"
        case sourceId = "source_id"
        case recordedAt = "recorded_at"
    }
}

/// Shadows Foundation.Thread; qualify as Foundation.Thread if OS thread API is ever needed.
struct Thread: Codable, Identifiable, Equatable {
    let id: String
    let athleteId: String
    let coachId: String
    enum CodingKeys: String, CodingKey {
        case id
        case athleteId = "athlete_id"
        case coachId = "coach_id"
    }
}

/// payload is heterogeneous by kind (runcard/adjust/workout) — decoded into
/// [String: PayloadValue] with typed accessors rather than 3 structs.
struct Message: Codable, Identifiable, Equatable {
    let id: String
    let threadId: String
    let fromUserId: String
    let kind: String            // text|runcard|adjust|workout
    let body: String?
    let payload: [String: PayloadValue]?
    let workoutId: String?
    var read: Bool
    let createdAt: String       // ISO timestamp string (compared lexically, like the web)
    enum CodingKeys: String, CodingKey {
        case id, kind, body, payload, read
        case threadId = "thread_id"
        case fromUserId = "from_user_id"
        case workoutId = "workout_id"
        case createdAt = "created_at"
    }
    func payloadString(_ key: String) -> String? {
        if case .string(let s)? = payload?[key] { return s }
        return nil
    }
    func payloadInt(_ key: String) -> Int? {
        switch payload?[key] {
        case .int(let i): return i
        case .double(let d): return Int(d)
        default: return nil
        }
    }
    func payloadDouble(_ key: String) -> Double? {
        switch payload?[key] {
        case .double(let d): return d
        case .int(let i): return Double(i)
        default: return nil
        }
    }
}

/// Minimal JSON scalar for message payloads.
enum PayloadValue: Codable, Equatable {
    case string(String), int(Int), double(Double), bool(Bool), null

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null }
        else if let b = try? c.decode(Bool.self) { self = .bool(b) }
        else if let i = try? c.decode(Int.self) { self = .int(i) }
        else if let d = try? c.decode(Double.self) { self = .double(d) }
        else if let s = try? c.decode(String.self) { self = .string(s) }
        else {
            assertionFailure("PayloadValue: unexpected JSON structure — nested object or array?")
            self = .null // arrays/objects inside payloads aren't used
        }
    }
    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .string(let s): try c.encode(s)
        case .int(let i): try c.encode(i)
        case .double(let d): try c.encode(d)
        case .bool(let b): try c.encode(b)
        case .null: try c.encodeNil()
        }
    }
}
