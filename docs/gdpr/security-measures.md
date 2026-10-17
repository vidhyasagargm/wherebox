# Technical and organisational measures (Art. 32 GDPR)

## Built into the code

- **No passwords:** sign-in only by a 6-digit code sent by email, valid 10 minutes; codes are stored hashed by PocketBase.
- **Access control on the server:** API rules let only list members read a list and its items, and only editors and owners change them. Non-members get "not found". Covered by `backend/test/api.test.mjs`.
- **Protected photos:** files are only served with a short-lived token to members of the list.
- **Minimal exposure:** nginx forwards only the API paths the app uses. The PocketBase dashboard and admin API (`/_/`, `/api/settings`, `/api/backups`, `/api/logs`, superuser login, …) are not reachable from the internet; the dashboard is bound to `127.0.0.1` on the server.
- **Data minimisation:** no IP addresses or user ids in logs; members see a name or masked email, never the full address; invite links are stored only as hashes; no avatar field; no analytics, no cookies, no third-party scripts or fonts.
- **Abuse limits:** rate limits on requesting and entering codes and on the Wherebox API.
- **Storage limitation:** a daily job deletes unconfirmed sign-ups (1 day), expired invites (7 days) and inactive accounts (24 months, after a warning).
- **Transport security:** HTTPS through Cloudflare Tunnel; strict Content-Security-Policy, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, a restrictive `Permissions-Policy`.
- **Containers:** both run as non-root users with a read-only file system and `no-new-privileges`.
- **Supply chain:** the PocketBase download is checked against its SHA-256 checksum; Dependabot keeps dependencies current; CI runs all tests before images are published.

## Operator's job (tick when done)

- [ ] Full-disk encryption on the server (e.g. LUKS), so a stolen disk reveals nothing
- [ ] Automatic security updates for the operating system; update the images when Dependabot or PocketBase release fixes
- [ ] SSH with keys only; no password login; firewall allowing nothing in except what cloudflared needs
- [ ] Two-factor authentication on GitHub, Cloudflare, Brevo and the backup provider
- [ ] A strong, unique PocketBase superuser password, stored in a password manager
- [ ] Nightly encrypted offsite backups, kept 30 days (see the deployment guide)
- [ ] A restore test at least twice a year, noted here: [dates]
- [ ] Only you (or named people) have server and superuser access: [list]
- [ ] Accept Cloudflare's and Brevo's data processing agreements (see processors.md)
