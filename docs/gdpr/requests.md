# Handling requests from users (Art. 12–22 GDPR)

Answer within **one month** (extendable by two months for complex requests, with notice). Free of charge. Confirm the person's identity first — normally by replying only to the email address on the account.

| Request | How |
|---|---|
| Access / copy of data (Art. 15, 20) | Users can do it themselves: Settings › Your data › Download my data. If asked by email, point them there, or export it for them from the PocketBase dashboard (`users`, `lists`, `items` filtered by their id). |
| Deletion (Art. 17) | Self-service: Settings › Your data › Delete my account. By email: on the server, find the user's id in the dashboard and run `curl -X DELETE -H "Authorization: <superuser token>" http://127.0.0.1:8090/api/wb/admin/users/<id>` — the same clean-up as the in-app button (owned lists deleted, memberships removed). Backups age out within 30 days. |
| Correction (Art. 16) | Name: self-service in Settings. Email address: change the `email` field of the user in the dashboard after confirming both addresses belong to them. |
| Restriction (Art. 18) / objection (Art. 21) | Usually resolved by deletion, as the service has no processing beyond providing it. Document the request and your answer. |
| Complaint about a shared list | The list owner controls who is in it. If content in a shared list concerns someone who isn't a member, the owner can remove it; otherwise handle as a deletion request for that content. |

Keep a short note of each request: date, what was asked, what you did, date answered.
