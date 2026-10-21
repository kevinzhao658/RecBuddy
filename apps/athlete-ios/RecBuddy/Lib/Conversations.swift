import Foundation

// Conversation + reaction models for the iMessage-style inbox. Mirrors the
// my_conversations / search_chat_people / message_reactions shapes and the
// coach-web types in lib/types.ts.

struct ConversationMember: Codable, Equatable, Identifiable {
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

/// One inbox row (my_conversations).
struct Conversation: Decodable, Identifiable, Equatable {
    let threadId: String
    let kind: String              // team | chat
    let title: String?
    let teamAthleteId: String?
    let members: [ConversationMember]   // everyone but me
    let lastBody: String?
    let lastKind: String?
    let lastFrom: String?
    let lastAt: String?
    let unread: Int
    let readOnly: Bool

    var id: String { threadId }
    var isTeam: Bool { kind == "team" }

    /// Group name if set; else the other people's names ("Dani Brooks",
    /// "Dani & Marcus", "Dani, Marcus & Bea"); "Team chat" for an empty team.
    var displayTitle: String {
        if let title, !title.isEmpty { return title }
        let names = members.map(\.name)
        switch names.count {
        case 0: return isTeam ? "Team chat" : "Conversation"
        case 1: return names[0]
        default:
            let firsts = names.map { String($0.split(separator: " ").first ?? Substring($0)) }
            return firsts.count == 2
                ? "\(firsts[0]) & \(firsts[1])"
                : firsts.dropLast().joined(separator: ", ") + " & " + firsts.last!
        }
    }

    enum CodingKeys: String, CodingKey {
        case kind, title, members, unread
        case threadId = "thread_id"
        case teamAthleteId = "team_athlete_id"
        case lastBody = "last_body"
        case lastKind = "last_kind"
        case lastFrom = "last_from"
        case lastAt = "last_at"
        case readOnly = "read_only"
    }
}

/// One search_chat_people result.
struct ChatPerson: Decodable, Identifiable, Equatable, Hashable {
    let userId: String
    let name: String
    let initials: String
    let avatarUrl: String?
    let personKind: String        // coach | athlete
    let context: String
    var id: String { userId }
    var isAthlete: Bool { personKind == "athlete" }
    enum CodingKeys: String, CodingKey {
        case name, initials, context
        case userId = "user_id"
        case avatarUrl = "avatar_url"
        case personKind = "person_kind"
    }
}

/// thread_people row: display info for anyone who can appear in a thread.
struct ThreadPerson: Decodable, Equatable {
    let userId: String
    let name: String
    let initials: String
    let avatarUrl: String?
    let title: String?
    enum CodingKeys: String, CodingKey {
        case name, initials, title
        case userId = "user_id"
        case avatarUrl = "avatar_url"
    }
}

enum ReactionKind: String, CaseIterable, Codable, Identifiable {
    case like, emphasize, question, laugh, congrats
    var id: String { rawValue }
    var emoji: String {
        switch self {
        case .like: return "👍"
        case .emphasize: return "‼️"
        case .question: return "❓"
        case .laugh: return "😂"
        case .congrats: return "🎉"
        }
    }
    var label: String {
        switch self {
        case .like: return "Like"
        case .emphasize: return "Emphasize"
        case .question: return "Question"
        case .laugh: return "Laugh"
        case .congrats: return "Congratulate"
        }
    }
}

/// A message_reactions row. kind == nil means the reaction was removed.
struct Reaction: Decodable, Equatable {
    let messageId: String
    let userId: String
    let kind: ReactionKind?
    enum CodingKeys: String, CodingKey {
        case kind
        case messageId = "message_id"
        case userId = "user_id"
    }
}

/// Pure helpers over a thread's reactions, always in canonical kind order.
enum ReactionSummary {
    private static func active(_ rs: [Reaction], _ messageId: String) -> [(user: String, kind: ReactionKind)] {
        rs.compactMap { r in
            guard r.messageId == messageId, let k = r.kind else { return nil }
            return (r.userId, k)
        }
    }

    /// Distinct kinds on a message, in canonical order.
    static func badges(_ rs: [Reaction], messageId: String) -> [ReactionKind] {
        let present = Set(active(rs, messageId).map(\.kind))
        return ReactionKind.allCases.filter(present.contains)
    }

    static func count(_ rs: [Reaction], messageId: String) -> Int {
        active(rs, messageId).count
    }

    static func mine(_ rs: [Reaction], messageId: String, me: String) -> ReactionKind? {
        active(rs, messageId).first { $0.user == me }?.kind
    }

    /// (name, kind) for the who-reacted sheet, grouped by kind in canonical order.
    static func names(_ rs: [Reaction], messageId: String, nameFor: (String) -> String) -> [(name: String, kind: ReactionKind)] {
        let all = active(rs, messageId)
        return ReactionKind.allCases.flatMap { k in
            all.filter { $0.kind == k }.map { (nameFor($0.user), k) }
        }
    }
}
