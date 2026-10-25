# Chat Videos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let athletes (iOS) and coaches (web) send short videos in any conversation. Server copies expire after 7 days; each device keeps its own copy.

**Architecture:**
- **Data:** a new `'video'` message kind, plus a private `chat-videos` bucket with the same read rules as photos. Posters (the still frame) go in `chat-images` and are kept.
- **Database checks:** a trigger sets `expires_at` and validates the payload.
- **Expiry:** a daily `pg_cron` job calls the `purge-chat-videos` edge function, which deletes expired files through the Storage API and skips videos with an open report.
- **Clients:** they compress (iOS) or check limits (web), upload the video and poster, then insert the message. They keep a local copy keyed by message id (iOS: Application Support; web: IndexedDB).

**Tech Stack:** Supabase (Postgres, Storage, pg_cron, pg_net, Deno edge functions), React 19 + TanStack Query + vitest, SwiftUI + AVFoundation + Swift Testing (XcodeGen).

**Spec:** `docs/superpowers/specs/2026-10-24-chat-videos-design.md` (approved 2026-10-24)

## Global Constraints

**Limits**
- Max 60 seconds. iOS compresses with `AVAssetExportPreset1280x720` to `.mp4`. Web sends as-is, max 60 s and 50 MB.
- Bucket `chat-videos`: private, `file_size_limit` 50 MB, `allowed_mime_types` `video/mp4` and `video/quicktime`.
- Path: `<thread_id>/<uuid>.mp4` (web keeps `.mov` for QuickTime). Poster: `chat-images/<thread_id>/<uuid>.jpg`.

**Message**
- Payload: `{ path, poster, w, h, duration_s }`. `expires_at = created_at + interval '7 days'`, set by the server only.
- A video with an **open** report is not purged until the report is resolved.
- Posters are never purged.

**Copy (exact text)**
- "Videos can be up to 60 seconds." (iOS refusal)
- "Videos can be up to 60 seconds and 50 MB." (web refusal)
- "Couldn't send that video — try again."
- "Video expired"
- "Expires in N days" (and "Expires today", "Expires in 1 day")
- "🎥 Video" / "🎥 <caption>" (previews)
- "Sent a video" (push)
- "Chat videos on this iPhone: N MB" + "Clear"

**Behaviour**
- iOS copies live in `Application Support/ChatVideos/<message_id>.mp4`, excluded from backup. Web copies live in IndexedDB keyed by message id. The web calls `navigator.storage.persist()` once.
- Download starts when the bubble appears, not on tap. The sender's own file is stored under the new message id right after sending.
- Videos have no Copy or Save to Photos. Reply, react, report and block work as on any message.

**Project rules**
- Legal gate: Privacy Policy (md + `PrivacyPage.tsx`) and Terms (md + `TermsPage.tsx` + iOS `TermsView.swift`) in this same PR; bump "Last updated".
- Never reset or seed the shared local DB. Apply migrations with `docker exec -i supabase_db_RecBuddy psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < file`.
- Known unrelated failures:
  - Web `search_athletes`.
  - DB `coach-signup` and "two head coaches via redeem". Both are stale tests.

## Review Focus

