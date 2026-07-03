import Foundation

/// Rows mirroring the shared Supabase schema (see coach-web lib/types.ts).
/// Enums stay Strings (matching the web) — exhaustive Swift enums would break
/// decoding if the backend adds a value.

struct Profile: Codable, Identifiable, Equatable {
    let id: String
    let role: String            // 'coach' | 'athlete'
    var name: String
    let email: String
    let initials: String
    let title: String?
    let avatarUrl: String?
    enum CodingKeys: String, CodingKey {
        case id, role, name, email, initials, title
        case avatarUrl = "avatar_url"
    }
}

struct Plan: Codable, Identifiable, Equatable {
    let id: String
    let athleteId: String
    let goalRace: String?
    let goalDate: String?
    let goalDistance: String?
    let goalTime: String?
    let goalPace: String?
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
    let pace: String
    let time: String
    let hr: Int?
    let feel: Int?
    let source: String
    enum CodingKeys: String, CodingKey {
        case id, dist, pace, time, hr, feel, source
        case workoutId = "workout_id"
        case athleteId = "athlete_id"
    }
}

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
        else { self = .null } // arrays/objects inside payloads aren't used
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
