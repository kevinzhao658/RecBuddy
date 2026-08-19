import Foundation
import UserNotifications
import UIKit
import Supabase

/// Device-token lifecycle + notification categories + the inline-reply send.
enum PushRegistrar {
    static let categoryId = "COACH_MESSAGE"
    static let replyActionId = "REPLY"
    /// The token this device last uploaded — the delete filter, so disabling
    /// notifications here never touches the athlete's other devices.
    private static let deviceTokenKey = "apnsDeviceToken"

    // ── pure helpers (unit-tested) ──
    static func hexToken(_ data: Data) -> String {
        data.map { String(format: "%02x", $0) }.joined()
    }
    /// APNs env follows the PROVISIONING PROFILE: simulator and dev-profile
    /// installs are sandbox; TestFlight/App Store (production profile, or no
    /// embedded profile) are prod. Never derived from build config.
    static func apnsEnv(profileText: String?, isSimulator: Bool) -> String {
        if isSimulator { return "sandbox" }
        guard let text = profileText,
              let key = text.range(of: "aps-environment") else { return "prod" }
        let tail = text[key.upperBound...].prefix(80)
        return tail.contains("development") ? "sandbox" : "prod"
    }

    private static var currentEnv: String {
        #if targetEnvironment(simulator)
        return "sandbox"
        #else
        let text = Bundle.main.url(forResource: "embedded", withExtension: "mobileprovision")
            .flatMap { try? Data(contentsOf: $0) }
            .map { String(decoding: $0, as: UTF8.self) }
        return apnsEnv(profileText: text, isSimulator: false)
        #endif
    }

    // ── lifecycle ──
    static func registerCategories() {
        let reply = UNTextInputNotificationAction(
            identifier: replyActionId, title: "Reply", options: [],
            textInputButtonTitle: "Send", textInputPlaceholder: "Message your coach…")
        let cat = UNNotificationCategory(identifier: categoryId, actions: [reply],
                                         intentIdentifiers: [], options: [])
        UNUserNotificationCenter.current().setNotificationCategories([cat])
    }

    /// Permission + APNs registration. Returns whether permission is granted.
    @MainActor
    static func enable() async -> Bool {
        let granted = (try? await UNUserNotificationCenter.current()
            .requestAuthorization(options: [.alert, .badge, .sound])) ?? false
        if granted { UIApplication.shared.registerForRemoteNotifications() }
        return granted
    }

    /// Re-register at app open / sign-in when the toggle is on — APNs tokens
    /// rotate (reinstall/restore), and an athlete switch needs the token
    /// upserted under the new user. Gated on pushEnabled so a token the user
    /// deliberately deleted is never resurrected.
    @MainActor
    static func reregisterIfEnabled() async {
        guard UserDefaults.standard.bool(forKey: "pushEnabled") else { return }
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        guard settings.authorizationStatus == .authorized else { return }
        UIApplication.shared.registerForRemoteNotifications()
    }

    static func upload(token: Data) async {
        guard let userId = try? await Supa.shared.auth.session.user.id else { return }
        struct Row: Encodable { let user_id: String; let token: String; let env: String }
        let row = Row(user_id: userId.uuidString.lowercased(), token: hexToken(token), env: currentEnv)
        UserDefaults.standard.set(hexToken(token), forKey: deviceTokenKey)
        _ = try? await Supa.shared.from("device_tokens")
            .upsert(row, onConflict: "user_id,token").execute()
    }

    static func deleteToken() async {
        guard let userId = try? await Supa.shared.auth.session.user.id,
              let token = UserDefaults.standard.string(forKey: deviceTokenKey) else { return }
        _ = try? await Supa.shared.from("device_tokens")
            .delete()
            .eq("user_id", value: userId.uuidString.lowercased())
            .eq("token", value: token)
            .execute()
    }

    /// Inline reply from the notification — runs in a background task so iOS
    /// lets the network call finish; failure posts a local "couldn't send".
    static func sendReply(_ text: String, threadId: String) async -> Bool {
        let bg = await UIApplication.shared.beginBackgroundTask()
        defer { Task { await UIApplication.shared.endBackgroundTask(bg) } }
        guard let userId = try? await Supa.shared.auth.session.user.id else {
            await postReplyFailedNotification()
            return false
        }
        struct NewMsg: Encodable { let thread_id: String; let from_user_id: String; let kind: String; let body: String }
        do {
            try await Supa.shared.from("messages")
                .insert(NewMsg(thread_id: threadId, from_user_id: userId.uuidString.lowercased(),
                               kind: "text", body: text)).execute()
            return true
        } catch {
            await postReplyFailedNotification()
            return false
        }
    }

    /// Post a local notification for a failed reply send.
    private static func postReplyFailedNotification() async {
        let content = UNMutableNotificationContent()
        content.title = "Couldn't send your reply"
        content.body = "Open RecBuddy to try again."
        try? await UNUserNotificationCenter.current().add(
            UNNotificationRequest(identifier: "reply-failed", content: content, trigger: nil))
    }
}
