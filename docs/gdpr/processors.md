# Processors (Art. 28 GDPR)

Service providers that process personal data on your behalf. Each needs a data processing agreement (DPA, German: Auftragsverarbeitungsvertrag).

| Provider | What they process | Location | Agreement | Done |
|---|---|---|---|---|
| Cloudflare, Inc. (101 Townsend St, San Francisco, CA 94107, USA) | IP addresses and connection data of everyone who opens the app | Global; USA covered by EU-US Data Privacy Framework | Customer DPA, part of Cloudflare's self-serve terms: https://www.cloudflare.com/cloudflare-customer-dpa/ | [ ] |
| Brevo / Sendinblue SAS (106 boulevard Haussmann, 75008 Paris, France) | Email addresses and content of sign-in and warning emails | EU | DPA available in the Brevo account settings (Account › Security/Legal) | [ ] |
| [Backup storage provider] | Encrypted backups (provider cannot read them) | [EU] | [link] | [ ] |

**Not processors for user data:** GitHub (hosts the source code and container images; no user data passes through it).

The privacy notice (`src/lib/legal.ts`) names Cloudflare and Brevo. If you add or change a provider, update it there too.
