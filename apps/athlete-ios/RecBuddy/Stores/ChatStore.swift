import Foundation
import Observation
import Supabase

/// One coaching-team member, resolved via the get_team RPC. The definer RPC
/// sees the WHOLE team (head + assistants added later); the raw profiles read
/// it replaces missed co-coaches, leaving their messages nameless.
struct ChatSender: Decodable, Equatable {
    let coachId: String
    let relationship: String   // 'head' | 'assistant'
    let name: String
    let title: String?
    let initials: String
    let avatarUrl: String?
    enum CodingKeys: String, CodingKey {
        case relationship, name, title, initials
        case coachId = "coach_id"
        case avatarUrl = "avatar_url"
    }
}

/// The athlete's one thread with their coach team: messages, senders,
/// send, realtime refresh, mark-read. Senders resolve via get_team
/// (head first — drives the chat title and the avatar stack).
@Observable @MainActor
final class ChatStore {
    enum Phase: Equatable { case idle, loading, error(String), noCoach }
    private(set) var phase: Phase = .idle
    private(set) var thread: Thread?
    private(set) var messages: [Message] = []
    private(set) var team: [ChatSender] = []            // head first
    private(set) var senders: [String: ChatSender] = [:] // from_user_id -> member
    private var channel: RealtimeChannelV2?
    private var subscriptionTask: Task<Void, Never>?

    func open(athleteId: String) async {
        await close()  // evict any prior channel/task — makes open() idempotent under fast tab flips
        phase = .loading
        do {
            let t = try await ChatShare.fetchOrCreateThread(athleteId: athleteId)
            thread = t
            let rows: [ChatSender] = try await Supa.shared
                .rpc("get_team", params: ["p_athlete_id": athleteId])
                .execute().value
            team = rows
            senders = Dictionary(uniqueKeysWithValues: rows.map { ($0.coachId, $0) })
            try await load(threadId: t.id)
            await markRead(athleteId: athleteId)
            await subscribe(threadId: t.id, athleteId: athleteId)
            phase = .idle
        } catch is CancellationError {
            // view disappeared mid-open — the next .task will re-open
        } catch let e as NSError where e.domain == "RecBuddy" && e.code == 1 {
            // No coach linked (and no prior thread) — not an error: the athlete
            // was removed or hasn't joined a coach yet. ChatView shows the
            // add-a-coach empty state.
            phase = .noCoach
        } catch {
            phase = .error("Couldn't load chat. Pull to retry.")
        }
    }

    private func load(threadId: String) async throws {
        messages = try await Supa.shared.from("messages")
            .select().eq("thread_id", value: threadId)
            .order("created_at").execute().value
    }

    func send(_ body: String, from athleteId: String) async throws {
        guard let thread else { return }
        struct NewMsg: Encodable { let thread_id: String; let from_user_id: String; let kind: String; let body: String }
        try await Supa.shared.from("messages")
            .insert(NewMsg(thread_id: thread.id, from_user_id: athleteId, kind: "text", body: body))
            .execute()
        try await load(threadId: thread.id)
    }

    /// Upload a client-compressed JPEG to the private chat-images bucket and post
    /// kind='image' with payload {path, w, h}.
    /// Path convention: <thread_id>/<UUID>.jpg — the first folder segment is the
    /// thread_id, which the storage participant policy uses to gate access.
    /// Callers exchange the stored path for a signed URL at render time.
    func sendImage(_ data: Data, width: Int, height: Int, from athleteId: String, body: String? = nil) async throws {
        guard let thread else { return }
        let path = "\(thread.id)/\(UUID().uuidString).jpg"
        try await Supa.shared.storage
            .from("chat-images")
            .upload(path, data: data, options: FileOptions(contentType: "image/jpeg", upsert: false))
        struct ImagePayload: Encodable { let path: String; let w: Int; let h: Int }
        struct ImageMsg: Encodable {
            let thread_id: String; let from_user_id: String; let kind: String
            let body: String?
            let payload: ImagePayload
        }
        try await Supa.shared.from("messages")
            .insert(ImageMsg(
                thread_id: thread.id, from_user_id: athleteId, kind: "image",
                body: body,
                payload: ImagePayload(path: path, w: width, h: height)
            ))
            .execute()
        try await load(threadId: thread.id)
    }

    /// Mark coach-authored unread messages read (drives the coach's unread badge).
    func markRead(athleteId: String) async {
        guard let thread else { return }
        _ = try? await Supa.shared.from("messages").update(["read": true])
            .eq("thread_id", value: thread.id).eq("read", value: false)
            .neq("from_user_id", value: athleteId).execute()
    }

    /// Realtime: any change to this thread's messages -> reload (coach-web pattern).
    /// Adaptation from draft: postgresChange now takes RealtimePostgresFilter (.eq typed enum)
    /// instead of the deprecated String? filter overload; subscribe() is deprecated in 2.48,
    /// replaced by subscribeWithError() (async throws). Callbacks must be registered BEFORE
    /// subscribeWithError() — the draft order is preserved.
    private func subscribe(threadId: String, athleteId: String) async {
        let ch = Supa.shared.channel("messages:\(threadId)")
        // Register postgres change listener before subscribing (SDK enforces this order).
        // Use typed RealtimePostgresFilter.eq instead of deprecated String? filter.
        let changes = ch.postgresChange(
            AnyAction.self,
            schema: "public",
            table: "messages",
            filter: .eq("thread_id", value: threadId)
        )
        // subscribeWithError() replaces the deprecated @MainActor subscribe() in 2.48.
        try? await ch.subscribeWithError()
        channel = ch
        subscriptionTask = Task { [weak self] in
            for await _ in changes {
                guard let self else { break }
                try? await self.load(threadId: threadId)
                await self.markRead(athleteId: athleteId)
            }
        }
    }

    func close() async {
        subscriptionTask?.cancel()
        subscriptionTask = nil
        if let channel { await Supa.shared.removeChannel(channel) }
        channel = nil
    }
}
