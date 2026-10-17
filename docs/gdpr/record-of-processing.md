# Record of processing activities (Art. 30 GDPR)

**Controller:** [Name, postal address, email] — the same details as the imprint (`VITE_IMPRINT`).
**Data protection officer:** none required (fewer than 20 people regularly processing personal data, no core activity of large-scale monitoring or special categories).
**Last reviewed:** [date]

---

## 1. Delivering the app

| | |
|---|---|
| Purpose | Serve the app's files securely and keep the service available |
| Legal basis | Art. 6(1)(f) — legitimate interest in secure operation |
| Data subjects | Visitors of the site |
| Data | IP address (processed, **not stored** by our server), requested path, time, status code; Cloudflare additionally sees IP and connection data |
| Recipients | Cloudflare (processor, see processors.md) |
| Third-country transfer | USA (Cloudflare), covered by the EU-US Data Privacy Framework |
| Retention | nginx logs without IP: Docker log rotation (2 × 1 MB, i.e. a few days); PocketBase request logs: 7 days, without IP and user id |

## 2. User accounts and sign-in

| | |
|---|---|
| Purpose | Let people sign in to sync and share their lists |
| Legal basis | Art. 6(1)(b) — performance of the contract (terms of use) |
| Data subjects | Account holders |
| Data | Email address, optional display name, consent date and version, last activity date, one-time sign-in codes (hashed, 10 minutes) |
| Recipients | Brevo (processor) for sending sign-in and warning emails |
| Third-country transfer | None (Brevo processes in the EU) |
| Retention | Until the account is deleted; unconfirmed sign-ups after 1 day; inactive accounts after 24 months (warning email 4 weeks before) |

## 3. Lists, items and sharing

| | |
|---|---|
| Purpose | Store users' lists so they sync between devices and can be shared |
| Legal basis | Art. 6(1)(b) — performance of the contract |
| Data subjects | Account holders; indirectly, anyone mentioned in item names, notes or photos (users are asked by the terms to save only what they may) |
| Data | List names, members and roles, item names, places, notes, history, photos of storage places; invite links (only a SHA-256 hash, 7 days) |
| Recipients | Other members of the same list (name or masked email, never the full email) |
| Third-country transfer | None |
| Retention | Until the item, list or account is deleted. Deleting an account deletes the lists it owns; items it added to other lists stay without the author link |

## 4. Server backups

| | |
|---|---|
| Purpose | Restore the service after failure |
| Legal basis | Art. 6(1)(f) — legitimate interest in not losing users' data; Art. 32 |
| Data | Copy of the database and uploaded photos |
| Recipients | [Backup storage provider, e.g. Hetzner Storage Box / Backblaze B2 — add to processors.md] |
| Retention | 30 days, encrypted before upload |

---

**Technical and organisational measures:** see [security-measures.md](security-measures.md).
