<script lang="ts">
  import { t } from '../lib/i18n'
  import { route } from '../lib/router.svelte'
  import Icon, { type IconName } from './Icon.svelte'
  import Logo from './Logo.svelte'

  const tabs: { href: string; name: string; label: () => string; icon: IconName }[] = [
    { href: '#/', name: 'home', label: () => t('nav.home'), icon: 'home' },
    { href: '#/places', name: 'places', label: () => t('nav.places'), icon: 'pin' },
    { href: '#/settings', name: 'settings', label: () => t('nav.settings'), icon: 'sliders' },
  ]
  const active = (name: string) => route.current.name === name || (name === 'home' && ['find', 'item', 'confirm'].includes(route.current.name))
</script>

<nav aria-label={t('nav.main')}>
  <a class="brand" href="#/"><Logo size={32} /><span>{t('appName')}</span></a>
  <div class="tabs">
    {#each tabs as tab (tab.name)}
      <a href={tab.href} aria-current={active(tab.name) ? 'page' : undefined}>
        <Icon name={tab.icon} size={26} stroke={active(tab.name) ? 2.2 : 1.8} />
        <span>{tab.label()}</span>
      </a>
    {/each}
  </div>
</nav>

<style>
  nav {
    position: fixed;
    inset: auto 0 0 0;
    z-index: 10;
    background: var(--surface);
    border-top: 1px solid var(--border);
    padding: 6px 12px calc(10px + env(safe-area-inset-bottom));
  }
  .brand {
    display: none;
  }
  .tabs {
    display: flex;
    max-width: 640px;
    margin: 0 auto;
  }
  .tabs a {
    flex: 1;
    min-height: 64px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    text-decoration: none;
    color: var(--muted);
    font-size: 14px;
    font-weight: 500;
    border-radius: 14px;
    text-align: center;
  }
  .tabs a[aria-current='page'] {
    color: var(--accent);
    font-weight: 700;
  }

  /* Tablet and desktop: navigation moves to a top bar. */
  @media (min-width: 900px) {
    nav {
      position: sticky;
      inset: 0 0 auto 0;
      border-top: 0;
      border-bottom: 1px solid var(--border);
      padding: 10px 24px;
      display: flex;
      align-items: center;
      gap: 24px;
      max-width: none;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      flex: 1;
      max-width: 1120px;
      text-decoration: none;
      color: var(--text);
      font-weight: 800;
      font-size: 19px;
    }
    .tabs {
      margin: 0;
      gap: 6px;
    }
    .tabs a {
      flex-direction: row;
      min-height: 48px;
      padding: 0 16px;
      font-size: 16px;
      gap: 8px;
    }
    .tabs a[aria-current='page'] {
      background: var(--tint);
      color: var(--accent-text);
    }
  }
</style>
