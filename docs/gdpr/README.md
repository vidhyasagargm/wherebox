# GDPR documents for running Wherebox

Working documents for whoever operates a Wherebox server with accounts enabled. They describe this codebase as it is; fill in the blanks marked `[…]` and keep them up to date when you change how the service runs. They are not legal advice.

| Document | GDPR | What it is for |
|---|---|---|
| [record-of-processing.md](record-of-processing.md) | Art. 30 | What personal data is processed, why, for how long, and who receives it |
| [security-measures.md](security-measures.md) | Art. 32 | Technical and organisational measures, split into "built into the code" and "operator's job" |
| [processors.md](processors.md) | Art. 28 | Service providers that process data for you, and their agreements |
| [breach-response.md](breach-response.md) | Art. 33/34 | What to do in the first 72 hours after a data breach |
| [requests.md](requests.md) | Art. 12–22 | Handling requests from users (access, deletion, correction…) |

Without accounts (no backend running), Wherebox processes no personal data on the server apart from short-lived, IP-free access logs and what Cloudflare sees when delivering the files.

The user-facing privacy notice and terms are in `src/lib/legal.ts`. When their meaning changes, update `LEGAL_UPDATED` there and `CONSENT_VERSION` in `backend/pb_hooks/lib/wb.js`; signed-in users are then asked to agree again.
