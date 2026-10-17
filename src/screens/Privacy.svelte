<script lang="ts">
  import TopBar from '../components/TopBar.svelte'
  import { date, t } from '../lib/i18n'
  import { route } from '../lib/router.svelte'

  // The imprint comes from the build (VITE_IMPRINT), since it names the person running this copy.
  const imprint = (import.meta.env.VITE_IMPRINT ?? '').split('|').map((l) => l.trim()).filter(Boolean)
  const showImprint = route.current.query.has('imprint')
  // Change this when the text below changes.
  const updated = new Date(2026, 9, 17).getTime()
</script>

<div class="screen">
  <TopBar />
  <main>
    {#if showImprint}
      <h1 tabindex="-1">{t('imprint.title')}</h1>
      <address>
        {#each imprint as line, i (i)}<span>{line}</span>{/each}
      </address>
    {:else}
      <h1 tabindex="-1">{t('privacy.title')}</h1>
      <p class="muted small">{t('privacy.updated', { date: date(updated, true) })}</p>
      <p>{t('privacy.p1')}</p>
      <p>{t('privacy.p2')}</p>

      <h2>{t('privacy.controllerTitle')}</h2>
      {#if imprint.length}
        <address>
          {#each imprint as line, i (i)}<span>{line}</span>{/each}
        </address>
      {:else}
        <p>{t('privacy.controllerNone')}</p>
      {/if}

      <h2>{t('privacy.serverTitle')}</h2>
      <p>{t('privacy.p4')}</p>

      <h2>{t('privacy.cfTitle')}</h2>
      <p>{t('privacy.cf')}</p>

      <h2>{t('privacy.voiceTitle')}</h2>
      <p>{t('privacy.p3')}</p>

      <h2>{t('privacy.basisTitle')}</h2>
      <p>{t('privacy.basis')}</p>

      <h2>{t('privacy.rightsTitle')}</h2>
      <p>{t('privacy.rights')}</p>

      <h2>{t('privacy.deleteTitle')}</h2>
      <p>{t('privacy.p5')}</p>
    {/if}
  </main>
</div>

<style>
  main {
    gap: 14px !important;
  }
  h2 {
    margin-top: 10px;
  }
  p {
    font-size: 17px;
    line-height: 1.55;
  }
  .small {
    font-size: 15px;
    margin-top: -6px;
  }
  address {
    font-style: normal;
    font-size: 17px;
    line-height: 1.6;
    display: flex;
    flex-direction: column;
  }
</style>
