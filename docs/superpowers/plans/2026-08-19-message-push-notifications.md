# Message Push Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Coach→athlete messages push to the athlete's iPhone via APNs (app closed included), with inline reply from the notification and a Settings toggle.

**Architecture:** `messages` INSERT → dashboard-configured Database Webhook → `notify-message` Edge Function (recipient check, kind→preview, APNs HTTP/2 with ES256 JWT) → device tokens registered per device in a new `device_tokens` table. iOS adds an AppDelegate adaptor for token registration, a `COACH_MESSAGE` category with a text-input Reply action, chat-tab tap routing, and a Settings toggle whose OFF deletes the device's token row.

**Tech Stack:** Supabase Edge Functions (Deno/TS), APNs HTTP/2 token auth, SwiftUI + UserNotifications, swift-testing.

**Spec:** `docs/superpowers/specs/2026-08-19-message-push-notifications-design.md`

## Global Constraints

- Branch `feat/push-notifications` from `origin/dev` — **AFTER the today-widget PR merges** (both edit `SessionStore.signOut`); commits end `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Athlete-only pushes: the function exits without pushing when `from_user_id == thread.athlete_id`.
- Preview table (exact copy): text → coach name / body truncated to 120; image → "Sent a photo"; workout → "Shared a workout: {payload.title}"; adjust → "Adjusted your plan: {payload.from} → {payload.to}".
- APNs environment follows the PROVISIONING PROFILE, not build config: env detection parses `embedded.mobileprovision` for `aps-environment` (simulator → sandbox; missing profile (App Store) → prod). NEVER `#if DEBUG` for this.
- Category id `COACH_MESSAGE`; payload keys `thread_id`, `message_id`; `aps.thread-id` = thread id.
- Toggle OFF / sign-out = DELETE this device's `device_tokens` row (server-side off).
- Dashboard-configured webhook (NOT a migration); secrets set via CLI/dashboard on both projects — the plan's final task prints the human checklist; nothing in code contains the secret values.
- Supabase: only ever link/push to dev (`bawezljwxehadmkjeydw`) from the CLI; prod deploys via CI on merge to main.
- iOS test/build command (from `apps/athlete-ios/`): `xcodebuild test -project RecBuddy.xcodeproj -scheme "RecBuddy Dev" -destination "platform=iOS Simulator,name=iPhone 17 Pro"`; `xcodegen generate` after any file add / project.yml change. Never `git add .`.

---

### Task 1: Migration — `device_tokens`

**Files:**
- Create: `supabase/migrations/20260819150000_device_tokens.sql`

- [ ] **Step 1: Create the branch** (verify the widget PR is merged into dev first; if not, STOP and report BLOCKED)

```bash
cd /Users/kevinzhao/Documents/CodingProject/RecBuddy
git fetch origin && git checkout -b feat/push-notifications origin/dev
```

- [ ] **Step 2: Write the migration:**

```sql
-- Push notification device tokens (athlete iPhones). One row per device;
-- env records which APNs host this token belongs to (Xcode-installed builds
-- get sandbox tokens regardless of build config). RLS: owner-only — the
-- notify-message Edge Function reads with the service role.

create table device_tokens (
  user_id    uuid not null references profiles(id) on delete cascade,
  token      text not null,
  env        text not null default 'prod' check (env in ('sandbox', 'prod')),
  updated_at timestamptz not null default now(),
  primary key (user_id, token)
);

alter table device_tokens enable row level security;

create policy device_tokens_own on device_tokens for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
```

- [ ] **Step 3: Apply to dev:** `supabase db push` (linked project must be `bawezljwxehadmkjeydw`). Expected: applies cleanly.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260819150000_device_tokens.sql
git commit -m "feat(db): device_tokens for athlete push notifications

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: `notify-message` Edge Function

**Files:**
- Create: `supabase/functions/notify-message/index.ts`
- Modify: `supabase/config.toml` (verify_jwt off for this function)

**Interfaces:**
- Consumes: Database Webhook POST `{ type: "INSERT", record: <messages row> }` with header `x-webhook-secret`.
- Produces: APNs alerts per the preview table; deletes tokens APNs reports dead.

- [ ] **Step 1: `index.ts`:**

