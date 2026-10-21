import Foundation
import Observation

/// Notification tap routing + in-chat banner suppression. A singleton (not
/// environment) because AppDelegate — outside the SwiftUI tree — writes it.
@Observable @MainActor
final class AppRouter {
    static let shared = AppRouter()
    /// Set by a notification tap; MainTabs switches to the chat tab and resets it.
    var openChat = false
    /// Set with openChat by a push tap: ChatsView opens this conversation.
    var openThreadId: String?
    /// A conversation is pushed inside the Chat tab: the tab bar hides (like
    /// Messages) so it doesn't cover the composer.
    var inConversation = false
    /// True while the chat tab is frontmost — banners are suppressed there
    /// (realtime already paints the incoming message).
    var chatVisible = false
    /// "Message coach about this" from a workout: ChatView attaches it to the
    /// composer and clears it. Set together with openChat.
    var pendingWorkoutQuote: WorkoutQuote?
}

/// A workout attached to a chat message ("Message coach about this"). Sent as a
/// text message with workout_id + payload {quote:"workout", title, date, type}.
struct WorkoutQuote: Equatable {
    let workoutId: String
    let date: String
    let type: String
    let title: String
}
