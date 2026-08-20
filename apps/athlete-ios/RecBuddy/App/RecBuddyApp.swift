import SwiftUI
import UserNotifications

@main
struct RecBuddyApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var session = SessionStore()
    @State private var health = HealthSyncService()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(session)
                .environment(health)
                .task { await session.start() }
                .preferredColorScheme(.dark)
                .tint(RB.accent)
                // recbuddy:// just foregrounds the app; session comes from normal sign-in (v1)
                .onOpenURL { _ in }
        }
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        PushRegistrar.registerCategories()
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Task { await PushRegistrar.upload(token: deviceToken) }
    }

    // Foreground: no banner while the chat tab is frontmost (realtime paints it).
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        await MainActor.run { AppRouter.shared.chatVisible } ? [] : [.banner, .sound]
    }

    // Tap -> chat tab; inline reply -> background send.
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                didReceive response: UNNotificationResponse) async {
        let info = response.notification.request.content.userInfo
        let threadId = info["thread_id"] as? String
        if let textResponse = response as? UNTextInputNotificationResponse, let threadId {
            _ = await PushRegistrar.sendReply(textResponse.userText, threadId: threadId)
        } else {
            await MainActor.run { AppRouter.shared.openChat = true }
        }
    }
}
