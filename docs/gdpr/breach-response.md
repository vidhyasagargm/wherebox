# Data breach response (Art. 33/34 GDPR)

A breach is any security incident that leads to personal data being lost, changed, disclosed or accessed without permission — for example a stolen backup, a leaked database, or a bug that showed one person's list to someone else.

## Within the first hours

1. **Contain it.** Stop the cause: take the backend container down (`docker compose stop pocketbase`), revoke leaked credentials, rotate the superuser password and the Brevo SMTP key, revoke invite links if relevant. The app keeps working on devices without the backend.
2. **Preserve evidence.** Copy the relevant logs and a snapshot of the data before changing more.
3. **Write down** what happened, when you noticed, which data and how many people may be affected (use the log below).

## Within 72 hours of becoming aware

4. **Assess the risk.** If the breach is *unlikely* to result in a risk to people (e.g. an encrypted backup was lost and the key is safe), document it below and stop here.
5. **Otherwise notify the authority** — for a controller in Bavaria: Bayerisches Landesamt für Datenschutzaufsicht (BayLDA), online form at https://www.lda.bayern.de (Meldung einer Datenschutzverletzung). Include: what happened, categories and rough number of people and records, likely consequences, measures taken. You can send missing details later.

## Without undue delay, if the risk to people is high

6. **Tell the affected users** by email in plain language: what happened, what data, what you did, what they can do (e.g. "be careful with emails pretending to be from Wherebox"), and how to contact you.

## Afterwards

7. Fix the root cause, add a test if it was a bug, and update [security-measures.md](security-measures.md).

---

## Breach log

Every breach must be documented, even ones you don't report.

| Date noticed | What happened | Data / people affected | Risk assessment | Reported to BayLDA? | Users informed? | Measures |
|---|---|---|---|---|---|---|
| | | | | | | |
