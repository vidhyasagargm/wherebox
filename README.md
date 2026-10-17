# Wherebox

Remember where you put things. Tell it, by typing or speaking, *"I put the passport in the bedroom drawer"*, and later ask *"Where is my passport?"*.

- **Local-first.** Everything lives on your device (IndexedDB). No account, no server-side data, no tracking.
- **Works offline.** Installable PWA for Android, iPhone and desktop.
- **English and German.** Understands both, whatever language the app is set to.
- **Made for everyone.** Large tap targets, high contrast, one-handed use, screen-reader friendly.
- **Free and open source** (MIT), supported by donations.

## Features

| | |
|---|---|
| One input for everything | "I put X in Y" saves; "Where is X?" asks; "Moved X to Y" updates and keeps the old place in history |
| Voice | Live transcript with listening, working and "didn't catch that" states |
| Quick start | `https://your-host/#/listen` opens straight into listening. Works as a home-screen shortcut (Android: long-press the icon → **Speak**), on Pixel Quick Tap, Samsung side button, iPhone Back Tap / Action Button (via Shortcuts) |
| Smart search | Plurals, typos, German compounds and umlauts; asks "Which charger?" when there are several; "Did you mean…?" when nothing matches |
| Unclear sentences | Falls back to a simple What? / Where? form, prefilled with its best guess |
| Places | Rooms and spots are built from what you say; rename, merge (rename to an existing name) or delete |
| Item detail | Photo of the spot, note, history timeline |
| Backup | Export/import a JSON file (photos included); gentle reminder after 30 days; asks the browser for persistent storage |
| Undo | Every save shows a toast with Undo and Edit |

## Why this stack

**Svelte 5 + Vite + vite-plugin-pwa + Dexie (IndexedDB)**, no backend.

- **Small and fast on cheap phones.** The whole app is ~75 KB of gzipped JS. Svelte compiles away its runtime, which matters for "saving must take under 3 seconds" on a five-year-old Android phone.
- **A plain static site.** Hash routing and no server code means nginx (or any static host) can serve it, and there is nothing to secure or back up on the server.
- **vite-plugin-pwa (Workbox)** generates the service worker, precache and manifest, including app shortcuts.
- **Dexie** is a thin, well-maintained IndexedDB wrapper with live queries, so the UI updates itself when data changes.
- **No AI model or cloud API for understanding sentences.** A rule-based parser (`src/lib/parser.ts`) handles English and German instantly and offline, and is easy to extend. It's covered by tests.

React or Next.js would also work, but they ship more JavaScript for no benefit here. A native app (Flutter, React Native) would have to go through app stores, which goes against "open a link and use it".

## Voice: what works where

Speech uses the browser's built-in Web Speech API.

| Platform | In-app voice | Notes |
|---|---|---|
| Android – Chrome, Edge, Samsung Internet | ✅ | Chrome sends audio to Google for recognition unless on-device recognition is available. Wherebox asks for on-device recognition when the browser supports it |
| iPhone – Safari tab | ✅ | |
| iPhone – installed to home screen | ⚠️ falls back | Apple's speech API is unreliable in home-screen apps, so **Tap to speak** opens the keyboard and points to its 🎤 dictation key, which works on-device and offline |
| Desktop Chrome / Edge | ✅ | Edge (and newer Chrome) can recognise speech on-device |
| Firefox | ❌ → keyboard | No Web Speech recognition |

When there's no internet and the browser needs a server for speech, Wherebox says so and suggests typing or keyboard dictation.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # parser and search tests
npm run check      # type check
npm run build      # → dist/
npm run icons      # re-render PNG icons from public/icon.svg
```

The links in Settings › About come from `.env` (`VITE_REPO_URL`, `VITE_COFFEE_URL`).

### Project layout

```
src/
  lib/parser.ts      sentence → save / ask / unclear (EN + DE)
  lib/search.ts      fuzzy matching and "did you mean"
  lib/db.ts          IndexedDB schema, save/move/undo
  lib/speech.ts      Web Speech wrapper and platform fallbacks
  lib/backup.ts      export / import
  lib/i18n.ts        all English and German strings
  screens/           Home, Voice, Find (answer / matches / not found), Confirm, ItemDetail, Places, Settings, Onboarding
  components/        Nav, Toast, banners, icons
