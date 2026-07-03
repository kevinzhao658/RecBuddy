import Foundation
import Supabase

/// Chat plumbing shared by LogRunSheet (share-to-chat) and ChatStore.
/// Mirrors coach-web's fetchThread: reuse the existing thread, else create one
/// (threads_write RLS allows the athlete; coach_id = their head coach).
enum ChatShare {
    static func fetchOrCreateThread(athleteId: String) async throws -> Thread {
        let existing: [Thread] = try await Supa.shared.from("message_threads")
            .select("id, athlete_id, coach_id").eq("athlete_id", value: athleteId)
            .limit(1).execute().value
        if let t = existing.first { return t }
        struct Link: Decodable { let coach_id: String }
        let head: [Link] = try await Supa.shared.from("coach_athlete")
            .select("coach_id").eq("athlete_id", value: athleteId)
            .eq("relationship", value: "head").limit(1).execute().value
        guard let coachId = head.first?.coach_id else {
            throw NSError(domain: "RecBuddy", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: "No coach linked yet."])
        }
        struct NewThread: Encodable { let athlete_id: String; let coach_id: String }
        let created: Thread = try await Supa.shared.from("message_threads")
            .insert(NewThread(athlete_id: athleteId, coach_id: coachId))
            .select("id, athlete_id, coach_id").single().execute().value
        return created
    }

    /// Post a kind='runcard' message (the shape the coach app already renders).
    static func shareRunCard(athleteId: String, title: String, dist: String,
                             pace: String, time: String, hr: Int?) async throws {
        let thread = try await fetchOrCreateThread(athleteId: athleteId)
        struct NewMsg: Encodable {
            let thread_id: String
            let from_user_id: String
            let kind: String
            let payload: [String: PayloadValue]
        }
        var payload: [String: PayloadValue] = [
            "title": .string(title), "dist": .string(dist),
            "pace": .string(pace), "time": .string(time),
        ]
        if let hr { payload["hr"] = .int(hr) }
        try await Supa.shared.from("messages")
            .insert(NewMsg(thread_id: thread.id, from_user_id: athleteId,
                           kind: "runcard", payload: payload)).execute()
    }
}