```ts
import { createClient } from 'jsr:@supabase/supabase-js@2'

// ── preview: message kind -> notification content (pure; mirrors the spec table) ──
export function preview(kind: string, body: string | null, payload: Record<string, unknown> | null, coach: string) {
  switch (kind) {
    case 'image':   return { title: coach, body: 'Sent a photo' }
    case 'workout': return { title: coach, body: `Shared a workout: ${payload?.title ?? 'workout'}` }
    case 'adjust':  return { title: coach, body: `Adjusted your plan: ${payload?.from ?? ''} → ${payload?.to ?? ''}` }
    default:        return { title: coach, body: (body ?? '').slice(0, 120) || 'New message' }
  }
}

// ── APNs ES256 JWT, cached under Apple's 20–60 min window ──
let cached: { jwt: string; at: number } | null = null
const b64url = (s: string) => s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

async function apnsJwt(): Promise<string> {
  if (cached && Date.now() - cached.at < 50 * 60 * 1000) return cached.jwt
  const pem = Deno.env.get('APNS_P8')!.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0))
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const header = b64url(btoa(JSON.stringify({ alg: 'ES256', kid: Deno.env.get('APNS_KEY_ID') })))
  const claims = b64url(btoa(JSON.stringify({ iss: Deno.env.get('APNS_TEAM_ID'), iat: Math.floor(Date.now() / 1000) })))
  const sig = new Uint8Array(await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(`${header}.${claims}`)))
  const jwt = `${header}.${claims}.${b64url(btoa(String.fromCharCode(...sig)))}`
  cached = { jwt, at: Date.now() }
  return jwt
}

/** Send one alert; 'gone' means the token is dead and should be deleted. */
async function push(token: string, env: string, alert: { title: string; body: string },
                    threadId: string, messageId: string): Promise<'ok' | 'gone' | 'error'> {
  const host = env === 'sandbox' ? 'api.sandbox.push.apple.com' : 'api.push.apple.com'
  const res = await fetch(`https://${host}/3/device/${token}`, {
    method: 'POST',
    headers: {
      authorization: `bearer ${await apnsJwt()}`,
      'apns-topic': Deno.env.get('APNS_TOPIC')!,
      'apns-push-type': 'alert',
      'apns-priority': '10',
    },
    body: JSON.stringify({
      aps: { alert, sound: 'default', 'thread-id': threadId, category: 'COACH_MESSAGE' },
      thread_id: threadId,
      message_id: messageId,
    }),
  })
  if (res.ok) return 'ok'
  const detail = await res.text().catch(() => '')
  console.error('apns', res.status, detail)
  return res.status === 410 || detail.includes('BadDeviceToken') ? 'gone' : 'error'
}

Deno.serve(async (req) => {
  if (req.headers.get('x-webhook-secret') !== Deno.env.get('WEBHOOK_SECRET')) {
    return new Response('forbidden', { status: 403 })
  }
  const { record } = await req.json()
  if (!record?.thread_id) return new Response('no record', { status: 400 })

  const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: thread } = await supa.from('message_threads')
    .select('athlete_id, coach_id').eq('id', record.thread_id).single()
  // Athlete-only pushes: skip anything the athlete sent.
  if (!thread || record.from_user_id === thread.athlete_id) return new Response('skip')

  const { data: coach } = await supa.from('profiles').select('name').eq('id', record.from_user_id).single()
  const alert = preview(record.kind, record.body, record.payload, coach?.name ?? 'Your coach')

  const { data: tokens } = await supa.from('device_tokens').select('token, env').eq('user_id', thread.athlete_id)
  for (const t of tokens ?? []) {
    if (await push(t.token, t.env, alert, record.thread_id, record.id) === 'gone') {
      await supa.from('device_tokens').delete().eq('user_id', thread.athlete_id).eq('token', t.token)
    }
  }
  return new Response('ok')
})
```

- [ ] **Step 2: config.toml** — append next to the existing `[functions.coach-signup]` block:

```toml
[functions.notify-message]
# Called by the Database Webhook (no user JWT); guarded by x-webhook-secret.
verify_jwt = false
```

- [ ] **Step 3: Deploy to dev:** `supabase functions deploy notify-message` (linked to dev). Expected: deploy succeeds. (Prod deploys automatically via CI on merge to main.)

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/notify-message/index.ts supabase/config.toml
git commit -m "feat(functions): notify-message — coach message -> APNs push to athlete devices

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: iOS registration — `PushRegistrar` + AppDelegate + entitlement (TDD on the pure parts)

**Files:**
- Create: `apps/athlete-ios/RecBuddy/Push/PushRegistrar.swift`
- Create: `apps/athlete-ios/RecBuddy/Push/AppRouter.swift`
- Modify: `apps/athlete-ios/RecBuddy/App/RecBuddyApp.swift` (delegate adaptor)
- Modify: `apps/athlete-ios/project.yml` (`aps-environment` entitlement)
- Test: `apps/athlete-ios/RecBuddyTests/PushRegistrarTests.swift`

**Interfaces:**

```swift
enum PushRegistrar {
    static func registerCategories()                      // COACH_MESSAGE + Reply action
    static func enable() async -> Bool                    // permission + registerForRemoteNotifications
    static func upload(token: Data) async                 // upsert (user_id, hex token, env)
    static func deleteToken() async                       // remove this device's row
    static func sendReply(_ text: String, threadId: String) async -> Bool
    static func hexToken(_ data: Data) -> String          // pure
    static func apnsEnv(profileText: String?, isSimulator: Bool) -> String  // pure: 'sandbox'|'prod'
}
@Observable @MainActor final class AppRouter {            // tap routing + foreground suppression
    static let shared = AppRouter()
    var openChat = false        // set by notification tap; MainTabs consumes
    var chatVisible = false     // set by MainTabs; suppresses banners in-chat
}
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate { ... }
```

- [ ] **Step 1: Failing tests** — `PushRegistrarTests.swift`:

```swift
import Testing
import Foundation
@testable import RecBuddy

