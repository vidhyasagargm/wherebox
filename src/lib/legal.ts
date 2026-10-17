// Privacy notice and terms of use, in English and German.
// When the meaning changes, update LEGAL_UPDATED and bump CONSENT_VERSION
// on the server (backend/pb_hooks/lib/wb.js) so new sign-ups agree to the new text.
import type { Lang } from './parser'

export const LEGAL_UPDATED = new Date(2026, 9, 17).getTime()

export type Section = { title?: string; paragraphs: string[]; list?: string[] }

// {controller} is replaced by the operator's details (VITE_IMPRINT), {authority} stays as written.
const privacyEn: Section[] = [
  {
    paragraphs: [
      'Wherebox works in two ways. Without an account, everything stays on your device. With an optional account, your lists are also stored on our server so they sync between your devices and can be shared. This notice explains both.',
    ],
  },
  { title: 'Who is responsible', paragraphs: ['{controller}'] },
  {
    title: 'Without an account',
    paragraphs: [
      'Everything you save – things, places, notes and photos – stays in this browser on this device. We never receive it. Backups are files you create and keep yourself.',
      'Storing your list on your device is strictly necessary for the service you asked for (§ 25(2) TDDDG), so no consent banner is needed.',
    ],
  },
  {
    title: 'With an account: what we store',
    paragraphs: ['When you create an account we store:'],
    list: [
      'your email address and, if you enter one, your name',
      'when you agreed to these terms and which version',
      'when you last used your account',
      'your lists and their items: names, places, notes, history, photos',
      'who is a member of which list, and their role',
      'invite links you create (only a scrambled form of the link)',
    ],
  },
  {
    title: 'Why, and on what legal basis',
    paragraphs: [
      'We use this data only to provide what you asked for: signing in, syncing your lists between your devices and sharing them with people you invite. The legal basis is the contract with you (Art. 6(1)(b) GDPR). We do not use your data for advertising, analytics or profiling, and we do not sell it.',
    ],
  },
  {
    title: 'Who can see it',
    paragraphs: [
      'People you share a list with see that list, its items and photos, and your name (or a shortened form of your email address, never the full address). People in your other lists can’t see lists they aren’t part of.',
      'The data is stored on a server we run ourselves in Germany, on an encrypted disk. As the operator we could technically access it, but we only do so to fix problems or when the law requires it.',
    ],
  },
  {
    title: 'Sign-in emails',
    paragraphs: [
      'Sign-in codes are sent through Brevo (Sendinblue SAS, 106 boulevard Haussmann, 75008 Paris, France), which processes your email address and the email on our behalf under a data processing agreement. The data stays in the EU.',
    ],
  },
  {
    title: 'Delivering the app',
    paragraphs: [
      'To deliver the app, our server receives your IP address and the files your browser asks for. It does not store IP addresses: its logs only contain the time, the request and whether it worked, and are deleted after 7 days. There are no cookies, no analytics and no advertising. This is our legitimate interest in running the service securely (Art. 6(1)(f) GDPR).',
      'The connection runs through Cloudflare, Inc. (101 Townsend St, San Francisco, CA 94107, USA), which protects the server and delivers the app. Cloudflare processes your IP address and technical connection data on our behalf under a data processing agreement. Cloudflare is certified under the EU-US Data Privacy Framework, which covers transfers to the USA.',
    ],
  },
  {
    title: 'Speaking',
    paragraphs: [
      'When you speak to Wherebox, your browser turns speech into text. Depending on the browser this happens on the device, or the audio goes to the browser maker (for example Google for Chrome, Apple for Safari). In the Android and iPhone apps, the phone’s own speech recognition does this instead (Google’s on Android, Apple’s on iPhone), on the phone itself when it has your language. Wherebox only receives the finished text. Reading answers aloud uses your device’s own voice.',
    ],
  },
  {
    title: 'How long we keep data',
    list: [
      'Account data: until you delete your account.',
      'Accounts unused for 24 months are deleted. We email you 4 weeks before.',
      'Sign-ups that were never confirmed: deleted after 1 day.',
      'Invite links: expire after 7 days.',
      'Server backups: kept for 30 days, encrypted. Deleted data disappears from them within 30 days.',
      'Server logs: 7 days, without IP addresses.',
    ],
    paragraphs: [],
  },
  {
    title: 'Your rights',
    paragraphs: [
      'You can see and download all your data (Art. 15 and 20) and delete your account (Art. 17) yourself in Settings › Your data. You can change your name there too. For other corrections (Art. 16), restrictions (Art. 18) or objections (Art. 21), contact us using the details above.',
      'You also have the right to complain to a data protection authority, for example the one where you live or, for us, the Bavarian Data Protection Authority (BayLDA, Promenade 18, 91522 Ansbach, www.lda.bayern.de).',
    ],
  },
  {
    title: 'Changes',
    paragraphs: ['If we change this notice in a way that matters, the app will tell you and ask you to agree again.'],
  },
]

