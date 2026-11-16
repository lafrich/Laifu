# Save em all — by Lafrich (v0.4.0)

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

## v0.2.0: yt-dlp updates and proxies
- Automatic nightly yt-dlp binary update on app start/when downloading, checked at most every 12 hours; stable fallback when nightly is unavailable. Manual UPDATE YT-DLP NOW button shows installed version and result. Requires internet and access to GitHub releases. If unavailable, bundled engine remains usable.
- Optional HTTP(S), SOCKS4, SOCKS5 and SOCKS5h proxy for yt-dlp metadata extraction **and actual download**. Set via LINK > ENGINE / NETWORK SETTINGS > SAVE PROXY. Credentials in URL are stored locally in private app preferences and redacted from displayed yt-dlp errors. DIRECT / RESET clears the setting.
- Proxy applies to yt-dlp requests only. The embedded WEB browser follows Android's own network settings. A proxy never circumvents DRM, login or permissions.

## v0.3.0: video download reliability
- Queue item is saved before launching the Android foreground service; startup failures show as FAILED.
- Explicit direct media file links (MP4, MP3, WebM and similar) use streaming HTTP download when proxy is disabled, independent of yt-dlp site support. HLS/DASH and webpages still use yt-dlp.
- Fallback to generic yt-dlp best format when a website lacks MP4/M4A. Added visible 'WHY FAILED? / COPY ERROR' per failed download, plus HTTP/access/format troubleshooting.
- Automatic engine update deferred until 45 seconds of idle activity rather than blocking the initial download. Manual update remains available under LINK > ENGINE.
- Site pages requiring account cookies, CAPTCHA/DRM, expiring URLs, and unsupported extraction can still fail; test with a supported public video and share the specific error if needed.

## v0.4.0: Vidara video hosting (site-specific)
- Vidara watch/embed links recognized on vidara.so, vidara.to, viewdara.com, vidara.fit, vidvara.fit, vidaraa.cc and mountainpages.cc.
- Extract filecode from /e/ID, /v/ID, /embed/ID or /ID; request publicly available streaming_url from https://vidara.so/api/stream using POST JSON {filecode,device:web}, then feed HLS to yt-dlp / FFmpeg with Vidara referer and origin.
- Analyze previews identify Vidara and display the stream title/filecode. MP3 and 720p supported where HLS offers formats.
- No Vidara upload API key, account impersonation or DRM bypass. Authenticated, encrypted, private, deleted and site-blocked streams remain unavailable. Vidara.com is a *different* chemicals company and is not the video-hosting site.
- Public endpoint data format grounded in open source StreamFlow vidara/master_link.py. Live Vidara stream download must still be tested on a real Android phone.
