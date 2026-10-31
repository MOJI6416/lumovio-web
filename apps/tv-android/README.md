# Lumovio for Android TV

A thin app for Android TV and Google TV boxes (`docs/tv-mode-handoff-2026-10-23.md` §11.1): one screen with a WebView that
opens `https://lumovio.app`. The site recognises the app by `LumovioTV/<version> (AndroidTV)` in its user agent and
always answers with its TV shell (`apps/web/src/app/[locale]/tvui`). Everything — the interface, the data, the
player — is the site's and updates with it; the app changes rarely.

What the app adds to a TV browser:

| | |
|---|---|
| Launcher | `LEANBACK_LAUNCHER`, a 320 × 180 banner from the brand's vector logo, no touchscreen or leanback required |
| Before HTML | Native 900 ms projector AVD on Android 12+, density-aware PNG on older versions; the final mark stays until WebView paints or fails. No minimum wait; Back cancels startup. Generated with the web's `brand:motion` from the same vector source |
| Back | The remote's Back goes to the page as a `GoBack` key: it closes the top layer, hides the player's controls, goes back a screen; on the home screen's menu the page asks the app, which asks «Leave Lumovio?» |
| Media keys | Play/pause → Space (the player toggles), fast-forward / rewind → → / ← |
| Video | Full screen through `onShowCustomView`; playback starts without a tap (next episode, continue) |
| Screen | Kept on while a video plays (`window.LumovioTV.keepScreenOn`, called by the player) |
| Home servers | Mixed content and cleartext allowed, so the page reaches an `http://` Jellyfin, Plex or TorrServer at home; the app opens nothing but the site — another address is shown on the TV as a QR code to open on a phone |
| Session | Cookies flushed to disk when the app goes to the background: no new code after a restart |
| No network | Its own «No connection to Lumovio» with Retry, not WebView's error page |

The bridge `window.LumovioTV` has `version()`, `abilities()`, `keepScreenOn(on)` and `exitPrompt()` — no credentials and
no files cross it.

## Releases — automatic

Nothing is uploaded by hand. A push to `main` that changes `apps/tv-android/**` runs `.github/workflows/tv-app.yml`:
it builds `assembleRelease` with `versionCode` = the number of commits that touched the app (so every change is newer)
and `versionName` = `1.<versionCode>`, signs it with the release key, and commits `lumovio-tv-<version>.apk` and
`lumovio-tv.json` into `apps/web/public/downloads/` (the previous APK goes). That commit deploys the site, which then
serves:

- `lumovio.app/android-tv` — the app's page with «Download the APK» and how to install it on a TV (S58), linked from the
  footer, Settings → Devices and the TV code screen in an Android TV's own browser;
- `lumovio.app/apk` — the short address to type into the TV's Downloader app: a redirect to the newest APK
  (`next.config.ts` reads `lumovio-tv.json` at build time);
- `downloads/lumovio-tv.json` — what the installed app checks on every start: a newer `versionCode` is offered as an
  update, downloaded and handed to the system installer (the TV asks to confirm, the first time also to allow
  installing from Lumovio). Debug builds never update themselves.

The same APK becomes a release of the public repository
([MOJI6416/lumovio-web](https://github.com/MOJI6416/lumovio-web/releases), tag `tv-v<version>`, with its SHA-256):
`tv-app.yml` then runs `public-repo.yml`, which brings the source and the new manifest there, and that repository's
`tv-release.yml` takes the APK from lumovio.app once it matches the manifest's checksum.

The release key: `release.jks` (alias `lumovio`, PKCS12) and its password in `release.local.md`, both in this folder and
never committed — the owner keeps a copy somewhere safe: a TV can install an update only if it is signed with the same
key. CI has them as the repository secrets `TV_KEYSTORE_B64` (the file in base64) and `TV_KEYSTORE_PASSWORD`. Gradle
signs a release with it when `LUMOVIO_KEYSTORE` and `LUMOVIO_KEYSTORE_PASSWORD` are set, else with the debug key.

## Build by hand

Needs JDK 17+ (Android Studio's `jbr` works) and the Android SDK (platform 34). `local.properties` with `sdk.dir=…` is
not committed.

```bash
cd apps/tv-android
JAVA_HOME="/c/Program Files/Android/Android Studio/jbr" ./gradlew assembleRelease
```

The APK is `app/build/outputs/apk/release/app-release.apk` (version 1, debug-signed without the key above). A debug build
against a local stand: `./gradlew assembleDebug -PsiteUrl=http://192.168.1.10:3000/` (application id
`app.lumovio.tv.debug`, WebView debugging on).

## Install on a TV

From the TV itself: the Downloader app and `lumovio.app/apk`. With adb (developer options and network debugging on):

```bash
adb connect <tv-ip>:5555
adb install -r app/build/outputs/apk/release/app-release.apk
```

## Checked on the owner's TV (TCL G07, Google TV, Android 11, WebView 156)

Launcher entry («Your apps», its round icon — Google TV shows the icon, the 320 × 180 banner is for classic Android TV
launchers), D-pad and Back through the app, «Leave Lumovio?», the session after a restart, the media keys (play/pause,
fast-forward +10 s, rewind −10 s), the screen kept on while a video plays and let go after (the app also clears the flag
on every new page: a page that went away while playing never said so), the site's offline page with Retry focused and
its own retry every 15 s, playback from the sources screen, the app's own «No connection» screen with Retry. The first
published release (1.3, by CI) was offered by an installed 1.1 on start («A new version of Lumovio» → «Update»), downloaded
and handed to the system installer, which asked to allow installing from Lumovio — a TV's security setting, left to its
owner; the install after that permission wasn't seen.
