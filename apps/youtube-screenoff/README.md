# Free Youtube — by Lafrich (v0.5.0)

Android app inside `lafrich/Laifu/apps/youtube-screenoff`, without changes to the Laifu game.

**Installed Android app name:** `Free Youtube` — “by Lafrich” appears only inside the app.

## Classic desktop-player style
**Doodle sketchbook UI:** warm cream paper background, rough black ink outlines,
red pencil highlights, casual handwritten fonts, sketched media controls and
history/playlist cards. The logo supplied by the user is adapted as a standalone
red scribbled play-button app icon (no title or credit on the icon).
The app label remains **Free Youtube**; **by Lafrich** appears only in the app header.

**Tabs:** VIDEO / MUSIC / PLAYER / HISTORY.

- VIDEO: embedded mobile YouTube browser.
- MUSIC: embedded YouTube Music browser.
- PLAYER: native Media3 player, queue and playlist details.
- HISTORY: up to **50 recently played tracks**, saved locally on the device.
  - Shows title, last-played time and playback position.
  - **LANJUT** plays from last saved position; **AWAL** starts at 0;
    **+ QUEUE** adds it to the playback queue.
  - **CLEAR** deletes local history after confirmation.
  - Records when a resolved stream actually plays, not when the user merely browses or queues it.
  - Position syncs about every five seconds and on pause/shutdown.
  - Tracks finished to the end start again from the beginning.
  - History starts with v0.4.0. It is not synced to your YouTube or Google account.

The bottom mini-player stays visible within the app: previous, play/pause,
next, skip ±15 seconds, progress/seek, and 1×/1.25×/1.5×/2× speed.
Android Media3 controls also work when the app is minimized/locked. Next works
once a second track is added manually to the queue.

## Getting an APK

GitHub Actions → **YouTube Screen Off APK** → latest successful run →
`youtube-screenoff-debug-apk` → unzip and install `app-debug.apk`.

Android 8+, min API 26. Same application ID `art.lafrich.screenoff`.

Local build (JDK 17, SDK 35, Gradle 8.10.2):
```sh
cd apps/youtube-screenoff
gradle :app:assembleDebug
```

**Upgrade caution:** GitHub-hosted debug APKs can be signed with different
debug keys. Android might reject an in-place upgrade. Uninstalling the old
app may delete history and cookies. Long-term signed upgrades should use
an intentionally managed stable release key.

## Limitations

Independent YouTube audio extraction uses GPL-3.0-or-later
[NewPipeExtractor](https://github.com/TeamNewPipe/NewPipeExtractor).
Extraction can break after YouTube updates; successful APK compilation
doesn't prove all videos will play. Private or protected content, DRM,
sign-in-restricted tracks, automatic YouTube Music playlist import,
Google listening history, and downloads are not implemented.
The Music page might have login restrictions in WebView.
No root / Accessibility Service required.
