# Screen Off — YouTube & Music (v0.3.0)

Standalone native Android app in `lafrich/Laifu/apps/youtube-screenoff`. Laifu game remains untouched.

## Main features
- **YouTube** and **Music** browsing tabs.
- **Player** tab displays the currently playing song and queue.
- **Persistent compact mini-player** below the tabs with **previous / play-pause / next**, **±15 seconds**, **scrubbing/progress**, and **playback speed 1× / 1.25× / 1.5× / 2×**.
- Media3 `MediaSessionService` posts Android's **system media controls while minimized/locked**. Previous and next depend on the playlist having multiple items. **Speed change is in the app**, not guaranteed in the system notification.
- **▶ PUTAR** resolves the current YouTube video/audio and replaces the active queue.
- **+ ANTREAN** resolves the selected song and appends it to the current queue. When one track ends, ExoPlayer advances automatically.
- The background service and mini-player use the same MediaSession and share playback state.
- Supports Android 8+, no root.

## How to test the queue
1. Open YouTube or Music, select a public video/song. Tap **▶ PUTAR**.
2. Pick another song and tap **+ ANTREAN**.
3. Tap **Player** or minimize the app. Next/Previous becomes available when another track has been added. The app's **±15**, seekbar and speed control let you move within the current track.
4. Lock the screen to test Android's built-in media notification and headset controls.

**Limitations**: This is **not YouTube Premium** and doesn't implement YouTube Music's private library, downloads, DRM or authenticated access. Playlist imports and recommendation autoplay are **not implemented**—songs are queued individually. The unofficial NewPipeExtractor can break due to YouTube changes; if the extractor fails, a successful APK build does not imply playback will work.

## Build APK
GitHub Actions → `YouTube Screen Off APK` → latest successful run → `youtube-screenoff-debug-apk` artifact → extract `app-debug.apk`.

Local build (JDK 17, Android SDK 35, Gradle 8.10.2):
```sh
cd apps/youtube-screenoff
gradle :app:assembleDebug
```
APK: `app/build/outputs/apk/debug/app-debug.apk`

Debug signing keys can differ across GitHub Actions builds. If Android rejects an update, uninstall the previous debug APK and install the new one (app cookies/history may be removed).

## Source / license
This app uses [NewPipeExtractor](https://github.com/TeamNewPipe/NewPipeExtractor), GPL-3.0-or-later; redistribute with the relevant GPL terms and source code. Also uses AndroidX Media3, OkHttp and Guava. No Accessibility Service, root or tracking.
