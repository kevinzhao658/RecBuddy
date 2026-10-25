import Foundation
import Supabase

/// A coach asking to coach this athlete. Nothing is shared with the coach
/// until the athlete accepts — see migration 20261019260000_link_requests.sql.
struct LinkRequest: Decodable, Identifiable, Equatable {
    let id: String
    let kind: String            // "athlete" (answered here) | "co_coach" (answered on the web)
    let coachId: String
    let athleteId: String
    let relationship: String    // "head" | "assistant"
    let requesterName: String
    let athleteName: String
    enum CodingKeys: String, CodingKey {
        case id, kind, relationship
        case coachId = "coach_id"
        case athleteId = "athlete_id"
        case requesterName = "requester_name"
        case athleteName = "athlete_name"
    }
}

enum LinkRequestText {
    static func title(_ r: LinkRequest) -> String {
        r.relationship == "head" ? "\(r.requesterName) wants to be your head coach" : "\(r.requesterName) wants to coach you"
    }

    /// One line for the Today banner, or nil when nothing is waiting.
    static func banner(_ rows: [LinkRequest]) -> String? {
        switch rows.count {
        case 0: return nil
        case 1: return "\(rows[0].requesterName) wants to coach you"
        default: return "\(rows.count) coaches want to coach you"
        }
    }

    static func forAthlete(_ rows: [LinkRequest]) -> [LinkRequest] { rows.filter { $0.kind == "athlete" } }
}

enum LinkRequestsAPI {
    static func mine() async throws -> [LinkRequest] {
        let rows: [LinkRequest] = try await Supa.shared.rpc("my_link_requests").execute().value
        return LinkRequestText.forAthlete(rows)
    }

    static func respond(_ id: String, accept: Bool) async throws {
        struct Params: Encodable { let p_id: String; let p_accept: Bool }
        try await Supa.shared.rpc("respond_link_request", params: Params(p_id: id, p_accept: accept)).execute()
    }
}