const privacyDe: Section[] = [
  {
    paragraphs: [
      'Wherebox funktioniert auf zwei Arten. Ohne Konto bleibt alles auf deinem Gerät. Mit einem freiwilligen Konto werden deine Listen zusätzlich auf unserem Server gespeichert, damit sie zwischen deinen Geräten synchronisiert und geteilt werden können. Diese Hinweise erklären beides.',
    ],
  },
  { title: 'Verantwortlich', paragraphs: ['{controller}'] },
  {
    title: 'Ohne Konto',
    paragraphs: [
      'Alles, was du speicherst – Sachen, Orte, Notizen und Fotos – bleibt in diesem Browser auf diesem Gerät. Wir erhalten davon nichts. Sicherungen sind Dateien, die du selbst erstellst und aufbewahrst.',
      'Das Speichern deiner Liste auf deinem Gerät ist für den von dir gewünschten Dienst unbedingt erforderlich (§ 25 Abs. 2 TDDDG), daher ist kein Einwilligungsbanner nötig.',
    ],
  },
  {
    title: 'Mit Konto: was wir speichern',
    paragraphs: ['Wenn du ein Konto erstellst, speichern wir:'],
    list: [
      'deine E-Mail-Adresse und, falls du ihn angibst, deinen Namen',
      'wann du diesen Bedingungen zugestimmt hast und welcher Fassung',
      'wann du dein Konto zuletzt genutzt hast',
      'deine Listen und deren Einträge: Namen, Orte, Notizen, Verlauf, Fotos',
      'wer Mitglied welcher Liste ist und mit welcher Rolle',
      'Einladungslinks, die du erstellst (nur in verschlüsselter Form)',
    ],
  },
  {
    title: 'Wozu und auf welcher Rechtsgrundlage',
    paragraphs: [
      'Wir nutzen diese Daten nur, um bereitzustellen, was du nutzen möchtest: Anmeldung, Synchronisierung deiner Listen zwischen deinen Geräten und Teilen mit Personen, die du einlädst. Rechtsgrundlage ist der Vertrag mit dir (Art. 6 Abs. 1 lit. b DSGVO). Wir nutzen deine Daten nicht für Werbung, Analyse oder Profilbildung und verkaufen sie nicht.',
    ],
  },
  {
    title: 'Wer sie sehen kann',
    paragraphs: [
      'Personen, mit denen du eine Liste teilst, sehen diese Liste, ihre Einträge und Fotos sowie deinen Namen (oder eine gekürzte Form deiner E-Mail-Adresse, nie die vollständige Adresse). Listen, zu denen jemand nicht gehört, kann diese Person nicht sehen.',
      'Die Daten liegen auf einem Server, den wir selbst in Deutschland betreiben, auf einer verschlüsselten Festplatte. Als Betreiber könnten wir technisch darauf zugreifen, tun das aber nur, um Probleme zu beheben oder wenn das Gesetz es verlangt.',
    ],
  },
  {
    title: 'Anmelde-E-Mails',
    paragraphs: [
      'Anmeldecodes werden über Brevo (Sendinblue SAS, 106 boulevard Haussmann, 75008 Paris, Frankreich) verschickt, das deine E-Mail-Adresse und die E-Mail in unserem Auftrag auf Grundlage eines Auftragsverarbeitungsvertrags verarbeitet. Die Daten bleiben in der EU.',
    ],
  },
  {
    title: 'Bereitstellung der App',
    paragraphs: [
      'Um die App auszuliefern, erhält unser Server deine IP-Adresse und die Dateien, die dein Browser abruft. Er speichert keine IP-Adressen: Seine Protokolle enthalten nur Uhrzeit, Anfrage und Ergebnis und werden nach 7 Tagen gelöscht. Es gibt keine Cookies, keine Analyse und keine Werbung. Das ist unser berechtigtes Interesse an einem sicheren Betrieb (Art. 6 Abs. 1 lit. f DSGVO).',
      'Die Verbindung läuft über Cloudflare, Inc. (101 Townsend St, San Francisco, CA 94107, USA), das den Server schützt und die App ausliefert. Cloudflare verarbeitet deine IP-Adresse und technische Verbindungsdaten in unserem Auftrag auf Grundlage eines Auftragsverarbeitungsvertrags. Cloudflare ist nach dem EU-US Data Privacy Framework zertifiziert, das Übermittlungen in die USA abdeckt.',
    ],
  },
  {
    title: 'Sprechen',
    paragraphs: [
      'Wenn du mit Wherebox sprichst, wandelt dein Browser die Sprache in Text um. Je nach Browser passiert das auf dem Gerät, oder die Aufnahme geht an den Browser-Hersteller (zum Beispiel Google bei Chrome, Apple bei Safari). In den Apps für Android und iPhone übernimmt das die Spracherkennung des Handys (von Google bei Android, von Apple beim iPhone), direkt auf dem Handy, wenn es deine Sprache dort kennt. Wherebox erhält nur den fertigen Text. Das Vorlesen nutzt die Stimme deines Geräts.',
    ],
  },
  {
    title: 'Wie lange wir Daten speichern',
    list: [
      'Kontodaten: bis du dein Konto löschst.',
      'Konten, die 24 Monate nicht genutzt wurden, werden gelöscht. Wir schreiben dir 4 Wochen vorher.',
      'Nie bestätigte Registrierungen: nach 1 Tag gelöscht.',
      'Einladungslinks: verfallen nach 7 Tagen.',
      'Server-Sicherungen: 30 Tage, verschlüsselt. Gelöschte Daten verschwinden innerhalb von 30 Tagen daraus.',
      'Server-Protokolle: 7 Tage, ohne IP-Adressen.',
    ],
    paragraphs: [],
  },
  {
    title: 'Deine Rechte',
    paragraphs: [
      'Du kannst alle deine Daten einsehen und herunterladen (Art. 15 und 20) und dein Konto löschen (Art. 17) – selbst, unter Einstellungen › Deine Daten. Dort kannst du auch deinen Namen ändern. Für andere Berichtigungen (Art. 16), Einschränkungen (Art. 18) oder Widersprüche (Art. 21) wende dich an uns über die Angaben oben.',
      'Außerdem hast du das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren, zum Beispiel an deinem Wohnort oder, für uns zuständig, beim Bayerischen Landesamt für Datenschutzaufsicht (BayLDA, Promenade 18, 91522 Ansbach, www.lda.bayern.de).',
    ],
  },
  {
    title: 'Änderungen',
    paragraphs: ['Wenn wir diese Hinweise wesentlich ändern, sagt dir die App Bescheid und bittet dich, erneut zuzustimmen.'],
  },
]

