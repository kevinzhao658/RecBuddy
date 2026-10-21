import Foundation
import Observation
import Supabase

/// One open conversation (team or chat): messages, the people in it,
/// reactions, send, realtime refresh, mark-read.
@Observable @MainActor
final class ChatStore {
    enum Phase: Equatable { case idle, loading, error(String), noCoach }
    private(set) var phase: Phase = .idle
    private(set) var thread: Thread?
    private(set) var messages: [Message] = []
    private(set) var reactions: [Reaction] = []
    /// Everyone who can appear in this thread (thread_people), by user id.
    private(set) var senders: [String: ThreadPerson] = [:]
    /// The other people, for the header (head coach first on team threads).
    private(set) var team: [ThreadPerson] = []
    private var me = ""
    private var channel: RealtimeChannelV2?
    private var subscriptionTask: Task<Void, Never>?
    private var reactionTask: Task<Void, Never>?

    /// Open the athlete's team thread (Calendar share paths, legacy entry).
    func openTeam(athleteId: String) async {
        await close()
        phase = .loading
        do {
            let id = try await ChatShare.teamThreadId(athleteId: athleteId)
            await open(threadId: id, me: athleteId)
        } catch is CancellationError {
        } catch let e as NSError where e.domain == "RecBuddy" && e.code == 1 {
            phase = .noCoach   // no coach linked: ChatView shows the add-a-coach state
        } catch {
            phase = .error("Couldn't load chat. Pull to retry.")
        }
    }

    func open(threadId: String, me: String) async {
        await close()  // evict any prior channel/task — makes open() idempotent under fast flips
        self.me = me
        phase = .loading
        do {
            let t: Thread = try await Supa.shared.from("message_threads")
                .select("id, kind, title, read_only, athlete_id, coach_id")
                .eq("id", value: threadId).single().execute().value
            thread = t
            let people: [ThreadPerson] = try await Supa.shared
                .rpc("thread_people", params: ["p_thread": threadId]).execute().value
            senders = Dictionary(people.map { ($0.userId, $0) }, uniquingKeysWith: { a, _ in a })
            team = Self.currentPeople(people, me: me, headCoach: t.coachId)
            try await load(threadId: threadId)
            try await loadReactions(threadId: threadId)
            await markRead()
            await subscribe(threadId: threadId)
            phase = .idle
        } catch is CancellationError {
            // view disappeared mid-open — the next .task will re-open
        } catch {
            phase = .error("Couldn't load chat. Pull to retry.")
        }
    }

    private func load(threadId: String) async throws {
        messages = try await Supa.shared.from("messages")
            .select().eq("thread_id", value: threadId)
            .order("created_at").execute().value
    }

    private func loadReactions(threadId: String) async throws {
        reactions = try await Supa.shared.from("message_reactions")
            .select("message_id, user_id, kind, active").eq("thread_id", value: threadId)
            .execute().value
    }

    /// Toggle one reaction kind for me (adding it again removes it; other kinds stay). Optimistic, then reconciled
    /// by realtime / reload.
    func react(messageId: String, kind: ReactionKind) async throws {
        guard let thread else { return }
        struct Params: Encodable { let p_message: String; let p_kind: String }
        _ = try await Supa.shared.rpc("set_reaction",
                                      params: Params(p_message: messageId, p_kind: kind.rawValue)).execute()
        try await loadReactions(threadId: thread.id)
    }

    /// Send a text message, optionally quote-replying to `replyTo` (a message id
    /// in this thread) and/or attaching a workout ("Message coach about this").
    func send(_ body: String, from athleteId: String, replyTo: String? = nil,
              workout: WorkoutQuote? = nil) async throws {
        guard let thread else { return }
        struct NewMsg: Encodable {
            let thread_id: String; let from_user_id: String; let kind: String; let body: String
            let reply_to_id: String?
            let workout_id: String?
            let payload: [String: PayloadValue]?
        }
        let payload: [String: PayloadValue]? = workout.map {
            ["quote": .string("workout"), "title": .string($0.title),
             "date": .string($0.date), "type": .string($0.type)]
        }
        try await Supa.shared.from("messages")
            .insert(NewMsg(thread_id: thread.id, from_user_id: athleteId, kind: "text", body: body,
                           reply_to_id: replyTo, workout_id: workout?.workoutId, payload: payload))
            .execute()
        try await load(threadId: thread.id)
    }

    /// Upload a client-compressed JPEG to the private chat-images bucket and post
    /// kind='image' with payload {path, w, h}.
    /// Path convention: <thread_id>/<UUID>.jpg — the first folder segment is the
    /// thread_id, which the storage participant policy uses to gate access.
    /// Callers exchange the stored path for a signed URL at render time.
    func sendImage(_ data: Data, width: Int, height: Int, from athleteId: String, body: String? = nil,
                   replyTo: String? = nil) async throws {
        guard let thread else { return }
        let path = "\(thread.id)/\(UUID().uuidString).jpg"
        try await Supa.shared.storage
            .from("chat-images")
            .upload(path, data: data, options: FileOptions(contentType: "image/jpeg", upsert: false))
        struct ImagePayload: Encodable { let path: String; let w: Int; let h: Int }
        struct ImageMsg: Encodable {
            let thread_id: String; let from_user_id: String; let kind: String
            let body: String?
            let reply_to_id: String?
            let payload: ImagePayload
        }
        try await Supa.shared.from("messages")
            .insert(ImageMsg(
                thread_id: thread.id, from_user_id: athleteId, kind: "image",
                body: body,
                reply_to_id: replyTo,
                payload: ImagePayload(path: path, w: width, h: height)
            ))
            .execute()
        try await load(threadId: thread.id)
    }

    /// The other people in the conversation now, head coach first (a team
    /// thread's coach_id is the head). People who left stay in `senders` only.
    nonisolated static func currentPeople(_ people: [ThreadPerson], me: String, headCoach: String?) -> [ThreadPerson] {
        people.filter { $0.userId != me && $0.isMember }
            .sorted { ($0.userId == headCoach ? 0 : 1, $0.name) < ($1.userId == headCoach ? 0 : 1, $1.name) }
    }

    /// Mark this thread read for me (chat: last_read_at; team: per-message flag).
    func markRead() async {
        guard let thread else { return }
        _ = try? await Supa.shared.rpc("mark_thread_read", params: ["p_thread": thread.id]).execute()
    }

    /// Realtime: any change to this thread's messages or reactions -> reload.
    /// Listeners must be registered before subscribeWithError().
    private func subscribe(threadId: String) async {
        let ch = Supa.shared.channel("thread:\(threadId)")
        let changes = ch.postgresChange(AnyAction.self, schema: "public", table: "messages",
                                        filter: .eq("thread_id", value: threadId))
        let reactionChanges = ch.postgresChange(AnyAction.self, schema: "public", table: "message_reactions",
                                                filter: .eq("thread_id", value: threadId))
        try? await ch.subscribeWithError()
        channel = ch
        subscriptionTask = Task { [weak self] in
            for await _ in changes {
                guard let self else { break }
                try? await self.load(threadId: threadId)
                await self.markRead()
            }
        }
        reactionTask = Task { [weak self] in
            for await _ in reactionChanges {
                guard let self else { break }
                try? await self.loadReactions(threadId: threadId)
            }
        }
    }

    func close() async {
        subscriptionTask?.cancel(); subscriptionTask = nil
        reactionTask?.cancel(); reactionTask = nil
        if let channel { await Supa.shared.removeChannel(channel) }
        channel = nil
    }
}