```

## Deploy (home lab + GitHub + Cloudflare Tunnel)

### 1. GitHub builds the image

Push to GitHub. `.github/workflows/ci.yml` tests every push and pull request. On `main` and on version tags it builds a multi-arch image (amd64 + arm64, so it runs on a Raspberry Pi too) and publishes it to GitHub Container Registry:

- `main` → `ghcr.io/<you>/wherebox:latest`
- tag `v1.2.0` → `:1.2.0` and `:1.2`

After the first build, open the package on GitHub (your profile › Packages › wherebox › Package settings) and set **visibility to Public**. Then anyone, including your server, can pull it without logging in.

Optional repository settings (Settings › Secrets and variables › Actions):

- Variable `VITE_COFFEE_URL`: your Buy Me a Coffee link. The "See the code" link is filled in automatically.
- Variable `VITE_IMPRINT`: your imprint (Impressum), lines separated by `|`, e.g. `Name | Street 1 | 12345 City | you@example.com`. Adds an Imprint link in Settings. Public sites run from Germany usually need one.
- Secret `DEPLOY_WEBHOOK`: called after each `main` build, e.g. a Watchtower, Portainer or Komodo webhook, so the server pulls the new image.

Dependabot (`.github/dependabot.yml`) opens a monthly pull request to keep packages, Actions and base images up to date.

### 2. Run it on the server

Edit the image path in `docker-compose.yml`, then:

```bash
docker compose pull && docker compose up -d
curl http://localhost:8080/healthz   # → ok
```

The container is unprivileged nginx on port 8080, with a read-only filesystem.

### 3. Cloudflare Tunnel

Add a public hostname (e.g. `wherebox.example.com`) → service `http://wherebox:8080` if cloudflared runs in the same Docker network, otherwise `http://<server-ip>:8080`.

Cloudflare settings that matter for a PWA:

- **HTTPS is required** for install, service worker and microphone. The tunnel provides it.
- **Don't edge-cache `sw.js`, `index.html` or `manifest.webmanifest`.** nginx sends `Cache-Control: no-cache` for them, which Cloudflare respects by default. If you've added a "Cache Everything" rule, exclude these paths, or users get stuck on old versions.
- **Turn off Rocket Loader** for this hostname. It rewrites scripts and breaks the strict Content-Security-Policy.
- **Don't put Cloudflare Access (login) in front of it**, unless you want it private. Installed PWAs handle the Access login redirect badly.

Since all data stays in each person's browser, the server holds nothing personal. Backups are the user's own JSON files.

## Support

Wherebox is free, with no ads and no tracking. If it helps you, you can [buy me a coffee](https://buymeacoffee.com/vidhyasagar) ☕

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20me%20a%20coffee-FFDD00?logo=buymeacoffee&logoColor=000)](https://buymeacoffee.com/vidhyasagar)

## Accounts and sharing (in development)

Optional accounts add sync across devices and shared lists. The backend in `backend/` is [PocketBase](https://pocketbase.io) with:

- `pb_migrations/`: the schema and access rules (lists are visible only to their members; only editors can write)
- `pb_hooks/`: sign-up with recorded consent, invite links (only a hash of each link is stored), member management, data export, account deletion, and a daily clean-up (unconfirmed sign-ups after a day, inactive accounts after 24 months with a warning first)
- sign-in by emailed code only, no passwords; request logs without IP addresses; rate limits on sign-in

nginx forwards only the API paths the app uses. The PocketBase dashboard and admin API are not reachable from the internet.

```bash
npm run test:backend   # needs the PocketBase binary in backend/.bin (see backend/PB_VERSION)
```

## Contributing

Issues and pull requests are welcome. Adding phrasings or a language mostly means editing `src/lib/parser.ts` (with a test in `parser.test.ts`) and `src/lib/i18n.ts`.

## License

MIT — see [LICENSE](LICENSE).