const termsEn: Section[] = [
  {
    paragraphs: [
      'These terms apply when you create a Wherebox account. Using Wherebox without an account needs no agreement.',
    ],
  },
  {
    title: 'The service',
    paragraphs: [
      'Wherebox is free and open source. The account lets you sync your lists between your devices and share them with people you invite. We run it in our spare time and on our own hardware, so we can’t promise it will always be available, and we may change or end the service. If we end it, we’ll tell you at least 30 days before, so you can download your data.',
    ],
  },
  {
    title: 'Your content',
    paragraphs: [
      'What you save stays yours. You allow us to store it and show it to the people you share a list with – nothing more.',
      'Please only save things you’re allowed to save, don’t use Wherebox for anything illegal, and don’t try to access lists that aren’t shared with you. If you share a list, the people you invite can see what’s in it.',
    ],
  },
  {
    title: 'Keep a copy',
    paragraphs: [
      'We back up the server, but things can still go wrong. For anything important, keep your own copy: Settings › Your data › Download my data.',
    ],
  },
  {
    title: 'Liability',
    paragraphs: [
      'Wherebox is provided free of charge and as it is. We are liable without limitation for intent and gross negligence and for injury to life, body or health. For slight negligence we are liable only for breaches of essential obligations, limited to typical, foreseeable damage. Liability under the Product Liability Act remains unaffected.',
    ],
  },
  {
    title: 'Ending',
    paragraphs: [
      'You can delete your account at any time in Settings › Your data. We may close accounts that break these terms, after telling you first unless the law or an urgent risk prevents it.',
    ],
  },
  {
    title: 'Other',
    paragraphs: ['German law applies. If we change these terms, the app will ask you to agree again before you continue using your account.'],
  },
]

