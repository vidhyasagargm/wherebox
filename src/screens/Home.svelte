<script lang="ts">
  import BackupBanner from '../components/BackupBanner.svelte'
  import Icon from '../components/Icon.svelte'
  import InstallCard from '../components/InstallCard.svelte'
  import ItemRow from '../components/ItemRow.svelte'
  import Logo from '../components/Logo.svelte'
  import { t } from '../lib/i18n'
  import { go, route } from '../lib/router.svelte'
  import { saveSettings, settings } from '../lib/settings.svelte'
  import { canListen } from '../lib/speech'
  import { data, handle } from '../lib/store.svelte'
  import { unlockTalk } from '../lib/talk'
  import { account } from '../lib/account.svelte'

  let { compact = false }: { compact?: boolean } = $props()

  const syncLabel = $derived(
    account.expired
      ? t('account.expired')
      : account.status === 'offline'
        ? t('account.offline')
        : account.status === 'error'
          ? t('account.error')
          : account.status === 'syncing'
            ? t('account.syncing')
            : t('account.synced', { when: '' }).trim(),
  )

  let text = $state('')
  let input: HTMLInputElement
  let keyboardTip = $state(route.current.query.has('dictate'))
  // Set after Tap to speak falls back to keyboard dictation, so the answer is read aloud.
  let dictating = route.current.query.has('dictate')
  const recents = $derived(data.items.slice(0, compact ? 8 : 6))
  const freshId = $derived(data.items[0] && Date.now() - data.items[0].updatedAt < 60_000 ? data.items[0].id : null)

  async function submit(e: SubmitEvent) {
    e.preventDefault()
    const value = text.trim()
    if (!value) return input.focus()
    text = ''
    input.blur()
    const spoken = dictating
    dictating = false
    await handle(value, { spoken })
  }

  function speak() {
    unlockTalk()
    if (canListen()) go('listen')
    else {
      // No in-app recognition here (e.g. iPhone home-screen app): the keyboard's mic is the next best.
      keyboardTip = true
      dictating = true
      input.focus()
    }
  }

  function toggleLang() {
    settings.lang = settings.lang === 'en' ? 'de' : 'en'
    document.documentElement.lang = settings.lang
    saveSettings()
  }

  function tryExample() {
    handle(t('home.emptyExample'))
  }
</script>

<div class="home" class:compact>
  {#if !compact}
    <header class="head">
      <span class="brand"><Logo /><span>{t('appName')}</span></span>
      {#if account.user}
        <a class="sync" class:warn={account.expired || account.status === 'error'} href="#/settings" aria-label={`${t('account.status')}: ${syncLabel}`}>
          <Icon name={account.status === 'offline' ? 'cloudOff' : account.status === 'syncing' ? 'sync' : account.expired || account.status === 'error' ? 'alert' : 'cloudCheck'} size={24} stroke={2} />
        </a>
      {/if}
      <button type="button" class="chip" aria-label={t('lang.switch')} onclick={toggleLang}>
        <span aria-hidden="true">{settings.lang === 'en' ? 'EN' : 'DE'} / {settings.lang === 'en' ? 'DE' : 'EN'}</span>
      </button>
    </header>
  {/if}

  <section class="ask">
    <h1 tabindex="-1">{t('home.title')}</h1>
    <form onsubmit={submit}>
      <label for="q" class="sr">{t('home.inputLabel')}</label>
      <div class="bar">
        <input
          id="q"
          class="input"
          type="text"
          bind:this={input}
          bind:value={text}
          placeholder={t('home.placeholder')}
          autocomplete="off"
          autocapitalize="sentences"
          enterkeyhint="go"
          onblur={() => (keyboardTip = false)} />
        {#if text.trim()}
          <button type="submit" class="go" aria-label={t('home.go')}><Icon name="chevron" size={26} stroke={2.6} /></button>
        {/if}
      </div>
      {#if keyboardTip}
        <p class="tip" role="status"><Icon name="keyboard" size={22} />{t('voice.keyboardTip')}</p>
      {/if}
      <button type="button" class="btn btn-primary" onclick={speak}><Icon name="mic" size={26} />{t('home.speak')}</button>
    </form>
  </section>

  <BackupBanner />
  <InstallCard />

  {#if data.loaded && data.items.length === 0}
    <section class="empty card" aria-labelledby="empty-title">
      <h2 id="empty-title">{t('home.emptyTitle')}</h2>
      <p class="muted">{t('home.emptyText')}</p>
      <button type="button" class="example" onclick={tryExample}>“{t('home.emptyExample')}”</button>
    </section>
  {:else if recents.length}
    <section class="recent" aria-labelledby="recent-title">
      <div class="recent-head">
        <h2 id="recent-title">{t('home.recent')}</h2>
        <a href="#/places">{t('home.seeAll')}</a>
      </div>
      <ul class="list">
        {#each recents as item (item.id)}
          <li><ItemRow {item} fresh={item.id === freshId} /></li>
        {/each}
      </ul>
    </section>
  {/if}
</div>

<style>
  .home {
    display: flex;
    flex-direction: column;
    gap: 22px;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 4px;
  }
  .head {
    gap: 8px;
  }
  .brand {
    flex: 1;

    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 800;
    font-size: 19px;
    letter-spacing: -0.01em;
  }
  .sync {
    width: 48px;
    height: 48px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent);
  }
  .sync.warn {
    color: var(--danger);
  }
  .ask {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  form {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .bar {
    position: relative;
  }
  .bar .input {
    padding-right: 68px;
  }
  .go {
    position: absolute;
    right: 6px;
    top: 50%;
    transform: translateY(-50%);
    width: 52px;
    height: 52px;
    border: 0;
    border-radius: 12px;
    background: var(--primary);
    color: var(--on-primary);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .tip {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border-radius: 14px;
    background: var(--tint);
    color: var(--accent-text);
    font-size: 16px;
    font-weight: 600;
  }
  .recent {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .recent-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .recent-head a {
    min-height: 44px;
    display: flex;
    align-items: center;
    font-size: 16px;
    font-weight: 600;
    text-decoration: none;
  }
  .empty {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .empty p {
    font-size: 17px;
  }
  .example {
    min-height: 64px;
    padding: 12px 16px;
    border-radius: 14px;
    border: 2px dashed var(--primary);
    background: var(--tint);
    color: var(--accent-text);
    font-size: 18px;
    font-weight: 700;
    text-align: left;
  }
</style>