@Suite struct PushRegistrarTests {
    @Test func hexTokenEncodesLowercaseNoSeparators() {
        let data = Data([0x0A, 0xFF, 0x00, 0x12])
        #expect(PushRegistrar.hexToken(data) == "0aff0012")
    }
    @Test func apnsEnvFollowsTheProvisioningProfileNotBuildConfig() {
        #expect(PushRegistrar.apnsEnv(profileText: nil, isSimulator: true) == "sandbox")
        // Xcode-installed build: profile carries aps-environment development.
        let devProfile = "<key>aps-environment</key>\n\t<string>development</string>"
        #expect(PushRegistrar.apnsEnv(profileText: devProfile, isSimulator: false) == "sandbox")
        // TestFlight/App Store: production (or no embedded profile at all).
        let prodProfile = "<key>aps-environment</key>\n\t<string>production</string>"
        #expect(PushRegistrar.apnsEnv(profileText: prodProfile, isSimulator: false) == "prod")
        #expect(PushRegistrar.apnsEnv(profileText: nil, isSimulator: false) == "prod")
    }
}
```

- [ ] **Step 2: xcodegen + run to verify failure.** Expected: compile error.

- [ ] **Step 3: Implement.** `AppRouter.swift`:

```swift
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
```

`PushRegistrar.swift`:

```swift
import Foundation
import UserNotifications
import UIKit
import Supabase

/// Device-token lifecycle + notification categories + the inline-reply send.
enum PushRegistrar {
    static let categoryId = "COACH_MESSAGE"
    static let replyActionId = "REPLY"

