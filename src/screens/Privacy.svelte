<script lang="ts">
  import TopBar from '../components/TopBar.svelte'
  import { date, t } from '../lib/i18n'
  import { LEGAL_UPDATED, privacy, terms, type Section } from '../lib/legal'
  import { route } from '../lib/router.svelte'
  import { settings } from '../lib/settings.svelte'

  // Shows the privacy notice (#/privacy), the terms (#/terms) or the imprint (#/privacy?imprint=1).
  // The operator's details come from the build (VITE_IMPRINT), since they name whoever runs this copy.
  const imprint = (import.meta.env.VITE_IMPRINT ?? '').split('|').map((l) => l.trim()).filter(Boolean)
  const page = route.current.name === 'terms' ? 'terms' : route.current.query.has('imprint') ? 'imprint' : 'privacy'
  const sections: Section[] = $derived(page === 'terms' ? terms(settings.lang) : privacy(settings.lang))
</script>

<div class="screen">
  <TopBar />
  <main>
    {#if page === 'imprint'}
      <h1 tabindex="-1">{t('imprint.title')}</h1>
      <address>
        {#each imprint as line, i (i)}<span>{line}</span>{/each}
      </address>
    {:else}
      <h1 tabindex="-1">{page === 'terms' ? t('terms.title') : t('privacy.title')}</h1>
      <p class="muted small">{t('privacy.updated', { date: date(LEGAL_UPDATED, true) })}</p>
      {#each sections as s, i (i)}
        {#if s.title}<h2>{s.title}</h2>{/if}
        {#each s.paragraphs as p, j (j)}
          {#if p === '{controller}'}
            {#if imprint.length}
              <address>{#each imprint as line, k (k)}<span>{line}</span>{/each}</address>
            {:else}
              <p>{t('privacy.controllerNone')}</p>
            {/if}
          {:else}
            <p>{p}</p>
          {/if}
        {/each}
        {#if s.list}
          <ul>
            {#each s.list as item, j (j)}<li>{item}</li>{/each}
          </ul>
        {/if}
      {/each}
      <p class="links">
        {#if page === 'terms'}<a href="#/privacy">{t('privacy.title')}</a>{:else}<a href="#/terms">{t('terms.title')}</a>{/if}
        {#if imprint.length}<a href="#/privacy?imprint=1">{t('imprint.title')}</a>{/if}
      </p>
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
  p,
  li {
    font-size: 17px;
    line-height: 1.55;
  }
  ul {
    margin: 0;
    padding-left: 22px;
    display: flex;
    flex-direction: column;
    gap: 6px;
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
  .links {
    display: flex;
    gap: 20px;
    font-weight: 600;
  }
  .links a {
    min-height: 44px;
    display: inline-flex;
    align-items: center;
  }
</style>
