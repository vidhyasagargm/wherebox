# Deploying wherebox.sagar.fyi

The steps for the main instance: home lab server, Cloudflare Tunnel, Brevo for email, encrypted offsite backups. Do them in order; each ends with a check. General self-hosting is in [self-hosting.md](self-hosting.md).

## 1. Brevo (sign-in emails from noreply@sagar.fyi)

1. Create a free account at brevo.com.
2. **Senders, Domains & Dedicated IPs › Domains › Add a domain:** `sagar.fyi`. Brevo shows DNS records (a `brevo-code` TXT, DKIM, DMARC). Add each one in **Cloudflare › sagar.fyi › DNS** exactly as shown, with proxy **off** (grey cloud). Back in Brevo, click *Authenticate*; all lines should turn green.
3. **Senders › Add a sender:** `Wherebox <noreply@sagar.fyi>`.
4. **SMTP & API › SMTP › Generate a new SMTP key.** Note the login (shown on that page) and the key — this is `SMTP_USER` / `SMTP_PASS`.
5. **Account › Security or Legal › Data processing agreement:** accept it, then tick Brevo in `docs/gdpr/processors.md`.
6. Optional: **Cloudflare › Email › Email Routing**, route `hello@sagar.fyi` to your inbox, so replies reach you.

✅ Check: Brevo shows `sagar.fyi` as authenticated.

## 2. Backup storage

Pick one; all are encrypted before they leave the server.

- **Hetzner Storage Box** (from ~€3.20/month, Germany): enable SSH, add an SSH public key, then `RESTIC_REPOSITORY=sftp:u123456@u123456.your-storagebox.de:23/wherebox` and mount the private key in `docker-compose.yml` (see the comment there).
- **Backblaze B2** (10 GB free): create a bucket and an application key, then `RESTIC_REPOSITORY=s3:https://s3.<region>.backblazeb2.com/<bucket>/wherebox` with `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`. Choose an EU region.

Make a long random `RESTIC_PASSWORD` (`openssl rand -base64 32`) and **save it in your password manager now**. Add the provider to `docs/gdpr/processors.md`.

## 3. Server

```bash
mkdir -p ~/wherebox && cd ~/wherebox
curl -fsSLO https://raw.githubusercontent.com/vidhyasagargm/wherebox/main/docker-compose.yml
curl -fsSL  https://raw.githubusercontent.com/vidhyasagargm/wherebox/main/.env.example -o .env
mkdir -p scripts && for f in backup.sh restore-test.sh; do curl -fsSL https://raw.githubusercontent.com/vidhyasagargm/wherebox/main/scripts/$f -o scripts/$f; done
chmod 600 .env
```

Edit `.env`:

```bash
COMPOSE_PROFILES=accounts,backup
WB_APP_URL=https://wherebox.sagar.fyi
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=<Brevo SMTP login>
SMTP_PASS=<Brevo SMTP key>
SMTP_FROM=noreply@sagar.fyi
WB_LOG_SIGNIN_CODES=false
RESTIC_REPOSITORY=<from step 2>
RESTIC_PASSWORD=<from step 2>
```

If an older Wherebox is running from a previous `docker-compose.yml`, stop it first: `docker compose down` (the app has no server data to lose).

```bash
docker compose pull
docker compose up -d
docker compose ps        # wherebox, wherebox-backend, wherebox-backup: running / healthy
curl -s localhost:8080/api/health    # {"message":"API is healthy."…}
```

Create the admin account (choose your own strong password; it never leaves the server):

```bash
docker compose exec pocketbase pocketbase superuser upsert vidhyasagargsm@gmail.com '<strong password>' --dir /pb_data
```

## 4. Cloudflare

- **Zero Trust › Networks › Tunnels › your tunnel › Public hostname:** `wherebox.sagar.fyi` → `http://localhost:8080` (or `http://wherebox:8080` if cloudflared runs in Docker on the same network).
- **Speed › Optimization:** Rocket Loader **off** for this hostname (it breaks the Content-Security-Policy).
- **Caching:** don't add a "Cache Everything" rule for this hostname, or `sw.js` and `index.html` get stuck.
- Confirm Cloudflare's DPA is accepted (Account › Configurations › Privacy) and tick it in `docs/gdpr/processors.md`.

✅ Check from your phone (mobile data, not Wi-Fi): https://wherebox.sagar.fyi opens, Settings shows "Sync and share".

## 5. First sign-in and backup

1. Sign in on your phone with your email. The code should arrive within a minute (check spam the first time).
2. Make the first snapshot: `ssh -L 8090:127.0.0.1:8090 you@server`, open http://localhost:8090/_/, log in as admin, **Settings › Backups › Initialize new backup**.
3. Copy it offsite and look:
   ```bash
   docker compose run --rm backup now
   docker compose run --rm backup snapshots
   ```
4. Prove it can be restored: `sh scripts/restore-test.sh`. Note the date in `docs/gdpr/security-measures.md`.

From now on this happens by itself every night.

## 6. Updates

Every push to `main` builds new images. On the server:

```bash
docker compose pull && docker compose up -d
```

To make it automatic, run your usual updater (Watchtower, Komodo, Portainer webhook) and put its webhook URL in the repo's `DEPLOY_WEBHOOK` secret — it's already set, and GitHub calls it after each build.

## 7. Before telling people

- [ ] `VITE_IMPRINT` secret has your full postal address; re-run the GitHub workflow (Actions › CI › Run workflow)
- [ ] Tick the operator items in `docs/gdpr/security-measures.md` (disk encryption, updates, SSH keys, 2FA)
- [ ] Brevo, Cloudflare and backup DPAs accepted (`docs/gdpr/processors.md`)
- [ ] Tested on one iPhone and one Android: install, voice, sign-in, sharing a list
- [ ] Optional: privacy notice and terms checked by a lawyer or a generator service
