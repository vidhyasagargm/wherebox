<script lang="ts">
  import { onMount } from 'svelte'
  import Icon from '../components/Icon.svelte'
  import { exportBackup, importBackup, readBackup } from '../lib/backup'
  import { date, t } from '../lib/i18n'
  import { go } from '../lib/router.svelte'
  import { applyTheme, DAY, saveSettings, settings, type ReadAloud, type Theme } from '../lib/settings.svelte'
  import { canTalk } from '../lib/talk'
  import { isIOS } from '../lib/speech'
  import { data, showToast } from '../lib/store.svelte'

  let fileInput: HTMLInputElement
  const hasImprint = !!import.meta.env.VITE_IMPRINT
  let persisted = $state(false)
  const days = $derived(settings.lastBackup ? Math.floor((Date.now() - settings.lastBackup) / DAY) : null)
  const quickLink = `${location.origin}${location.pathname}#/listen`

  onMount(async () => {
    persisted = (await navigator.storage?.persisted?.()) ?? false
  })

  async function doExport() {
    try {
      await exportBackup()
      settings.lastBackup = Date.now()
      saveSettings()
      showToast({ title: t('settings.exported') }, 3000)
    } catch {
      // Cancelled share sheet: nothing was saved, so keep the old date.
    }
  }

  async function doImport(e: Event) {
    const input = e.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    try {
      const backup = await readBackup(file)
      if (!confirm(t('settings.importConfirm', { n: backup.items.length }))) return
      const n = await importBackup(backup)
      showToast({ title: t('settings.imported', { n }) }, 4000)
    } catch {
      alert(t('settings.importFailed'))
    }
  }

  function setLang(lang: 'en' | 'de') {
    settings.lang = lang
    saveSettings()
    applyTheme()
  }

  function setTheme(theme: Theme) {
    settings.theme = theme
    saveSettings()
    applyTheme()
  }

  async function copyLink() {
    await navigator.clipboard?.writeText(quickLink)
    showToast({ title: t('settings.copied') }, 2500)
  }

  function showIntro() {
    settings.onboarded = false
    saveSettings()
    go('welcome')
  }

  const readModes: { value: ReadAloud; label: () => string }[] = [
    { value: 'off', label: () => t('settings.readOff') },
    { value: 'voice', label: () => t('settings.readVoice') },
    { value: 'always', label: () => t('settings.readAlways') },
  ]

  function setReadAloud(mode: ReadAloud) {
    settings.readAloud = mode
    saveSettings()
  }

  const themes: { value: Theme; label: () => string }[] = [
    { value: 'light', label: () => t('settings.light') },
    { value: 'dark', label: () => t('settings.dark') },
    { value: 'system', label: () => t('settings.system') },
  ]
</script>