    // ── pure helpers (unit-tested) ──
    static func hexToken(_ data: Data) -> String {
        data.map { String(format: "%02x", $0) }.joined()
    }
    /// APNs env follows the PROVISIONING PROFILE: simulator and dev-profile
    /// installs are sandbox; TestFlight/App Store (production profile, or no
    /// embedded profile) are prod. Never derived from build config.
    static func apnsEnv(profileText: String?, isSimulator: Bool) -> String {
        if isSimulator { return "sandbox" }
        guard let text = profileText else { return "prod" }
        if let range = text.range(of: "aps-environment") {
            let after = text[range.upperBound...]
            if after.range(of: "development")?.lowerBound == after.range(of: "<string>")
                .map({ after.index($0.upperBound, offsetBy: 0) }) ?? after.range(of: "development")?.lowerBound,
               after.range(of: "development") != nil,
               let dev = after.range(of: "development"), let prod = after.range(of: "production") {
                return dev.lowerBound < prod.lowerBound ? "sandbox" : "prod"
            }
            if after.range(of: "development") != nil { return "sandbox" }
        }
        return "prod"
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

    static func upload(token: Data) async {
        guard let userId = try? await Supa.shared.auth.session.user.id else { return }
        struct Row: Encodable { let user_id: String; let token: String; let env: String }
        let row = Row(user_id: userId.uuidString.lowercased(), token: hexToken(token), env: currentEnv)
        _ = try? await Supa.shared.from("device_tokens")
            .upsert(row, onConflict: "user_id,token").execute()
    }

    static func deleteToken() async {
        guard let userId = try? await Supa.shared.auth.session.user.id else { return }
        _ = try? await Supa.shared.from("device_tokens")
            .delete().eq("user_id", value: userId.uuidString.lowercased()).execute()
    }

    /// Inline reply from the notification — runs in a background task so iOS
    /// lets the network call finish; failure posts a local "couldn't send".
    static func sendReply(_ text: String, threadId: String) async -> Bool {
        let bg = await UIApplication.shared.beginBackgroundTask()
        defer { Task { await UIApplication.shared.endBackgroundTask(bg) } }
        guard let userId = try? await Supa.shared.auth.session.user.id else { return false }
        struct NewMsg: Encodable { let thread_id: String; let from_user_id: String; let kind: String; let body: String }
        do {
            try await Supa.shared.from("messages")
                .insert(NewMsg(thread_id: threadId, from_user_id: userId.uuidString.lowercased(),
                               kind: "text", body: text)).execute()
            return true
        } catch {
            let content = UNMutableNotificationContent()
            content.title = "Couldn't send your reply"
            content.body = "Open RecBuddy to try again."
            try? await UNUserNotificationCenter.current().add(
                UNNotificationRequest(identifier: "reply-failed", content: content, trigger: nil))
            return false
        }
    }
}
```

NOTE ON `apnsEnv`: implement it as the SIMPLE version — the convoluted range
logic above is a plan-authoring artifact; use exactly this body:

```swift
    static func apnsEnv(profileText: String?, isSimulator: Bool) -> String {
        if isSimulator { return "sandbox" }
        guard let text = profileText,
              let key = text.range(of: "aps-environment") else { return "prod" }
        let tail = text[key.upperBound...].prefix(80)
        return tail.contains("development") ? "sandbox" : "prod"
    }
```

`AppDelegate` — append to `RecBuddyApp.swift` (same file, below the App struct):

```swift
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
```

and add inside `RecBuddyApp`: `@UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate`.

`project.yml` — app entitlements block gains:

```yaml
        aps-environment: development
```
(Xcode rewrites it to `production` when exporting for TestFlight/App Store.)

- [ ] **Step 4: xcodegen + run to verify pass.** Expected: `** TEST SUCCEEDED **`.

- [ ] **Step 5: Commit**

```bash
git add apps/athlete-ios/RecBuddy/Push apps/athlete-ios/RecBuddy/App/RecBuddyApp.swift apps/athlete-ios/project.yml apps/athlete-ios/RecBuddyTests/PushRegistrarTests.swift
git commit -m "feat(ios): push registration, COACH_MESSAGE category, inline reply plumbing

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Tab routing + chat visibility

**Files:**
- Modify: `apps/athlete-ios/RecBuddy/App/RootView.swift` (`MainTabs`)

- [ ] **Step 1:** In `MainTabs`, add `@State private var router = AppRouter.shared` and these modifiers on the outer `ZStack` (after `.safeAreaInset`):

```swift
        .onAppear { router.chatVisible = (tab == 1) }
        .onChange(of: tab) { _, t in router.chatVisible = (t == 1) }
        .onChange(of: router.openChat) { _, open in
            if open {
                withAnimation(.spring(response: 0.32, dampingFraction: 0.82)) { tab = 1 }
                router.openChat = false
            }
        }
```

- [ ] **Step 2:** Full test run. Expected: `** TEST SUCCEEDED **`.
- [ ] **Step 3: Commit**

```bash
git add apps/athlete-ios/RecBuddy/App/RootView.swift
git commit -m "feat(ios): notification tap opens the chat tab; suppress banners in-chat

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Settings toggle + sign-out cleanup

**Files:**
- Create: `apps/athlete-ios/RecBuddy/Views/Account/NotificationsSection.swift`
- Modify: `apps/athlete-ios/RecBuddy/Views/Account/AccountSheet.swift` (add section after `connectedServicesSection`)
- Modify: `apps/athlete-ios/RecBuddy/Stores/SessionStore.swift` (signOut deletes token)

- [ ] **Step 1: `NotificationsSection.swift`:**

```swift
import SwiftUI

/// Athlete Settings > Notifications. ON = permission + APNs registration
/// (token upserts via AppDelegate callback). OFF = delete this device's token
/// row — the server simply has nowhere to push. State persists per device.
struct NotificationsSection: View {
    @AppStorage("pushEnabled") private var pushEnabled = false
    @State private var busy = false

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 12) {
                Image(systemName: "bell.badge.fill")
                    .foregroundStyle(RB.accent)
                    .frame(width: 34, height: 34)
                    .background(RB.surface2)
                    .clipShape(RoundedRectangle(cornerRadius: 9))
                VStack(alignment: .leading, spacing: 2) {
                    Text("Message notifications").font(.subheadline.weight(.semibold)).foregroundStyle(.white)
                    Text("Get a push when your coach messages you — reply right from the notification.")
                        .font(.caption).foregroundStyle(RB.textMute)
                }
                Spacer()
                Toggle("", isOn: Binding(
                    get: { pushEnabled },
                    set: { on in Task { await set(on) } }
                ))
                .labelsHidden()
                .tint(RB.accent)
                .disabled(busy)
                .accessibilityLabel("Message notifications")
            }
            Text("If notifications were denied, enable them in iOS Settings > Notifications > RecBuddy.")
                .font(.caption2).foregroundStyle(RB.textFaint)
        }
        .padding(14)
        .rbCard()
    }

    private func set(_ on: Bool) async {
        busy = true
        defer { busy = false }
        if on {
            pushEnabled = await PushRegistrar.enable()
        } else {
            await PushRegistrar.deleteToken()
            pushEnabled = false
        }
    }
}
```

- [ ] **Step 2: AccountSheet** — add `notificationsSection` to the section stack directly after `connectedServicesSection`, and the builder:

```swift
    private var notificationsSection: some View {
        sectionGroup(title: "NOTIFICATIONS") {
            NotificationsSection()
        }
    }