const termsDe: Section[] = [
  {
    paragraphs: ['Diese Bedingungen gelten, wenn du ein Wherebox-Konto erstellst. Die Nutzung ohne Konto braucht keine Zustimmung.'],
  },
  {
    title: 'Der Dienst',
    paragraphs: [
      'Wherebox ist kostenlos und Open Source. Mit dem Konto kannst du deine Listen zwischen deinen Geräten synchronisieren und mit eingeladenen Personen teilen. Wir betreiben es in unserer Freizeit auf eigener Hardware. Wir können daher nicht versprechen, dass es immer verfügbar ist, und können den Dienst ändern oder einstellen. Wenn wir ihn einstellen, sagen wir es dir mindestens 30 Tage vorher, damit du deine Daten herunterladen kannst.',
    ],
  },
  {
    title: 'Deine Inhalte',
    paragraphs: [
      'Was du speicherst, bleibt deins. Du erlaubst uns, es zu speichern und den Personen zu zeigen, mit denen du eine Liste teilst – mehr nicht.',
      'Bitte speichere nur, was du speichern darfst, nutze Wherebox für nichts Rechtswidriges und versuche nicht, auf Listen zuzugreifen, die nicht mit dir geteilt sind. Wenn du eine Liste teilst, sehen die eingeladenen Personen ihren Inhalt.',
    ],
  },
  {
    title: 'Behalte eine Kopie',
    paragraphs: [
      'Wir sichern den Server, trotzdem kann etwas schiefgehen. Für Wichtiges behalte eine eigene Kopie: Einstellungen › Deine Daten › Meine Daten herunterladen.',
    ],
  },
  {
    title: 'Haftung',
    paragraphs: [
      'Wherebox wird unentgeltlich und so, wie es ist, bereitgestellt. Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie bei Verletzung von Leben, Körper oder Gesundheit. Bei leichter Fahrlässigkeit haften wir nur bei Verletzung wesentlicher Pflichten und begrenzt auf den typischen, vorhersehbaren Schaden. Die Haftung nach dem Produkthaftungsgesetz bleibt unberührt.',
    ],
  },
  {
    title: 'Beendigung',
    paragraphs: [
      'Du kannst dein Konto jederzeit unter Einstellungen › Deine Daten löschen. Wir können Konten schließen, die gegen diese Bedingungen verstoßen – nach vorheriger Mitteilung, sofern nicht Gesetz oder eine dringende Gefahr dem entgegenstehen.',
    ],
  },
  {
    title: 'Sonstiges',
    paragraphs: ['Es gilt deutsches Recht. Wenn wir diese Bedingungen ändern, bittet dich die App um erneute Zustimmung, bevor du dein Konto weiter nutzt.'],
  },
]

export const privacy = (lang: Lang) => (lang === 'de' ? privacyDe : privacyEn)
export const terms = (lang: Lang) => (lang === 'de' ? termsDe : termsEn)
