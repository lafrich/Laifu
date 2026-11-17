# Save em all — by Lafrich (v0.7.1)

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

## v0.5.0: Pornhub yt-dlp integration
- Recognizes Pornhub and its known subdomains for single-video page URLs; shows a Pornhub-specific analyze state while keeping Vidara's resolver untouched.
- Uses yt-dlp's official PornHub extractor with normal browser referer, user-agent, and language headers for analysis, downloads, and format fallback.
- For BEST mode, prefers a complete MP4/HLS rendition before separate A/V tracks. Existing 720p, MP3, original, queued downloads, and proxy settings remain available.
- Clearer failures when content is unavailable, restricted, or login-gated. No private API scraping, cookie stealing, account impersonation, age/region bypass or DRM circumvention.
- Real playback/download success depends on the specific public video, current extractor, and network; an APK build does not confirm live site access.

## v0.6.0: WEB capture fallback
- If a video page rejects yt-dlp metadata extraction (e.g. HTTP 403), open WEB, play the permitted public video, and choose USE DETECTED MEDIA STREAM after it appears.
- The embedded browser observes its own requested .m3u8, .mpd, .mp4, .m4v, and .webm resources. It never intercepts responses or captures browser cookies. The observed media link is passed to yt-dlp only after explicit user action.
- Saves the original page URL as referer and the browser's user agent alongside the queued media link. Existing Vidara resolver and four output modes remain intact.
- No guarantee for opaque player protocols, expired media links, anti-bot restrictions, authentication, age verification, region blocks, paid/encrypted content, or DRM. Download content only with authorization.

## v0.6.1: Unresponsive buttons on small phone screens
- PASTE, ANALYZE, and DOWNLOAD are now fixed immediately below the URL input and outside the weighted content area; the Android keyboard can no longer make these primary buttons disappear by collapsing the scrolling panel.
- Keyboard DONE hides the keyboard; initial focus stays off the edit field; PASTE is immediate and no longer launches automatic metadata extraction.
- Browser WebView is lazy-loaded only when WEB is opened, reducing startup memory/process overhead for LINK.
- Queue submit shows immediate feedback and switches to the live queue. Existing Vidara, Pornhub, four modes, download history and WEB capture logic are preserved.

## v0.7.0: yt-dlp engine freshness
- GitHub Actions downloads the official latest yt-dlp nightly Unix zipapp on every APK build, validates it, and embeds the release tag.
- Application R.raw.ytdlp overrides the library's outdated raw resource; an existing installation migrates to the updated bundle on first engine initialization unless the user already installed a newer build.
- Runtime is checked using yt-dlp --version with the actual Android Python environment. A failed migration restores the previous engine rather than silently claiming success.
- Background auto-update begins shortly after launch. A failed check is never cached for twelve hours; user can retry via UPDATE YT-DLP NOW. Nightly is preferred, stable is fallback.
- Android wrapper library stays at 0.18.1; this is separate from yt-dlp's date-based executable version.
- Existing Vidara, Pornhub URL support for accessible public media, WEB Capture, download modes, queue and history remain.

## v0.7.1: Browser impersonation errors
- Some yt-dlp site extractors request `impersonate=True`, which requires a compatible `curl_cffi` runtime. Updating the Python yt-dlp ZIP alone does not provide `curl_cffi` on Android. This APK does **not** claim to include curl_cffi or native TLS impersonation.
- Failed Pornhub downloads with impersonation/curl_cffi errors now show **OPEN VIDEO IN WEB • SCAN PLAYER**. This opens the page in the embedded WebView (without copying cookies to yt-dlp), so a user can play publicly available videos and attempt to capture accessible media requests.
- WEB has a clickable **SCAN PLAYER** action even before any stream is detected. It reads ordinary HTML5 video/source URLs from the currently loaded page and uses WebView-request interception for direct .m3u8/.mp4 etc.
- Captured direct media files (.mp4/.webm/etc) now transfer via Android's HTTP downloader with the browser's page Referer and User-Agent; yt-dlp isn't required for those ordinary files. HLS/DASH still use yt-dlp.
- This may not work for blob streams, DRM, authentication, anti-bot checks, restricted access, signed/expired media, or sites that prevent playback in WebView. It does not evade those protections.
