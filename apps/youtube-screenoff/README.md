# YouTube Screen Off · Android
A small standalone Android project **inside the Laifu repository**. It does **not** modify the Laifu game.

## Features
- Browse \`m.youtube.com\` inside the app.
- Paste a YouTube watch / Shorts / live URL, or share a video to this app.
- Tap **PUTAR AUDIO • LAYAR MATI** to resolve an audio-only stream and start a system media session.
- Lock the Android screen with the physical power button. Audio is handled by Media3's foreground playback service with lock-screen / notification play-pause controls.

## Install / build
Go to **Actions → YouTube Screen Off APK → Run workflow**, then open the successful run and download the \`youtube-screenoff-debug-apk\` artifact. Extract the ZIP and install \`app-debug.apk\` on Android 8+.

Local build (requires Java 17, Android SDK API 35 and Gradle 8.10.2):
\`\`\`sh
cd apps/youtube-screenoff
gradle :app:assembleDebug
\`\`\`
Output: \`app/build/outputs/apk/debug/app-debug.apk\`.

## Known limits (important)
- **This is NOT the official YouTube app / YouTube Premium.** Browsing happens in WebView; tapping the red button starts **audio-only** playback through an independent media service.
- YouTube WebView does not provide reliable background playback. The app resolves public audio URLs using NewPipeExtractor, so no guarantee every video will work; extraction can break when YouTube changes its site and may have service-terms implications.
- Google/YouTube account login in embedded WebView may not work, and private, DRM, members-only or age-restricted videos may not play.
- This is a source project with CI build. Functionality on an actual phone and success of the APK build still require testing.
- If your phone aggressively restricts background apps, allow background activity / disable battery optimization for this app.

## Dependencies and licenses
- [NewPipeExtractor](https://github.com/TeamNewPipe/NewPipeExtractor) is GPL-3.0-or-later. The Android module should be distributed under GPL-3.0-or-later with the license notice and corresponding source.
- [AndroidX Media3](https://developer.android.com/media/media3) handles playback, media session and foreground notification.
- [OkHttp](https://square.github.io/okhttp/) handles HTTPS extraction requests.
- No ads, tracking, root access, Accessibility Service or elevated system privileges.
