<script lang="ts">
  import { onMount, untrack } from 'svelte'
  import Icon from './components/Icon.svelte'
  import Nav from './components/Nav.svelte'
  import Toast from './components/Toast.svelte'
  import { t } from './lib/i18n'
  import { go, route } from './lib/router.svelte'
  import { applyTheme, settings } from './lib/settings.svelte'
  import { data, hideToast, toast } from './lib/store.svelte'
  import Confirm from './screens/Confirm.svelte'
  import Find from './screens/Find.svelte'
  import Home from './screens/Home.svelte'
  import ItemDetail from './screens/ItemDetail.svelte'
  import Onboarding from './screens/Onboarding.svelte'
  import Places from './screens/Places.svelte'
  import Privacy from './screens/Privacy.svelte'
  import Settings from './screens/Settings.svelte'
  import Voice from './screens/Voice.svelte'

  const screens = { find: Find, item: ItemDetail, confirm: Confirm, places: Places, settings: Settings, listen: Voice, welcome: Onboarding, privacy: Privacy }
  // On wide screens these open beside Home instead of replacing it.
  const sideBySide = new Set(['home', 'find', 'item', 'confirm'])

  let wide = $state(matchMedia('(min-width: 900px)').matches)
  const name = $derived(route.current.name)
  const Screen = $derived(screens[name as keyof typeof screens])
  const fullscreen = $derived(name === 'listen' || name === 'welcome')
  // Phones show the tab bar only on the top-level screens, like the designs.
  const tabs = $derived(['home', 'places', 'settings'].includes(name))

  // A saved/moved toast belongs to Home; drop it once the user moves on.
  $effect(() => {
    if (name !== 'home') untrack(() => toast.current?.undo && hideToast())
  })

  onMount(() => {
    applyTheme()
    const dark = matchMedia('(prefers-color-scheme: dark)')
    dark.addEventListener('change', applyTheme)
    const mq = matchMedia('(min-width: 900px)')
    mq.addEventListener('change', (e) => (wide = e.matches))

    // First launch shows the short introduction, unless opened via the quick-start link.
    if (!settings.onboarded && name !== 'listen') go('welcome', {}, true)

    // In-app links go through the router so Back stays inside the app.
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element).closest?.('a[href^="#/"]')
      if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return
      e.preventDefault()
      const [path, qs] = a.getAttribute('href')!.slice(2).split('?')
      go(path, Object.fromEntries(new URLSearchParams(qs ?? '')))
    }
    document.addEventListener('click', onClick)

    // Keyboard users on desktop: "/" jumps to the input.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || (e.target as Element).closest('input, textarea')) return
      const q = document.getElementById('q')
      if (q) {
        e.preventDefault()
        q.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', onClick)
      document.removeEventListener('keydown', onKey)
    }
  })
</script>

{#if data.storageError}
  <div class="screen">
    <main class="blocked">
      <span class="hint-icon"><Icon name="alert" size={30} stroke={2} /></span>
      <h1 tabindex="-1">{t('storage.title')}</h1>
      <p class="muted">{t('storage.text')}</p>
      <button type="button" class="btn btn-primary" onclick={() => location.reload()}>{t('storage.retry')}</button>
    </main>
  </div>
{:else if fullscreen}
  <Screen />
{:else}
  {#if wide}<Nav />{/if}
  {#if wide && sideBySide.has(name)}
    <div class="split">
      <div class="left"><Home compact /></div>
      <div class="right">
        {#if Screen}
          {#key route.current}<Screen />{/key}
        {:else}
          <div class="hint card">
            <span class="hint-icon"><Icon name="search" size={30} stroke={2} /></span>
            <p>{t('home.askHint')}</p>
          </div>
        {/if}
      </div>
    </div>
  {:else if Screen}
    {#key route.current}<Screen />{/key}
  {:else}
    <div class="screen has-nav">
      <main class="home-main"><Home /></main>
    </div>
  {/if}
  {#if !wide && tabs}<Nav />{/if}
{/if}
<Toast raised={!wide && tabs && !fullscreen} />

<style>
  .blocked {
    justify-content: center;
  }
  .blocked p {
    font-size: 18px;
    line-height: 1.5;
  }
  .home-main {
    padding-bottom: calc(var(--nav-h) + 24px) !important;
  }
  .split {
    max-width: 1120px;
    margin: 0 auto;
    padding: 40px 24px;
    display: grid;
    grid-template-columns: minmax(340px, 1fr) minmax(340px, 1fr);
    gap: 32px;
    align-items: start;
  }
  .right :global(.screen) {
    min-height: 0;
    padding-top: 0;
  }
  .right :global(.topbar),
  .right :global(.screen > main) {
    padding-left: 0;
    padding-right: 0;
  }
  .right :global(.topbar) {
    padding-top: 0;
  }
  .right :global(.actions),
  .right :global(main > .actions) {
    position: static;
    margin: 0;
    padding: 0;
    background: transparent;
    border: 0;
  }
  .right :global(.actions > *) {
    max-width: none;
    margin: 0;
  }
  .hint {
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
    margin-top: 58px;
  }
  .hint p {
    font-size: 20px;
    font-weight: 700;
  }
  .hint-icon {
    width: 56px;
    height: 56px;
    border-radius: 16px;
    background: var(--tint);
    color: var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  @media (min-width: 900px) {
    :global(.screen.has-nav main) {
      padding-bottom: 40px !important;
      padding-top: 24px;
    }
  }
</style>
