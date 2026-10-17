# Hosting Wherebox yourself

Wherebox is free to host for yourself, your family or anyone else (MIT licence). You need a machine that runs Docker: a home server, a Raspberry Pi 4/5 or a small VPS. The images work on both x86 (amd64) and ARM (arm64).

There are three ways to run it. Start with the first; you can switch later without losing anything.

| | What you get | What you need |
|---|---|---|
| **1. App only** | Everything works, each person's list stays on their own device | Docker, HTTPS |
| **2. Accounts at home** | + sync between devices and shared lists, for your household | + nothing else: sign-in codes appear in the server log |
| **3. Accounts in public** | + sign-in by email for anyone | + an email (SMTP) account, backups |

## Before you start: HTTPS

Phones only allow installing the app, offline use and the microphone on `https://` addresses (or `localhost`). Plain `http://192.168.1.10:8080` works for a quick look, but not as a real app. Any of these gives you HTTPS:

- **Cloudflare Tunnel** (free, works behind any router, no open ports): add a public hostname pointing to `http://localhost:8080`.
- **Tailscale**: `tailscale serve --bg 8080` gives an `https://…ts.net` address that only your devices can reach. Good for option 2.
- **Caddy** or another reverse proxy with a real domain and Let's Encrypt.

## Setup

```bash
mkdir wherebox && cd wherebox
curl -fsSLO https://raw.githubusercontent.com/vidhyasagargm/wherebox/main/docker-compose.yml
curl -fsSL  https://raw.githubusercontent.com/vidhyasagargm/wherebox/main/.env.example -o .env
mkdir scripts && curl -fsSL https://raw.githubusercontent.com/vidhyasagargm/wherebox/main/scripts/backup.sh -o scripts/backup.sh
```

Everything is configured in `.env`. Then:

```bash
docker compose up -d
```

To update later: `docker compose pull && docker compose up -d`.

### 1. App only

Leave `COMPOSE_PROFILES=` empty. That's it: the app runs on port 8080 and hides everything about accounts, because there is no backend.

### 2. Accounts at home, no email needed

In `.env`:

```bash
COMPOSE_PROFILES=accounts
WB_APP_URL=https://wherebox.your-tailnet.ts.net
WB_LOG_SIGNIN_CODES=true
```

Run `docker compose up -d`. When someone signs in, read their code from the log:

```bash
docker compose logs pocketbase | grep "sign-in code"
```

**Only use this on a private network** (like Tailscale): anyone who can read the server log could sign in as anyone.

### 3. Accounts in public

In `.env`:

```bash
COMPOSE_PROFILES=accounts,backup
WB_APP_URL=https://wherebox.example.com
WB_LOG_SIGNIN_CODES=false
SMTP_HOST=…   SMTP_PORT=587   SMTP_USER=…   SMTP_PASS=…   SMTP_FROM=noreply@example.com
RESTIC_REPOSITORY=…   RESTIC_PASSWORD=…
```

Any SMTP service works. Free tiers that are enough for a family or small community: Brevo (EU, 300 emails/day), Mailjet (EU), Resend, or Gmail with an app password. Set up SPF/DKIM for your domain as your provider describes, or sign-in emails land in spam.

Then also:

- **Create your admin account** (for the PocketBase dashboard), with a strong password:
  ```bash
  docker compose exec pocketbase pocketbase superuser upsert you@example.com 'a-long-random-password' --dir /pb_data
  ```
  The dashboard is only reachable from the server itself: `ssh -L 8090:127.0.0.1:8090 you@server`, then open http://localhost:8090/_/.
- **Imprint and privacy:** if you're in the EU and the site is public, you are the data controller. Build your own image with your details, or fork and set `VITE_IMPRINT` (`Name | Street 1 | 12345 City | you@example.com`) as a build argument. Read `docs/gdpr/` — it's written for exactly this.
- **Backups:** see below.

## Backups

With the `backup` profile, PocketBase makes a consistent snapshot every night (02:30 UTC), and the backup container encrypts it with [restic](https://restic.net) and copies it to `RESTIC_REPOSITORY` (03:15 UTC), keeping 30 days.

- Any restic repository works: an SFTP server (e.g. a Hetzner Storage Box), S3-compatible storage (Backblaze B2, Wasabi, MinIO), or a second disk.
- **Store `RESTIC_PASSWORD` somewhere other than the server** (a password manager). Without it, the backups can't be restored.
- Back up right away and list backups:
  ```bash
  docker compose run --rm backup now
  docker compose run --rm backup snapshots
  ```
  `now` needs at least one nightly snapshot. To make one immediately: PocketBase dashboard › Settings › Backups › "Initialize new backup".
- **Test that restoring works** (doesn't touch the running service):
  ```bash
  curl -fsSL https://raw.githubusercontent.com/vidhyasagargm/wherebox/main/scripts/restore-test.sh -o scripts/restore-test.sh
  sh scripts/restore-test.sh
  ```
- **Restoring for real:** stop the backend, restore, then use the dashboard (Settings › Backups › Restore) with the newest zip from `./restore/pb_data/backups/`.

## Ports and what's exposed

| Container | Port | Reachable from |
|---|---|---|
| `wherebox` (app, nginx) | `WHEREBOX_PORT` (8080) | your reverse proxy or tunnel |
| `wherebox-backend` (PocketBase) | 8090 | **only this machine** (`127.0.0.1`) |

The app's nginx forwards only the API paths the app needs. The PocketBase dashboard and admin API are never reachable through the public address.