```

- [ ] **Step 3: SessionStore.signOut** — before `try? await Supa.shared.auth.signOut()` (token delete needs the live session):

```swift
        await PushRegistrar.deleteToken()   // no pushes for a signed-out device
```

- [ ] **Step 4: xcodegen + full test run.** Expected: `** TEST SUCCEEDED **`.
- [ ] **Step 5: Commit**

```bash
git add apps/athlete-ios/RecBuddy/Views/Account/NotificationsSection.swift apps/athlete-ios/RecBuddy/Views/Account/AccountSheet.swift apps/athlete-ios/RecBuddy/Stores/SessionStore.swift
git commit -m "feat(ios): message-notifications toggle; sign-out revokes the device token

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Final verification + PR + human setup checklist

- [ ] **Step 1:** `xcodegen generate` + full iOS test run — `** TEST SUCCEEDED **`.
- [ ] **Step 2: Push + PR**

```bash
cd /Users/kevinzhao/Documents/CodingProject/RecBuddy
git push -u origin feat/push-notifications
gh pr create --base dev --head feat/push-notifications \
  --title "Athlete push notifications: coach messages -> APNs with inline reply" \
  --body "Implements docs/superpowers/specs/2026-08-19-message-push-notifications-design.md: device_tokens table, notify-message Edge Function (webhook-secret guarded, ES256 APNs JWT, per-token sandbox/prod hosts, dead-token cleanup), iOS registration via AppDelegate adaptor, COACH_MESSAGE category with inline Reply (background send + failure fallback notification), chat-tab tap routing, in-chat banner suppression, Settings toggle with server-side off, sign-out token revocation. APNs env is derived from the embedded provisioning profile, never build config.

End-to-end verification requires the one-time human setup (APNs key, secrets, dashboard webhooks) — checklist in the PR thread.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

- [ ] **Step 3: Report the HUMAN SETUP CHECKLIST** verbatim in the final report (these are user actions, not code):

```
1. developer.apple.com → Certificates, Identifiers & Profiles → Keys → ＋ →
   check "Apple Push Notifications service (APNs)" → register → DOWNLOAD the
   .p8 (one chance) and note the Key ID.
2. Secrets on BOTH projects (dev bawezljwxehadmkjeydw, prod dclxyvtxwibtilnatyqp):
     supabase secrets set --project-ref <ref> \
       APNS_KEY_ID=<keyid> APNS_TEAM_ID=R2D2PYP37U \
       APNS_TOPIC=app.recbuddy.athlete WEBHOOK_SECRET=<random string> \
       APNS_P8="$(cat AuthKey_<keyid>.p8)"
3. Dashboard → Database → Webhooks → Create (on EACH project):
     table public.messages · events INSERT · type HTTP request ·
     URL https://<ref>.supabase.co/functions/v1/notify-message ·
     HTTP header x-webhook-secret: <same WEBHOOK_SECRET>
4. Device test (Debug build on iPhone): Settings → Notifications toggle ON →
   send a message from coach-web as Mara → expect banner; long-press → Reply.
```

## Deferred (per spec)
Coach/web push; badge counts; rich images; per-thread mute; quiet hours.
