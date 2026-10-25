# Chat Videos — Design

**Date:** 2026-10-24
**Branch:** `feat/chat-videos` (off `feat/chat-enhancements`, PR #68)
**Status:** approved by Kevin 2026-10-24

## Why

Athletes and coaches want to send short clips in chat, like a stride, a drill or a race finish, the same way they send photos today. Kevin wants this without RecBuddy paying to store every clip forever. A video can't go from phone to phone directly; it has to pass through our server. So the server keeps each clip only long enough for everyone to get it, and each device that plays a clip keeps its own copy.

## Decisions Kevin made

- **Expiring clips.** Each video is compressed to 720p and capped at 60 seconds. The server deletes the file 7 days after it was sent. A device that has the clip keeps playing it from its own copy. After the 7 days, anyone who never got the clip sees "Video expired".
- **Both apps send and watch.** Athletes send from iOS by pasting into the message box or picking from Photos. Coaches send from the web by pasting, dragging or picking a file. Both apps play videos.
- **Web uploads aren't compressed.** The browser can't compress video well, so web uploads are capped at 60 seconds and 50 MB and sent as they are.
- **Separate branch and PR.** Videos ship after PR #68.

## Goals

- Send a video in any conversation (team, 1:1, group) from iOS or web, with an optional caption, the same way a photo works.
- Watch it inline as a poster frame with a play button, and full screen on tap.
- Keep server storage roughly flat: no video file lives on the server for more than 7 days, apart from the report hold below.
- Make sure someone who opens the chat within those 7 days still has the clip afterwards.

## Non-goals

- Trimming or editing. A clip over 60 seconds is refused with a clear message.
- Saving to Photos, forwarding, or Copy for videos. The video menu has Reply, React, Report and Block, but no Copy.
- Streaming or adaptive bitrate. Clips are small enough to download whole.
- Keeping videos past 7 days for anyone, including paid tiers.
- Backfilling or recompressing existing photos.

## Anti-goals (shipping any of these counts as a failure)

- A video stays on the server past its expiry, apart from the report hold below. The whole point is to keep storage small.
- A clip someone watched disappears from their phone on day 8.
- Someone who couldn't read the message can play the video, for example after a block, or a member who joined after it was sent. Videos follow exactly the same read rules as photos.
- An oversized or over-long upload gets through by skipping the client-side check. The server must enforce limits too.
- Legal docs lag the feature (repo `CLAUDE.md` legal gate).

## How it works

### Storage

- **Bucket:** a new private bucket, `chat-videos`, with `file_size_limit` 50 MB and `allowed_mime_types` `video/mp4` and `video/quicktime`.
- **Path:** `<thread_id>/<uuid>.mp4`, the same convention as `chat-images`.
- **Policies:** copy the current `chat_images_select` and `chat_images_insert` from `20261019130000_conversations.sql`:
  - Read: the uploader, or anyone who `can_read_message` a `kind='video'` message whose `payload->>'path'` is this file, unless they've blocked the sender.
  - Upload: `can_post_thread`, and the uploader isn't suspended.
  - Add an index on `payload->>'path'` for video messages.
- **Posters:** the poster frame (a JPEG, about 1280px on the long edge) goes in the existing `chat-images` bucket at `<thread_id>/<uuid>.jpg`. It is **not** deleted when the video expires, because posters are small and an expired bubble still shows its thumbnail. *(My call.)* The `chat_images_select` policy must also allow reading a file that is the `poster` of a readable video message.

### The message

- **Kind:** a new `message_kind` value, `'video'`.
- **Body:** the optional caption. It goes through the existing language filter, like any message body.
- **Payload:** `{ path, poster, w, h, duration_s }`.
- **New columns on `messages`:** `expires_at timestamptz` and `media_purged_at timestamptz`. A trigger sets `expires_at = created_at + interval '7 days'` for video messages, so the client can't choose it.
- **Server-side checks** in a `before insert` trigger on video messages:
  - `duration_s` is between 0 and 60.
  - `path` and `poster` are in this thread's folder.
  - `w` and `h` are positive.

  The bucket enforces size and file type. *(My call: putting the checks in the trigger means the clients can't skip them.)*
- **Inbox:** the preview reads "🎥 Video", or "🎥 caption" when there's a caption.
  - Web: `previewLine` in `lib/conversations.ts`.
  - iOS: `Conversations.swift:60`.
- **Push notification:** "Sent a video" (`notify-message/index.ts`).

### Expiry

- A daily `pg_cron` job (enable the extension in a migration) uses `pg_net` to call a new edge function, `purge-chat-videos`, with the service-role key.
- The function finds video messages where `expires_at < now()` and `media_purged_at is null`, deletes their files through the Storage API (not a SQL delete, which would leave the files behind), and sets `media_purged_at`.
- It handles 500 messages per run and repeats until none are left.
- **Report hold:** a video on a message with an **open** report is skipped until the report is resolved, so admins still have the evidence. *(Kevin: hold them.)*
- `admin-action`'s "remove message" deletes the video and poster files the same way it handles photos today (`admin-action/index.ts:62`), and makes the same owner check, extended to `chat-videos`.
- `notify-report/render.ts` shows `[Video: chat-videos/<path>]` plus the caption.
- **Local vs prod:** the cron schedule lives in a migration. The function URL and key come from Vault secrets, which must be set per environment; list this in the PR deploy notes. Locally, the builder runs the function by hand in tests.

### The copy on each device

- **iOS**
  - Clips are stored in `Application Support/ChatVideos/<message_id>.mp4`, excluded from iCloud backup. Not `Caches`: iOS can empty that folder under storage pressure, which would make a watched clip vanish.
  - **When it downloads:** when the bubble scrolls into view, not on tap, so opening the chat within 7 days is enough. *(My call.)* Downloads run on any network; a 60s 720p clip is about 5–10 MB.
  - The sender's compressed file goes into the store under the new message id right after it sends, so it's never downloaded again.
  - **Cleanup:** clips for threads the user has left or hidden can be deleted. Settings shows "Chat videos on this iPhone: N MB" with a Clear button. *(Kevin: keep it.)*
- **Web**
  - Played or sent clips are kept in IndexedDB, keyed by message id, using the same scroll-into-view download.
  - Browsers can evict this storage, so the web copy is best effort. The app calls `navigator.storage.persist()` once to make eviction less likely. *(My call. The web can't promise a permanent copy, and coaches on the web are the likeliest to see "Video expired" on a new browser.)*
- **Expired and not on this device:** the bubble shows the poster dimmed, with "Video expired" and no play button.

### Sending on iOS

- **Picking:** `PhotosPicker` accepts `.videos` as well as images.
- **Pasting:**
  - `ComposerTextView.canPerformAction` allows paste when the pasteboard has a movie (`UTType.movie`), using the same "doesn't read the pasteboard" check it uses for images today (`ComposerTextView.swift:77`).
  - It stages the video like a photo: a thumbnail with an X and a caption field.
- **Compressing:** `AVAssetExportSession` with `AVAssetExportPreset1280x720`, `.mp4`, `shouldOptimizeForNetworkUse = true`.
- **Poster:** `AVAssetImageGenerator` at 0.5 seconds, saved as a JPEG by the existing `ImageShrink`.
- **Over 60 seconds:** refused at staging with "Videos can be up to 60 seconds."
- **Progress:** a staged video shows "Preparing…" while it compresses and a progress ring while it uploads. The message is posted only after both uploads succeed. If either fails, the composer shows "Couldn't send that video — try again." and keeps the staged clip.
- **Batches:** one video per message. Photos and a video can be staged together; each becomes its own message, and the caption goes on the last one, as photos do today.

### Sending on web

- **Ways in:** paste, drag-and-drop onto the thread, or the attach button. All accept `video/mp4` and `video/quicktime`.
- **Checks before upload:**
  - Duration, read from a hidden `<video>` element's `loadedmetadata`.
  - Size, at most 50 MB.

  Over either limit, the clip is refused with "Videos can be up to 60 seconds and 50 MB."
- **Poster:** draw a frame at 0.5 seconds onto a canvas and run it through the existing `compressImage`.
- **Can't read the file:** if the browser can't decode it (for example HEVC `.mov` in some browsers), send it anyway without a poster. The bubble shows a plain video tile. *(My call.)*

### Playback

- **Bubble:** the poster at the photo bubble's size, a play glyph, and a duration badge such as "0:42". Under an unexpired video that isn't on this device yet, small muted text says "Expires in 3 days". *(My call: it tells people to open it.)*
- **Full screen:** iOS uses `AVPlayerViewController`. Web uses a lightbox with `<video controls autoplay playsinline>`.
- **Reactions, Reply and quotes** work on video messages like any other. A reply's quote preview reads "🎥 Video".

## Legal (same PR)

- **Privacy Policy, "Communications":** add videos. Add a retention line: video files are deleted from RecBuddy's servers 7 days after they're sent, and copies already saved on a participant's device stay there under that person's control. Update all three copies: `docs/appstore/privacy-policy.md`, `PrivacyPage.tsx` and the iOS terms view. Bump "Last updated".
- **Terms §9 "Your Content":** add videos to the listed content.
- **App Store privacy label:** confirm "Photos or Videos" is declared under User Content. If only photos were declared, update it in App Store Connect. That's Kevin's step, not done from code.
- **Account deletion:** no change needed for videos, since they expire. Note that photos aren't removed from storage on account deletion today. That's an existing gap, out of scope, and recorded here so it isn't lost.

## Rollout

- **Old apps:** iOS 1.0 builds draw unknown kinds as nothing (`MessageRow` `default: EmptyView()`), so a video and its caption are invisible there. Videos ship in iOS 1.1 with the conversations work. That's acceptable, because 1.0 can't see group chats either.
- **Migration order:**
  1. The enum value goes in its own migration (Postgres needs `alter type ... add value` committed before use).
  2. Then the bucket, columns, triggers and policies.
  3. Then cron.
- **Deploy notes:** the new edge function, the Vault secrets for the cron call, and the App Store label check.

## Testing

- **Database (`supabase/tests`):**
  - Video read rules match photos: a member can read; a non-member, a blocked sender and a member who joined later can't.
  - The trigger rejects a 61-second clip and a path in another thread's folder.
  - `expires_at` is set by the server even if the client sends one.
  - Purge deletes the expired file and sets `media_purged_at`.
  - Purge skips an expired video with an open report and deletes it after the report is resolved.
- **Web (vitest):**
  - The duration and size checks refuse over-limit files.
  - `previewLine` shows "🎥 Video".
  - The expired bubble shows "Video expired" with no play button.
  - The IndexedDB store keeps a sent clip under its message id.
- **iOS (Swift Testing):**
  - The video store saves, finds and clears clips by message id.
  - The expiry label text ("Expires in 3 days", "Video expired").
  - The inbox preview.
  - The 60-second refusal.
- **By hand:**
  - Simulator: paste a clip, pick a clip, send, watch, and check the copy plays again after the server file is deleted by hand.
  - Browser: Kevin checks web send and playback.

## Left to the builder

- Exact sizes, colors, the play glyph and the progress ring, matching the photo bubble.
- The IndexedDB wrapper (a tiny hand-rolled one is fine; no new dependency unless it's trivial).
- How the iOS video store is split into types, as long as the store is unit-testable without AVFoundation.
- The cron time of day.

## Kevin's answers (2026-10-24)

- **Settings "Clear chat videos" button:** keep it.
- **Reported videos:** keep them past 7 days until the report is resolved.
