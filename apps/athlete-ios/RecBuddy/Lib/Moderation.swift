import Foundation
import Supabase

/// Report + block (App Store guideline 1.2). The server enforces everything —
/// see migration 20261018120000_ugc_report_block.sql.
enum ReportReason: String, CaseIterable, Identifiable {
    case harassment, hate, sexual, violence, spam, other
    var id: String { rawValue }
    var label: String {
        switch self {
        case .harassment: return "Harassment or bullying"
        case .hate:       return "Hate speech or slurs"
        case .sexual:     return "Sexual or inappropriate content"
        case .violence:   return "Threats, violence, or self-harm"
        case .spam:       return "Spam or scam"
        case .other:      return "Something else"
        }
    }
}

struct BlockedUser: Decodable, Identifiable, Equatable {
    let userId: String
    let name: String
    let initials: String
    let avatarUrl: String?
    var id: String { userId }
    enum CodingKeys: String, CodingKey {
        case name, initials
        case userId = "user_id"
        case avatarUrl = "avatar_url"
    }
}

enum Moderation {
    /// Report a message (preferred — the server snapshots it as evidence) or,
    /// with no message, a user you're connected to.
    static func report(reason: ReportReason, messageId: String? = nil,
                       userId: String? = nil, details: String? = nil) async throws {
        struct Params: Encodable {
            let p_reason: String
            let p_message_id: String?
            let p_reported_user_id: String?
            let p_details: String?
        }
        let trimmed = details?.trimmingCharacters(in: .whitespacesAndNewlines)
        try await Supa.shared.rpc("report_content", params: Params(
            p_reason: reason.rawValue,
            p_message_id: messageId,
            p_reported_user_id: messageId == nil ? userId : nil,
            p_details: trimmed?.isEmpty == false ? trimmed : nil
        )).execute()
    }

    /// Blocks the user and removes them from the athlete's team (server-side,
    /// one transaction). Their messages disappear from the chat.
    static func block(userId: String) async throws {
        try await Supa.shared.rpc("block_user", params: ["p_user_id": userId]).execute()
    }

    static func unblock(userId: String) async throws {
        let me = try await Supa.shared.auth.session.user.id.uuidString.lowercased()
        try await Supa.shared.from("user_blocks").delete()
            .eq("blocker_id", value: me)
            .eq("blocked_id", value: userId)
            .execute()
    }

    static func blockedUsers() async throws -> [BlockedUser] {
        try await Supa.shared.rpc("get_blocked_users").execute().value
    }

    /// Friendly copy for the server's language-filter rejection, else nil.
    static func filterMessage(_ error: Error) -> String? {
        let msg = ((error as? PostgrestError)?.message ?? error.localizedDescription).lowercased()
        return msg.contains("language that isn't allowed")
            ? "That message includes language that isn't allowed on RecBuddy. Please rephrase it."
            : nil
    }
}
