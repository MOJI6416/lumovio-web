# Lumovio for Android TV

A thin app for Android TV and Google TV: one screen with a WebView that opens `https://lumovio.app`. The site recognises
the app by `LumovioTV/<version> (AndroidTV)` in its user agent and always answers with its TV interface
(`apps/web/src/app/[locale]/tvui`). Everything — the interface, the data, the player — is the site's and updates with
it; the app changes rarely.

What the app adds to a TV browser:

| | |
|---|---|
| Launcher | `LEANBACK_LAUNCHER`, a 320 × 180 banner from the brand's vector logo, no touchscreen or leanback required |
| Before HTML | Native 900 ms projector animation on Android 12+, density-aware PNG on older versions; the final mark stays until WebView paints or fails. No minimum wait; Back cancels startup |
| Back | The remote's Back goes to the page as a `GoBack` key: it closes the top layer, hides the player's controls, goes back a screen; on the home screen's menu the page asks the app, which asks «Leave Lumovio?» |
| Media keys | Play/pause → Space (the player toggles), fast-forward / rewind → → / ← |
| Video | Full screen through `onShowCustomView`; playback starts without a tap (next episode, continue) |
| Screen | Kept on while a video plays (`window.LumovioTV.keepScreenOn`, called by the player) |
| Home servers | Mixed content and cleartext allowed, so the page reaches an `http://` Jellyfin, Plex or TorrServer at home; the app opens nothing but the site — another address is shown on the TV as a QR code to open on a phone |
| Session | Cookies flushed to disk when the app goes to the background: no new sign-in code after a restart |
| No network | Its own «No connection to Lumovio» with Retry, not WebView's error page |
| Updates | On every start it reads `lumovio.app/downloads/lumovio-tv.json` and offers a newer version, which the system installer installs after the TV asks |

The bridge `window.LumovioTV` has `version()`, `abilities()`, `keepScreenOn(on)` and `exitPrompt()` — no credentials and
no files cross it.

## Releases

Lumovio's CI builds and signs every version when the app changes. Each one is on
[lumovio.app/android-tv](https://lumovio.app/android-tv) (`lumovio.app/apk` for short) and in this repository's
[Releases](https://github.com/MOJI6416/lumovio-web/releases) as `tv-v<version>`, the same file with its SHA-256. An
installed app offers the next version itself.

## Build it yourself

Needs JDK 17+ (Android Studio's bundled `jbr` works) and the Android SDK (platform 34); put `sdk.dir=…` into
`local.properties` or set `ANDROID_HOME`.

```bash
cd apps/tv-android
./gradlew assembleDebug
```

The APK is `app/build/outputs/apk/debug/app-debug.apk` (application id `app.lumovio.tv.debug`, WebView debugging on), so
it installs beside the official app. Point it at a local web app with
`./gradlew assembleDebug -PsiteUrl=http://192.168.1.10:3000/`. Debug builds never update themselves. A release build of
your own (`assembleRelease`) is signed with your debug key: a TV with the official app can't update it with that file.

## Install on a TV

From the TV itself: the Downloader app and `lumovio.app/apk`. With adb (developer options and network debugging on):

```bash
adb connect 192.168.1.20:5555
adb install -r --user 0 app/build/outputs/apk/debug/app-debug.apk
```

`--user 0` matters on a TV with a work profile: a plain `adb install` puts the app in every profile, and the TV's
"Install unknown apps" list may then show only the work profile's copy — allowing it there never lets the app you use
install its update.

## Tested on

A TCL G07 (Google TV, Android 11, WebView 156): the launcher entry, D-pad and Back through the app, «Leave Lumovio?»,
the session after a restart, the media keys (play/pause, fast-forward +10 s, rewind −10 s), the screen kept on while a
video plays and let go after, the site's offline page and the app's own «No connection» screen with Retry, playback
from the sources screen, and the update offer from one version to the next.
