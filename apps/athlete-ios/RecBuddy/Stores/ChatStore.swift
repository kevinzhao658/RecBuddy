import Foundation
import Observation
import Supabase

/// The athlete's one thread with their coach team: messages, senders,
/// send, realtime refresh, mark-read. Sender names resolve via profiles
/// (RLS lets the athlete read linked coaches).
@Observable @MainActor
final class ChatStore {
    enum Phase: Equatable { case idle, loading, error(String) }
    private(set) var phase: Phase = .idle
    private(set) var thread: Thread?
    private(set) var messages: [Message] = []
    private(set) var senders: [String: Profile] = [:]   // from_user_id -> profile
    private var channel: RealtimeChannelV2?
    private var subscriptionTask: Task<Void, Never>?

    func open(athleteId: String) async {
        phase = .loading
        do {
            let t = try await ChatShare.fetchOrCreateThread(athleteId: athleteId)
            thread = t
            let coaches: [Profile] = try await Supa.shared.from("profiles")
                .select().neq("id", value: athleteId).execute().value
            senders = Dictionary(uniqueKeysWithValues: coaches.map { ($0.id, $0) })
            try await load(threadId: t.id)
            await markRead(athleteId: athleteId)
            await subscribe(threadId: t.id, athleteId: athleteId)
            phase = .idle
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