1. **Old copy vs. new message:** a sender's message id changes from the optimistic one to the inserted one. The sender's local copy must be saved under the *inserted* id, or they'll download their own clip (or see "Video expired" after 7 days).
2. **Expired with a local copy:** after `media_purged_at` is set, a device that has the file must still play it. The "expired" state applies only when there's no local copy. *(Task 8 and Task 11 tests.)*
3. **Expired on a new device:** the poster still renders (posters aren't purged) with "Video expired" and no play button. A dead signed-URL request must not show an error toast. *(Task 8 test.)*
4. **Very short clips, portrait, and HEVC `.mov` on web:** metadata may report `duration` as `Infinity` or `NaN`, or the browser may fail to decode. Send without a poster rather than refusing; refuse only when the duration is a finite number over 60. *(Task 7 test.)*
5. **Report hold racing purge:** a report filed after the purge job has already listed a video must not cause an error. The file is already gone; the report still references the message. *(Task 3 test: purge marks only what it deleted.)*

---

### Task 1: The `video` message kind

**Files:**
- Create: `supabase/migrations/20261024100000_video_kind.sql`
- Test: `supabase/tests/videos.test.ts` (new; grows in Tasks 2–3)

**Interfaces:**
- Produces: `message_kind` value `'video'`.

- [ ] **Step 1: Write the failing test** `describe('video kind')` → `it('a member can post a video message row')`. As a thread member, insert a video message with a valid payload: a fake path in the thread folder, `poster` likewise, `w` 720, `h` 1280, `duration_s` 12. Expect no error. (This passes fully only after Task 2 adds the trigger.)
- [ ] **Step 2: Run** `npx vitest run supabase/tests/videos.test.ts`. Expected: FAIL, `invalid input value for enum message_kind: "video"`.
- [ ] **Step 3: Implement** `alter type message_kind add value if not exists 'video';`. Postgres can't use a new enum value in the same transaction it was added in, so this goes in its own migration.
- [ ] **Step 4: Apply and run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(chat): video message kind`.

### Task 2: Storage, expiry column and server checks

**Files:**
- Create: `supabase/migrations/20261024110000_chat_videos.sql`
- Test: `supabase/tests/videos.test.ts`

**Interfaces:**
- Produces:
  - Bucket `chat-videos`.
  - Columns `messages.expires_at timestamptz` and `messages.media_purged_at timestamptz`.
  - `chat_video_owner(p_path text) returns uuid` (service role only, mirrors `chat_image_owner`).
  - Policies `chat_videos_select` and `chat_videos_insert`. `chat_images_select` is extended to posters.

- [ ] **Step 1: Write failing tests** in `videos.test.ts`:
  - `expires_at is set by the server`: insert with `expires_at: '2099-01-01'`, then read it back. Expect it within 5 s of `created_at + 7 days`.
  - `refuses a 61-second clip`: `duration_s: 61` → error matching `/60 seconds/`.
  - `refuses a path or poster outside the thread folder`: the path is in another thread's folder → error.
  - `video read rules match photos`: upload a small `video/mp4` blob as member A, then post the message. Then:
    - A member can `createSignedUrl` on it.
    - A non-member can't.
    - A member who joined after it was sent can't.
    - A member who blocked the sender can't.

    Reuse the setup style of the photo tests in `conversations.test.ts`.
  - `members can read the poster of a video`: the poster is in `chat-images`, and a member can `createSignedUrl`.
- [ ] **Step 2: Run.** Expected: those tests FAIL.
- [ ] **Step 3: Implement the migration**:
  - The bucket insert, with limits from Global Constraints.
  - The two columns.
  - Index `messages_video_path_idx on messages ((payload->>'path')) where kind = 'video'`.
  - A `before insert` trigger `video_message_guard` on video messages:
    - Set `expires_at := new.created_at + interval '7 days'`.
    - Require `0 < duration_s <= 60` (message: `videos can be up to 60 seconds`).
    - Require `w`/`h` > 0.
    - Require `path` and `poster` to start with `new.thread_id || '/'` and contain no `..`.
  - A `before update` guard so clients can't change `expires_at` or `media_purged_at` (`auth.uid() is not null` → keep the old values).
  - Storage policies copied from `chat_images_select` / `chat_images_insert` in `20261019130000_conversations.sql`, using bucket `chat-videos` and `kind = 'video'`.
  - Recreate `chat_images_select` so its `exists` also matches `m.kind = 'video' and m.payload->>'poster' = storage.objects.name`.
  - `chat_video_owner`.
- [ ] **Step 4: Apply and run** `npx vitest run supabase/tests/videos.test.ts supabase/tests/conversations.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(chat): chat-videos bucket, expiry and server checks`.

### Task 3: Purge expired videos

**Files:**
- Create: `supabase/migrations/20261024120000_purge_chat_videos.sql`, `supabase/functions/purge-chat-videos/index.ts`
- Test: `supabase/tests/videos.test.ts`

**Interfaces:**
- Produces:
  - `expired_videos(p_limit int default 500) returns table (id uuid, path text)`. Service role only. Returns rows where `kind='video'`, `expires_at < now()` and `media_purged_at is null`, with no `content_reports` row for the message having `status = 'open'`.
  - `mark_videos_purged(p_ids uuid[]) returns void`. Service role only.
  - The edge function, called by POST with the service-role bearer token.

- [ ] **Step 1: Write failing tests**:
  - `purge deletes an expired file and marks the message`:
    1. Post a video as a member.
    2. With `admin()`, set `expires_at = now() - interval '1 minute'`.
    3. Call the function at `${SUPABASE_URL}/functions/v1/purge-chat-videos` with the service key.
    4. Expect the storage object to be gone (`admin().storage.from('chat-videos').list(threadId)`), `media_purged_at` to be set, and the poster to still exist.
  - `purge skips a video with an open report, and deletes it once the report is dismissed`.
  - `purge leaves unexpired videos alone`.
  - `a client cannot call expired_videos`: as an authenticated user, the RPC errors.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** the SQL functions (revoke from `public, anon, authenticated`). Then write the function:
  1. Reject unless the bearer is the service-role key.
  2. Loop: call `expired_videos(500)`, then `storage.from('chat-videos').remove(paths)`.
  3. Call `mark_videos_purged` with the ids whose paths were removed or were already missing.
  4. Repeat until it gets fewer than 500 rows. Return `{ purged: n }`.
- [ ] **Step 4: Add the cron schedule** in the same migration:
  - `create extension if not exists pg_cron;`
  - `cron.schedule('purge-chat-videos', '15 3 * * *', $$ ... $$)`. The command reads `vault.decrypted_secrets` for names `purge_videos_url` and `service_role_key` and calls `net.http_post`. It does nothing when either secret is missing (so local works without setup).
- [ ] **Step 5: Serve and run.** `supabase functions serve` is already serving locally, as `coach-signup` responds. Run `npx vitest run supabase/tests/videos.test.ts`. Expected: PASS.
- [ ] **Step 6: Commit** `feat(chat): purge expired chat videos daily`.

### Task 4: Push, report and admin handling

**Files:**
- Modify:
  - `supabase/functions/notify-message/index.ts:8`
  - `supabase/functions/notify-report/render.ts:32`
  - `supabase/functions/admin-action/index.ts:56-66`
- Test: `supabase/tests/notify_report_render.test.ts`, plus the existing notify-message title/body test (find it with `grep -rn "Sent a photo" supabase/tests`).

- [ ] **Step 1: Write failing tests**:
  - The push body for a video is `Sent a video`.
  - The report render for a video is `[Video: chat-videos/<path>] — caption: <body>`, and `[Video: chat-videos/<path>]` without a caption.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** the two `case 'video'` branches. In `admin-action`, for `kind === 'video'`:
  - Run the same own-file check using `chat_video_owner`.
  - Remove the video from `chat-videos` and the poster from `chat-images` (the poster gets the same thread-folder check).
  - Log `video_removed`.
- [ ] **Step 4: Run** `npx vitest run supabase/tests`. Expected: only the 2 known failures.
- [ ] **Step 5: Commit** `feat(chat): video push, report and admin removal`.

### Task 5: Web types and previews

**Files:**
- Modify:
  - `apps/coach-web/src/lib/types.ts:48,62`
  - `lib/conversations.ts:24`
  - `lib/messageText.ts:11,48`
  - `lib/adminFormat.ts:33`
- Test: `lib/conversations.test.ts`, `lib/messageText.test.ts`, `lib/adminFormat.test.ts`

**Interfaces:**
- Produces:
  - `MessageKind` includes `'video'`.
  - `interface VideoCard { path: string; poster: string | null; w: number; h: number; duration_s: number }`.
  - `Message` gains `expires_at?: string | null; media_purged_at?: string | null`.

- [ ] **Step 1: Write failing tests**:
  - `previewLine` gives `🎥 Video`, or `🎥 Nice form` with a caption.
  - The quote preview gives `🎥 Video`.
  - The copy text for a video is `null` (no Copy).
  - The admin format gives `[Video] <caption>`.
- [ ] **Step 2: Run** `npx vitest run src/lib`. Expected: FAIL.
- [ ] **Step 3: Implement** the cases.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(coach-web): video message type and previews`.

### Task 6: Web local video store

**Files:**
- Create: `apps/coach-web/src/lib/videoStore.ts`
- Test: `apps/coach-web/src/lib/videoStore.test.ts`
- Dev dependency: `fake-indexeddb` (test only).

**Interfaces:**
- Produces:
  - `getVideo(messageId: string): Promise<Blob | null>`
  - `putVideo(messageId: string, blob: Blob): Promise<void>`
  - `requestPersistence(): Promise<void>` (calls `navigator.storage?.persist?.()` once per session; never throws)
  - Database name `recbuddy-chat-videos`, store `videos`.

- [ ] **Step 1: Write failing tests** with `fake-indexeddb/auto`:
  - `put then get returns the same bytes`.
  - `get of an unknown id is null`.
  - `get resolves null (not throws) when indexedDB is unavailable`.
- [ ] **Step 2: Run.** Expected: FAIL (module missing).
- [ ] **Step 3: Implement** a small promise wrapper over `indexedDB.open`. No other dependency.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(coach-web): keep chat videos in IndexedDB`.

### Task 7: Web sending

**Files:**
- Create: `apps/coach-web/src/lib/videoFile.ts`
- Modify:
  - `apps/coach-web/src/lib/queries/chat.ts`: add `sendVideoMessage` and `useSendVideo` next to `sendImageMessages`.
  - `features/messages/ThreadView.tsx`: the paste handler around :339, plus drag-and-drop and the attach input's `accept`.
- Test: `lib/videoFile.test.ts`, `features/messages/ThreadView.test.tsx` (or the composer's existing test file)

**Interfaces:**
- Consumes: `putVideo` (Task 6), `compressImage` (`lib/compressImage.ts:4`).
- Produces:
  - `isVideoFile(f: File): boolean` (true for `video/mp4` or `video/quicktime`).
  - `checkVideo(f: File, readDuration?: (f: File) => Promise<number>): Promise<{ ok: true; duration: number } | { ok: false; error: string }>`
  - `posterFrame(f: File): Promise<{ blob: Blob; w: number; h: number } | null>`
  - `sendVideoMessage(client, threadId, file: File, body?: string, replyToId?: string | null): Promise<string>`. Returns the inserted message id.

- [ ] **Step 1: Write failing tests** for `checkVideo`:
  - 61 s → `{ ok:false, error:'Videos can be up to 60 seconds and 50 MB.' }`.
  - 51 MB with 10 s → the same error.
  - 30 s and 5 MB → ok.
  - `Infinity` or `NaN` duration → ok with `duration: 0` (Review Focus 4).
- [ ] **Step 2: Write a failing component test**: pasting a `video/mp4` File stages it with a "0:30" badge, and pressing Send calls `useSendVideo().mutate` with that file and the caption. Pasting a 61-second file shows the refusal and stages nothing.
- [ ] **Step 3: Run.** Expected: FAIL.
- [ ] **Step 4: Implement**:
  - `checkVideo`: duration comes from a hidden `<video preload="metadata">`; refuse only a finite duration over 60.
  - `posterFrame`: seek to 0.5 s, draw on a canvas, pass to `compressImage`. Returns null if decoding fails.
  - `sendVideoMessage` does three things:
    1. Uploads the file (`contentType` = file type), and the poster if there is one (payload `poster: null` otherwise).
    2. Inserts the message with `select('id').single()`.
    3. Calls `putVideo(id, file)` (Review Focus 1).

    On any failure it throws, and the composer shows "Couldn't send that video — try again." and keeps the staged clip.
  - One video per message. Mixed photo and video batches send each as its own message, with the caption on the last one, as photos do.
- [ ] **Step 5: Run** `npx vitest run src/lib/videoFile.test.ts src/features/messages`. Expected: PASS.
- [ ] **Step 6: Commit** `feat(coach-web): send chat videos by paste, drop or pick`.

### Task 8: Web playback bubble

**Files:**
- Create: `apps/coach-web/src/features/chat/VideoView.tsx`, `apps/coach-web/src/lib/videoExpiry.ts`
- Modify: `features/chat/MessageItem.tsx:207` (add a `m.kind === 'video'` branch shaped like the image branch)
- Test: `lib/videoExpiry.test.ts`, `features/chat/VideoView.test.tsx`

**Interfaces:**
- Consumes: `getVideo` and `putVideo` (Task 6), `useSignedImageUrl` (posters), `VideoCard` (Task 5).
- Produces:
  - `expiryLabel(expiresAt: string, now: Date): string | null`. Returns null when more than 7 days remain.
  - `videoState({ hasLocal, purged, expired }): 'local' | 'remote' | 'expired'`

- [ ] **Step 1: Write failing tests**:
  - `expiryLabel`:
    - 3 days 2 hours left → `Expires in 3 days`.
    - 20 hours left → `Expires today`.
    - 1 day 5 hours left → `Expires in 1 day`.
  - `videoState`:
    - `{hasLocal:true, purged:true}` → `'local'` (Review Focus 2).
    - `{hasLocal:false, purged:true}` → `'expired'`.
    - `{hasLocal:false, purged:false, expired:false}` → `'remote'`.
  - `VideoView`:
    - It renders the poster, a play button and a `0:42` badge.
    - The expired state shows "Video expired", has no play button, and makes no signed-URL request for the video (Review Focus 3).
    - Clicking play opens a dialog with `<video controls autoplay playsinline>`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** `VideoView`. When it scrolls into view (IntersectionObserver) and there's no local copy and the clip hasn't expired:
  1. Fetch a signed URL from `chat-videos`.
  2. Download the blob.
  3. Call `putVideo`.

  Play from `URL.createObjectURL(blob)`. Call `requestPersistence()` on first mount. The "Expires in …" muted line shows only when there's no local copy.
- [ ] **Step 4: Run** `npx vitest run src/features/chat src/lib/videoExpiry.test.ts`. Expected: PASS.
- [ ] **Step 5: Run the full web suite and build** (`npx vitest run && npm run build`). Expected: only the known `search_athletes` failure.
- [ ] **Step 6: Commit** `feat(coach-web): play chat videos and show expiry`.

### Task 9: iOS model, text and local store

**Files:**
- Create: `apps/athlete-ios/RecBuddy/Lib/ChatVideo.swift`
- Modify:
  - `Lib/Conversations.swift:60` (preview)
  - `Lib/MessageText.swift:10,42` (no Copy; quote preview)
  - `Lib/Models.swift` (`Message` gains `expiresAt: String?` and `mediaPurgedAt: String?` with snake-case keys)
- Test: `RecBuddyTests/ChatVideoTests.swift`

**Interfaces:**
- Produces:
  - `enum VideoText`:
    - `static func expiry(expiresAt: Date, now: Date) -> String?` (same rules as web `expiryLabel`).
    - `static func duration(_ s: Int) -> String` (`"0:42"`, `"1:00"`).
    - `static let tooLong = "Videos can be up to 60 seconds."`
    - `static let sendFailed = "Couldn't send that video — try again."`
  - `enum VideoState { case local, remote, expired }` with `static func of(hasLocal: Bool, purged: Bool, expired: Bool) -> VideoState`.
  - `struct VideoStore` with `init(root: URL)`, `static let shared` (root `Application Support/ChatVideos`) and these methods:
    - `url(for messageId: String) -> URL?` (nil when absent)
    - `save(_ data: Data, messageId: String) throws` (sets `isExcludedFromBackup`)
    - `adopt(file: URL, messageId: String) throws`
    - `totalBytes() -> Int`
    - `clear() throws`
  - `VideoPrep.check(duration: Double) -> String?` (returns `VideoText.tooLong` when over 60).

- [ ] **Step 1: Write failing tests**:
  - Duration formatting.
  - Expiry labels (the three cases from Task 8).
  - The `VideoState` table, including local and purged → `.local`.
  - `VideoStore` in a temp dir: save, then url; `totalBytes`; `clear` empties it; the saved file has `isExcludedFromBackup == true`.
  - `VideoPrep.check(duration: 61)` returns the refusal text, and `check(duration: 60)` returns nil.
  - Inbox preview: `🎥 Video` or `🎥 Nice form`.
  - `MessageText.copyText` for a video is nil.
- [ ] **Step 2: Run** `xcodegen generate` and the test command from Global Constraints. Expected: build FAIL (types missing).
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run tests.** Expected: all pass.
- [ ] **Step 5: Commit** `feat(athlete-ios): chat video model, text and local store`.

### Task 10: iOS sending

**Files:**
- Create: `apps/athlete-ios/RecBuddy/Lib/VideoPrep.swift` (the AVFoundation half of `VideoPrep`)
- Modify:
  - `Stores/ChatStore.swift`: `sendVideo` next to `sendImage` at :130.
  - `Views/Chat/ChatView.swift`: picker at :601 accepts `.any(of: [.images, .videos])`; staging at :817–845 gains a video case.
  - `Views/Chat/ComposerTextView.swift`: `PastingTextView`, :72–92.

**Interfaces:**
- Consumes: `VideoStore`, `VideoText`, `ImageShrink.jpegForChat`.
- Produces:
  - `VideoPrep.prepare(source: URL) async throws -> PreparedVideo`, where `PreparedVideo = (file: URL, poster: Data, w: Int, h: Int, duration: Int)`. It throws `VideoPrep.Refusal.tooLong` over 60 s.
  - `ChatStore.sendVideo(_ v: PreparedVideo, from: String, body: String?, replyTo: String?) async throws -> String`. Returns the message id and adopts the file into `VideoStore`.
  - `PastingTextView.onPasteVideo: ((URL) -> Void)?`

- [ ] **Step 1: Implement `VideoPrep.prepare`**:
  - Read the duration, and refuse first if it's too long.
  - Export with `AVAssetExportPreset1280x720`, `.mp4`, `shouldOptimizeForNetworkUse = true`.
  - Make the poster with `AVAssetImageGenerator` at 0.5 s (`appliesPreferredTrackTransform = true`), then `ImageShrink.jpegForChat`.
  - Take `w`/`h` from the transformed natural size.
- [ ] **Step 2: Implement `sendVideo`**:
  1. Upload the poster to `chat-images` and the video to `chat-videos` (`video/mp4`).
  2. Insert the message, selecting the id.
  3. `VideoStore.shared.adopt(file:messageId:)`.
  4. Reload.
- [ ] **Step 3: Implement staging and paste**:
  - **Picker:** `loadTransferable(type: Movie.self)`, a `Transferable` that copies the file to a temp URL.
  - **Paste:** `canPerformAction` also returns true when `UIPasteboard.general.contains(pasteboardTypes: [UTType.movie.identifier])` (this doesn't read the pasteboard). `paste` writes the movie data to a temp URL and calls `onPasteVideo`.
  - **Staged tile:** shows "Preparing…" while `prepare` runs, then the poster with an X. Upload failures show `VideoText.sendFailed` and keep the tile.
- [ ] **Step 4: Build and run the tests.** Expected: pass. Install on the simulator and check by hand:
  - Pick a video from Photos (the simulator ships with none; `xcrun simctl addmedia <udid> <file.mp4>` adds a test clip).
  - Paste a clip.
  - Send with a caption.
  - Check a 61 s clip is refused with the exact text.
- [ ] **Step 5: Commit** `feat(athlete-ios): send chat videos by picking or pasting`.

### Task 11: iOS playback and storage setting

**Files:**
- Create: `apps/athlete-ios/RecBuddy/Views/Chat/VideoBubble.swift`
- Modify:
  - `Views/Chat/MessageRow.swift:323`: add `case "video"` like the image case.
  - `Views/Account/AccountSheet.swift`: a storage row in Preferences.

**Interfaces:**
- Consumes: `VideoStore`, `VideoState`, `VideoText`, the existing signed-URL loader for posters (`ChatImageLoader`).

- [ ] **Step 1: Implement `VideoBubble`**:
  - It shows the poster, a play glyph and the duration badge.
  - `.task` on appear: if `VideoStore.shared.url(for:)` is nil and the state is `.remote`, sign the `chat-videos` URL, download it and `save`.
  - Tapping presents `AVPlayerViewController` (via a `UIViewControllerRepresentable`) on the local file.
  - The `.expired` state dims the poster, shows "Video expired" and has no play glyph.
  - The muted "Expires in …" line shows only for `.remote`.
- [ ] **Step 2: Add the AccountSheet row**: "Chat videos on this iPhone: N MB" (`ByteCountFormatter`, `.file`), with a "Clear" button that calls `VideoStore.shared.clear()` and refreshes the size.
- [ ] **Step 3: Build, run tests, and check on the simulator**:
  1. Send a clip from the web or the simulator, and watch it play inline and full screen.
  2. With `admin()` or SQL, set `media_purged_at` and delete the storage file. Relaunch: it still plays from the local copy.
  3. Clear in Settings, relaunch: it shows "Video expired".
- [ ] **Step 4: Commit** `feat(athlete-ios): play chat videos, keep copies, clear in Settings`.

### Task 12: Legal docs and deploy notes

**Files:**
- Modify:
  - `docs/appstore/privacy-policy.md`, `apps/coach-web/src/routes/legal/PrivacyPage.tsx`: Communications gains videos plus the retention sentence.
  - `docs/appstore/terms.md`, `apps/coach-web/src/routes/legal/TermsPage.tsx`, `apps/athlete-ios/RecBuddy/Views/Account/TermsView.swift`: §9 lists videos.
  - Bump "Last updated" in all of them.
- Test: `routes/legal/PrivacyPage.test.tsx`, `routes/legal/TermsPage.test.tsx`

- [ ] **Step 1: Write failing tests**:
  - The Privacy page contains `deleted from our servers 7 days after they're sent`.
  - The Terms page lists `videos`.
  - Both show the new date.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement**:
  - The retention sentence (exact): "Videos you send in chat are deleted from our servers 7 days after they're sent. Copies already saved on a participant's device stay on that device under their control."
- [ ] **Step 4: Run the full web suite, DB suite and iOS tests.** Expected: only the known failures.
- [ ] **Step 5: Commit** `docs(legal): chat videos in Privacy Policy and Terms`. In the PR description, list these deploy notes:
  - The 3 migrations.
  - The `purge-chat-videos` function.
  - The Vault secrets `purge_videos_url` and `service_role_key` (dev and prod).
  - "Confirm Photos or Videos in the App Store privacy label".
  - Ship with iOS 1.1.
