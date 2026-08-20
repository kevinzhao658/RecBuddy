import Foundation
import Observation

/// Notification tap routing + in-chat banner suppression. A singleton (not
/// environment) because AppDelegate — outside the SwiftUI tree — writes it.
@Observable @MainActor
final class AppRouter {
    static let shared = AppRouter()
    /// Set by a notification tap; MainTabs switches to the chat tab and resets it.
    var openChat = false
    /// True while the chat tab is frontmost — banners are suppressed there
    /// (realtime already paints the incoming message).
    var chatVisible = false
}
