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

    /// No messages yet.
    var isEmptyPreview: Bool { lastAt == nil }

    /// Inbox subtitle: "You: …" for my messages, "Dani: …" in groups, else the text.
    func previewLine(me: String) -> String {
        let content: String
        switch lastKind {
        case "image": content = (lastBody?.isEmpty == false) ? "📷 \(lastBody!)" : "📷 Photo"
        case "video": content = (lastBody?.isEmpty == false) ? "🎥 \(lastBody!)" : "🎥 Video"
        case "runcard": content = "Logged a run"
        case "workout": content = "Shared a workout"
        case "adjust": content = "Adjusted a workout"
        case nil: return "No messages yet"
        default: content = (lastBody ?? "").split(whereSeparator: \.isNewline).joined(separator: " ")
        }
        if lastFrom == me { return "You: \(content)" }
        if members.count > 1, let from = lastFrom, let who = members.first(where: { $0.userId == from }) {
            return "\(who.name.split(separator: " ").first.map(String.init) ?? who.name): \(content)"
        }
        return content
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
/// Includes people who left (their old messages keep a name); `current`
/// says who is in the conversation now.
struct ThreadPerson: Decodable, Equatable {
    let userId: String
    let name: String
    let initials: String
    let avatarUrl: String?
    let title: String?
    var current: Bool? = nil
    var isMember: Bool { current ?? true }
    enum CodingKeys: String, CodingKey {
        case name, initials, title, current
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

/// A message_reactions row: one per person per kind (a person can hold
/// several kinds on a message). active == false means it was removed.
struct Reaction: Decodable, Equatable {
    let messageId: String
    let userId: String
    let kind: ReactionKind?
    var active: Bool? = nil
    enum CodingKeys: String, CodingKey {
        case kind, active
        case messageId = "message_id"
        case userId = "user_id"
    }
}

/// Pure helpers over a thread's reactions, always in canonical kind order.
enum ReactionSummary {
    private static func active(_ rs: [Reaction], _ messageId: String) -> [(user: String, kind: ReactionKind)] {
        rs.compactMap { r in
            guard r.messageId == messageId, r.active != false, let k = r.kind else { return nil }
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

    /// The kinds I've added to a message, in canonical order.
    static func mine(_ rs: [Reaction], messageId: String, me: String) -> [ReactionKind] {
        let kinds = Set(active(rs, messageId).filter { $0.user == me }.map(\.kind))
        return ReactionKind.allCases.filter(kinds.contains)
    }

    /// (name, kind) for the who-reacted sheet, grouped by kind in canonical order.
    static func names(_ rs: [Reaction], messageId: String, nameFor: (String) -> String) -> [(name: String, kind: ReactionKind)] {
        let all = active(rs, messageId)
        return ReactionKind.allCases.flatMap { k in
            all.filter { $0.kind == k }.map { (nameFor($0.user), k) }
        }
    }
}

/// Who's picked in the "New message → To:" field.
struct ComposeSelection: Equatable {
    private(set) var people: [ChatPerson] = []
    /// The composer is an athlete (counts toward "athletes see each other").
    var meIsAthlete = false
    var userIds: [String] { people.map(\.userId) }
    var canSend: Bool { !people.isEmpty }
    var isGroup: Bool { people.count >= 2 }
    var athleteCount: Int { people.filter(\.isAthlete).count }
    /// Two or more athletes see each other's names and messages.
    var showsAthleteNote: Bool { athleteCount + (meIsAthlete ? 1 : 0) >= 2 }
    func contains(_ p: ChatPerson) -> Bool { people.contains { $0.userId == p.userId } }
    mutating func toggle(_ p: ChatPerson) {
        if let i = people.firstIndex(where: { $0.userId == p.userId }) { people.remove(at: i) } else { people.append(p) }
    }
}

/// What tapping a conversation's header (photos or names) offers.
/// Who's in a conversation, as the header and Chat Details show it.
enum ChatPeople {
    /// Everyone counted, me included, for team chats and groups; a 1:1 is private.
    static func subtitle(isTeam: Bool, otherCount: Int) -> String {
        !isTeam && otherCount <= 1 ? "Private conversation" : "\(otherCount + 1) people"
    }

    /// Anyone in a writable group of three or more can remove someone. Team
    /// chats follow coaching links; a 1:1 has nobody to remove.
    static func canRemove(isTeam: Bool, otherCount: Int, readOnly: Bool) -> Bool {
        !isTeam && !readOnly && otherCount >= 2
    }
}

enum ChatHeaderMenu {
    enum Action: Equatable { case rename, details }

    /// Team chats and groups can be named; a 1:1 just shows its details.
    static func actions(isTeam: Bool, otherCount: Int, readOnly: Bool) -> [Action] {
        !readOnly && (isTeam || otherCount >= 2) ? [.rename, .details] : [.details]
    }

    /// "Oct 18, 2026" from a Postgres timestamp (any fractional precision).
    static func startedLabel(_ iso: String?, timeZone: TimeZone = .current) -> String? {
        guard let iso else { return nil }
        let trimmed = iso.replacingOccurrences(of: #"\.\d+"#, with: "", options: .regularExpression)
        guard let date = ISO8601DateFormatter().date(from: trimmed) else { return nil }
        let f = DateFormatter()
        f.dateFormat = "MMM d, yyyy"
        f.timeZone = timeZone
        return f.string(from: date)
    }
}

/// What the Chats tab shows: a load failure is an error, not "no chats yet".
enum InboxDisplay: Equatable {
    case loading, error, empty, list
    static func state(loaded: Bool, error: String?, count: Int) -> InboxDisplay {
        if count > 0 { return .list }
        if error != nil { return .error }
        return loaded ? .empty : .loading
    }
}

/// Long-press menu rules for a message.
enum MessageMenu {
    /// No Reply where nothing can be sent.
    static func showsReply(readOnly: Bool) -> Bool { !readOnly }

    /// Block confirmation: blocking a coach also ends coaching; anyone else
    /// is just muted and kept out of your chats.
    static func blockMessage(name: String, isCoach: Bool) -> String {
        isCoach
            ? "\(name) will be removed from your team, can't message you or see your chat, and can't reconnect unless you unblock them in Settings → Coaches. Their messages are hidden."
            : "\(name) can't message you and you won't see their messages. Unblock anytime in Settings → Coaches."
    }
}
