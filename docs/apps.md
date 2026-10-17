# The Android and iPhone apps

The apps are the same Svelte code as the website, wrapped with [Capacitor](https://capacitorjs.com). Everything still runs on the phone, works offline and needs no account. With an account, they sync through the server at `https://wherebox.sagar.fyi` (or `VITE_API_URL` at build time).

What the apps do differently from the website:

| | Website / PWA | App |
|---|---|---|
| Voice | Web Speech API; keyboard dictation on an installed iPhone PWA | The phone's own recognizer (`Listen` plugin in `android/…/ListenPlugin.java` and `ios/App/App/ListenPlugin.swift`), on-device when the language is installed |
| Reading aloud | `speechSynthesis` | System text-to-speech (`@capacitor-community/text-to-speech`) |
| Storage | IndexedDB, which the browser may clear | IndexedDB inside the app, never cleared automatically |
| Export, invite links | Download or web share | System share sheet |
| Quick start | `https://…/#/listen` | `wherebox://listen`; long-press the icon for **Speak** and **Places** |
| Invite links | Open the website | Open the app (Android, once `assetlinks.json` is served, see below) |
| Updates | Service worker | New release |

Google cloud backup of the app's data is turned off (`android/app/src/main/res/xml/`), so lists don't leave the phone that way. Moving to a new phone directly still copies them.

## Develop

Needs Node 22, JDK 21 and the Android SDK (Android Studio installs both).

```bash
npm run app:sync        # build the website into dist/ and copy it into android/ and ios/
npm run app:android     # … and build a debug APK: android/app/build/outputs/apk/debug/
npx cap open android    # or open it in Android Studio
npm run icons           # re-render app icons and splash screens from public/icon.svg
```

Debug builds can be inspected from desktop Chrome at `chrome://inspect`.

The app's version is `version` in `package.json`; Android's version code is derived from it (1.2.3 → 10203).

## Releasing on GitHub (Android)

### One-time: the signing key

Android only installs updates signed with the same key as the installed app. **Losing the key means people have to uninstall (and lose their data) to update.** Keep it, and its passwords, in your password manager and one more safe place.

```bash
keytool -genkeypair -v -keystore wherebox-release.jks -alias wherebox \
  -keyalg RSA -keysize 4096 -validity 10000 -dname "CN=Wherebox"
base64 -w0 wherebox-release.jks     # → the ANDROID_KEYSTORE secret
keytool -list -v -keystore wherebox-release.jks -alias wherebox | grep SHA256
                                    # → the ANDROID_CERT_SHA256 variable (AB:CD:…)
```

In **GitHub › Settings › Secrets and variables › Actions**:

| | Name | Value |
|---|---|---|
| Secret | `ANDROID_KEYSTORE` | the base64 line |
| Secret | `ANDROID_KEYSTORE_PASSWORD` | keystore password |
| Secret | `ANDROID_KEY_ALIAS` | `wherebox` |
| Secret | `ANDROID_KEY_PASSWORD` | key password (the same as the keystore's, unless you chose another) |
| Variable | `ANDROID_CERT_SHA256` | the SHA256 fingerprint |

With `ANDROID_CERT_SHA256` set, the next image serves `https://wherebox.sagar.fyi/.well-known/assetlinks.json`, and Android opens invite links in the app instead of the browser.

✅ Check: after the next deploy, `curl https://wherebox.sagar.fyi/.well-known/assetlinks.json` shows the fingerprint.

### Each release

```bash
npm version minor        # or patch; updates package.json and makes the v1.x.y tag
git push --follow-tags
```

CI builds and signs the APK and attaches `wherebox-<version>.apk` to the GitHub release for that tag. Pushes to `main` and pull requests build an unsigned APK as a check (download it from the run's artifacts).

### What people do

1. Open the latest release on GitHub on the phone and tap `wherebox-<version>.apk`.
2. Android asks to allow installs from the browser once: **Settings › Allow from this source**.
3. Updates: download the new APK the same way, or use [Obtainium](https://obtainium.imranr.dev) with the repository URL to be told about new releases.

Google is rolling out developer verification for apps installed outside the Play Store on certified Android phones (from 2026 in some countries). If it reaches you, register the app's package name (`fyi.sagar.wherebox`) and signing key in the Android Developer Console. Google has said there will be a free option for hobby developers.

## iPhone

The iOS project is ready, and CI builds it for the simulator on every run. But Apple doesn't let anyone install an app downloaded from a website, so there's no GitHub download for iPhone. The options:

| | Cost | Notes |
|---|---|---|
| **PWA** (today) | free | Safari › Share › Add to Home Screen. Everything works; voice falls back to keyboard dictation |
| **TestFlight / App Store** | Apple Developer Program, $99/year | TestFlight: up to 10,000 testers by link, builds last 90 days. App Store: review, then anyone can install |
| **AltStore / SideStore** | free Apple ID | People sign the app themselves; it must be refreshed every 7 days and needs a computer to set up. Fine for yourself, not for family |
| **EU alternative marketplaces** | Developer Program + Apple's notarization | Only inside the EU; still needs the paid account |

To ship through TestFlight once you have an account: open `ios/App/App.xcodeproj` in Xcode on a Mac, choose your team under **Signing & Capabilities**, **Product › Archive**, then **Distribute App › TestFlight**. To make invite links open the iPhone app, add the **Associated Domains** capability (`applinks:wherebox.sagar.fyi`) and serve `/.well-known/apple-app-site-association` with your team ID.