<div class="screen has-nav">
  <main>
    <h1 tabindex="-1" class="title">{t('settings.title')}</h1>

    <section aria-labelledby="backup">
      <h2 id="backup">{t('settings.backup')}</h2>
      <div class="card backup">
        <div class="last" class:stale={days === null || days >= 30}>
          <span class="muted">{t('settings.lastBackup')}</span>
          <strong>{settings.lastBackup ? date(settings.lastBackup, true) : t('settings.never')}</strong>
          {#if days !== null && days >= 30}<span class="warn">{t('settings.ago', { n: days })}</span>{/if}
        </div>
        <p class="note"><Icon name="alert" size={22} stroke={2} /><span>{t('settings.warning')}</span></p>
        {#if persisted}<p class="ok"><Icon name="shield" size={20} stroke={2} />{t('settings.persisted')}</p>{/if}
        <button type="button" class="btn btn-primary" onclick={doExport} disabled={!data.items.length}><Icon name="download" />{t('settings.export')}</button>
        <button type="button" class="btn" onclick={() => fileInput.click()}><Icon name="upload" />{t('settings.import')}</button>
        <input bind:this={fileInput} class="sr" type="file" accept="application/json,.json" tabindex="-1" aria-hidden="true" onchange={doImport} />
      </div>
    </section>

    <section aria-labelledby="lang">
      <h2 id="lang">{t('settings.language')}</h2>
      <div class="seg">
        <button type="button" aria-pressed={settings.lang === 'en'} onclick={() => setLang('en')} lang="en">English</button>
        <button type="button" aria-pressed={settings.lang === 'de'} onclick={() => setLang('de')} lang="de">Deutsch</button>
      </div>
    </section>

    <section aria-labelledby="theme">
      <h2 id="theme">{t('settings.theme')}</h2>
      <div class="seg">
        {#each themes as th (th.value)}
          <button type="button" aria-pressed={settings.theme === th.value} onclick={() => setTheme(th.value)}>{th.label()}</button>
        {/each}
      </div>
    </section>

    {#if canTalk()}
      <section aria-labelledby="read">
        <h2 id="read">{t('settings.readAloud')}</h2>
        <div class="seg">
          {#each readModes as m (m.value)}
            <button type="button" aria-pressed={settings.readAloud === m.value} onclick={() => setReadAloud(m.value)}>{m.label()}</button>
          {/each}
        </div>
      </section>
    {/if}

    <section aria-labelledby="quick">
      <h2 id="quick">{t('settings.quick')}</h2>
      <div class="card quick">
        <p><Icon name="bolt" size={22} stroke={2} /><span>{t('settings.quickText')}</span></p>
        <code>{quickLink}</code>
        <button type="button" class="btn" onclick={copyLink}><Icon name="copy" />{t('settings.copy')}</button>
        <details>
          <summary>{t('settings.howTo')}</summary>
          {#if settings.lang === 'de'}
            {#if isIOS}
              <ol>
                <li>Öffne die App <strong>Kurzbefehle</strong> und tippe auf <strong>+</strong>.</li>
                <li>Füge <strong>URL öffnen</strong> hinzu und füge den Link oben ein.</li>
                <li>Einstellungen › Bedienungshilfen › Tippen › <strong>Auf Rückseite tippen</strong> › Doppeltippen › deinen Kurzbefehl wählen. Oder: Einstellungen › <strong>Aktionstaste</strong> › Kurzbefehl.</li>
              </ol>
              <p class="muted small">Hinweis: Auf dem iPhone öffnet der Link Safari. Safari und die Home-Bildschirm-App haben getrennte Daten – nutze also eins von beiden.</p>
            {:else}
              <ol>
                <li>Installiere Wherebox. Halte dann das App-Symbol gedrückt und ziehe <strong>Sprechen</strong> als eigenes Symbol auf den Startbildschirm.</li>
                <li>Pixel: Einstellungen › System › Gesten › <strong>Quick Tap</strong> › App öffnen › Wherebox.</li>
                <li>Samsung: Einstellungen › Erweiterte Funktionen › <strong>Seitentaste</strong> › Zweimal drücken › App öffnen.</li>
              </ol>
            {/if}
          {:else if isIOS}
            <ol>
              <li>Open the <strong>Shortcuts</strong> app and tap <strong>+</strong>.</li>
              <li>Add <strong>Open URLs</strong> and paste the link above.</li>
              <li>Settings › Accessibility › Touch › <strong>Back Tap</strong> › Double Tap › pick your shortcut. Or: Settings › <strong>Action Button</strong> › Shortcut.</li>
            </ol>
            <p class="muted small">Note: on iPhone the link opens Safari. Safari and the home-screen app keep separate data, so stick to one of them.</p>
          {:else}
            <ol>
              <li>Install Wherebox. Then long-press its icon and drag <strong>Speak</strong> onto your home screen as its own button.</li>
              <li>Pixel: Settings › System › Gestures › <strong>Quick Tap</strong> › Open app › Wherebox.</li>
              <li>Samsung: Settings › Advanced features › <strong>Side button</strong> › Double press › Open app.</li>
            </ol>
          {/if}
        </details>
      </div>
    </section>

    <section aria-labelledby="about">
      <h2 id="about">{t('settings.about')}</h2>
      <div class="card about">
        <p>{t('settings.aboutText', { v: __APP_VERSION__ })}</p>
        <div class="links">
          <a class="chip" href={import.meta.env.VITE_REPO_URL} target="_blank" rel="noopener"><Icon name="code" size={20} />{t('settings.code')}</a>
          <a class="chip coffee" href={import.meta.env.VITE_COFFEE_URL} target="_blank" rel="noopener"><Icon name="coffee" size={20} />{t('settings.coffee')}</a>
        </div>
        <div class="legal">
          <a href="#/privacy">{t('settings.privacy')}</a>
          {#if hasImprint}<a href="#/privacy?imprint=1">{t('settings.imprint')}</a>{/if}
        </div>
        <button type="button" class="btn-link" onclick={showIntro}>{t('settings.showIntro')}</button>
      </div>
    </section>
  </main>
</div>

<style>
  main {
    padding-bottom: calc(var(--nav-h) + 24px) !important;
    gap: 26px !important;
  }
  .title {
    padding-top: 12px;
  }
  section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .card {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .last {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .last strong {
    font-size: 22px;
  }
  .warn {
    font-size: 16px;
    font-weight: 700;
    color: var(--danger);
  }
  .note,
  .ok,
  .quick p {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    font-size: 16px;
    line-height: 1.45;
  }
  .note {
    padding: 12px;
    border-radius: 12px;
    background: var(--bg);
  }
  .note :global(svg),
  .ok :global(svg),
  .quick p :global(svg) {
    flex-shrink: 0;
    margin-top: 1px;
  }
  .ok {
    color: var(--accent-text);
    font-size: 15px;
  }
  .btn:disabled {
    opacity: 0.5;
  }
  code {
    font-size: 15px;
    padding: 10px 12px;
    border-radius: 10px;
    background: var(--bg);
    word-break: break-all;
  }
  details {
    font-size: 16px;
  }
  summary {
    min-height: 44px;
    display: flex;
    align-items: center;
    font-weight: 700;
    color: var(--accent);
    cursor: pointer;
  }
  ol {
    margin: 4px 0 8px;
    padding-left: 22px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    line-height: 1.45;
  }
  .small {
    font-size: 15px;
  }
  .about p {
    font-size: 17px;
  }
  .links {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .links a {
    text-decoration: none;
    color: var(--text);
  }
  .legal {
    display: flex;
    gap: 20px;
    font-size: 16px;
    font-weight: 600;
  }
  .legal a {
    min-height: 44px;
    display: flex;
    align-items: center;
  }
  .coffee {
    background: #fff4d6;
    border-color: #e9cf86;
    color: #4a3800 !important;
  }
</style>
