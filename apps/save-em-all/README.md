# Save em all — by Lafrich

Android stream and media downloader. Independent application in the Laifu repository,
using original retro Winamp-inspired dark-metal panels, green LCD, compact controls
and typography in the same spirit as Free Youtube by Lafrich.

## Features
- Paste a supported HTTP(S) page or direct media link and inspect its title.
- In-app WEB tab, share-to-app support, and capture links exposed through a site's download handler.
- Download modes: best video, video up to 720p, audio MP3, original stream.
- Background foreground-service queue, progress, cancel, completed history.
- Files exported to the Android public Downloads/Save em all folder using MediaStore.
- All history is stored locally; no server, login or tracking.

## Build
Requires JDK 17, Gradle 8.10.2, Android SDK API 35, Android 10+.
GitHub Actions -> Save em all APK -> latest successful run -> save-em-all-debug-apk.
Local: gradle -p apps/save-em-all :app:assembleDebug

Separate Android package: art.lafrich.saveemall. This project does not
modify the existing Free Youtube application or Laifu game.

## Supported sources and limitations
yt-dlp-android / FFmpeg 0.18.1 provides broad website and stream compatibility,
including supported site pages, direct video/audio, HLS and DASH when accessible.
Not every website works: DRM, paid/encrypted streams, expiring signed URLs,
site anti-bot checks, authentication/cookies and extractor changes can block downloads.
The app does not defeat DRM, steal browser cookies or circumvent authentication.
The embedded browser does not automatically pass session cookies to yt-dlp.
No promises of universal site coverage. Download only content you own or may save.

This application includes the GPL-3.0-licensed youtubedl-android / yt-dlp
dependency. Distribution of compiled APKs must comply with applicable licenses.
