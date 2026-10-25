import Foundation
import Observation
import Supabase

/// The inbox: every conversation I can see (my_conversations), plus the
/// compose and membership actions. Reloads live when someone messages me or
/// adds me to a chat.
@Observable @MainActor
final class ConversationsStore {
    private(set) var conversations: [Conversation] = []
    private(set) var loaded = false
    private(set) var error: String?
    private var channel: RealtimeChannelV2?
    private var tasks: [Task<Void, Never>] = []

    func load() async {
        do {
            conversations = try await Supa.shared.rpc("my_conversations").execute().value
            error = nil
        } catch is CancellationError {
        } catch {
            self.error = "Couldn't load your chats. Pull to retry."
        }
        loaded = true
    }

    func search(_ query: String) async -> [ChatPerson] {
        (try? await Supa.shared.rpc("search_chat_people", params: ["p_query": query]).execute().value) ?? []
    }

    /// Start (or reopen) a conversation with these people; returns its thread id.
    func start(userIds: [String], title: String?) async throws -> String {
        struct Params: Encodable { let p_user_ids: [String]; let p_title: String? }
        let id: String = try await Supa.shared.rpc("start_conversation",
                                                   params: Params(p_user_ids: userIds, p_title: title)).execute().value
        await load()
        return id
    }

    /// Returns the thread to open: the same group, or a new group when adding to a 1:1.
    func add(threadId: String, userIds: [String]) async throws -> String {
        struct Params: Encodable { let p_thread: String; let p_user_ids: [String] }
        let id: String = try await Supa.shared.rpc("add_conversation_members",
                                                   params: Params(p_thread: threadId, p_user_ids: userIds)).execute().value
        await load()
        return id
    }

    func rename(threadId: String, title: String) async throws {
        struct Params: Encodable { let p_thread: String; let p_title: String }
        try await Supa.shared.rpc("rename_conversation", params: Params(p_thread: threadId, p_title: title)).execute()
        await load()
    }

    func leave(threadId: String) async throws {
        try await Supa.shared.rpc("leave_conversation", params: ["p_thread": threadId]).execute()
        await load()
    }

    /// Take someone out of a group (they can be added back later).
    func remove(threadId: String, userId: String) async throws {
        try await Supa.shared.rpc("remove_conversation_member",
                                  params: ["p_thread": threadId, "p_user": userId]).execute()
        await load()
    }

    func hide(threadId: String) async throws {
        try await Supa.shared.rpc("hide_conversation", params: ["p_thread": threadId]).execute()
        await load()
    }

    /// Realtime: new messages anywhere I can read, and my own membership
    /// changes (someone starts a chat with me or adds me) -> reload.
    func subscribe(me: String) async {
        await unsubscribe()
        let ch = Supa.shared.channel("inbox:\(me)")
        let messages = ch.postgresChange(InsertAction.self, schema: "public", table: "messages")
        let membership = ch.postgresChange(AnyAction.self, schema: "public", table: "thread_members",
                                           filter: .eq("user_id", value: me))
        try? await ch.subscribeWithError()
        channel = ch
        tasks = [
            Task { [weak self] in for await _ in messages { await self?.load() } },
            Task { [weak self] in for await _ in membership { await self?.load() } },
        ]
    }

    func unsubscribe() async {
        tasks.forEach { $0.cancel() }
        tasks = []
        if let channel { await Supa.shared.removeChannel(channel) }
        channel = nil
    }
}
