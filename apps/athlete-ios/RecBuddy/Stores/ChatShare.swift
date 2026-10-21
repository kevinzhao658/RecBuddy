import Foundation
import Supabase

/// Chat plumbing shared by LogRunSheet (share-to-chat) and ChatStore.
/// Share-to-chat always targets the athlete's TEAM thread (team_thread_id).
enum ChatShare {
    /// The athlete's team thread id (get-or-create, server-side). Throws
    /// NSError(domain: "RecBuddy", code: 1) when no coach is linked yet.
    static func teamThreadId(athleteId: String) async throws -> String {
        do {
            return try await Supa.shared.rpc("team_thread_id", params: ["p_athlete": athleteId]).execute().value
        } catch let e as PostgrestError where e.message.contains("no coach linked yet") {
            throw NSError(domain: "RecBuddy", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: "No coach linked yet."])
        }
    }

    /// Post a kind='runcard' message (the shape the coach app already renders).
    /// workout_id + payload.date trace the card back to the live workout row —
    /// both apps use them for tap-through to results-vs-prescribed.
    static func shareRunCard(athleteId: String, workoutId: String? = nil, date: String? = nil,
                             type: String? = nil, title: String, dist: String,
                             pace: String, time: String, hr: Int?, note: String? = nil) async throws {
        let threadId = try await teamThreadId(athleteId: athleteId)
        struct NewMsg: Encodable {
            let thread_id: String
            let from_user_id: String
            let kind: String
            let workout_id: String?
            let payload: [String: PayloadValue]
        }
        var payload: [String: PayloadValue] = [
            "title": .string(title), "dist": .string(dist),
            "pace": .string(pace), "time": .string(time),
        ]
        if let date { payload["date"] = .string(date) }
        if let type { payload["type"] = .string(type) }
        if let hr { payload["hr"] = .int(hr) }
        if let note, !note.isEmpty { payload["note"] = .string(note) }
        try await Supa.shared.from("messages")
            .insert(NewMsg(thread_id: threadId, from_user_id: athleteId,
                           kind: "runcard", workout_id: workoutId, payload: payload)).execute()
    }
}
