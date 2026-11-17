# IG Story Viewer by Lafrich (Android)

Native Android UI + embedded WebView to view public Instagram Stories using the third-party service from the reference: [insta-stories-viewer.com](https://insta-stories-viewer.com/id/).

## Features
- Input Instagram username, @username, or Instagram profile URL.
- Directly open the matching public profile's Stories inside the app.
- Search history kept locally on device (last 6 usernames).
- Navigation, refresh, fallback to external browser.
- No Instagram login or API token.

## Limitations
- **Public accounts only**; cannot bypass private accounts, Close Friends restrictions, expired Stories, or unavailable content.
- Content and anonymity claims are determined by the external viewer, not independently guaranteed by this app.
- Story availability, layout, videos, ads, and downloads depend on the external site's current functionality. If it blocks Android WebView, tap **Browser**.
- Not affiliated with Instagram/Meta or the website provider.
- No Instagram passwords are requested. App has Internet and network-state permissions only.

## Build
Java 17, Android SDK 35, Gradle 8.10.2:

```sh
gradle -p apps/ig-story-viewer :app:assembleDebug
```

APK: `apps/ig-story-viewer/app/build/outputs/apk/debug/app-debug.apk`

CI publishes a debug-signed APK at release tag `ig-story-viewer-v0.1.0`.
