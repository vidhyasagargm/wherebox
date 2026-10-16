<script lang="ts">
  import { t } from '../lib/i18n'
  import { install, iosNeedsManualInstall, promptInstall } from '../lib/install.svelte'
  import { DAY, saveSettings, settings } from '../lib/settings.svelte'
  import Icon from './Icon.svelte'
  import Logo from './Logo.svelte'

  const show = $derived(!install.installed && settings.onboarded && Date.now() > settings.installDismissedUntil && (install.event || iosNeedsManualInstall()))

  function notNow() {
    settings.installDismissedUntil = Date.now() + 14 * DAY
    saveSettings()
  }
</script>

{#if show}
  <section class="card install" aria-labelledby="install-title">
    <div class="head">
      <Logo size={48} />
      <div>
        <h2 id="install-title">{t('install.title')}</h2>
        <p class="muted">{t('install.text')}</p>
      </div>
    </div>
    {#if install.event}
      <button type="button" class="btn btn-primary" onclick={promptInstall}><Icon name="download" />{t('install.button')}</button>
    {:else}
      <p class="ios"><Icon name="share" size={22} /><span>{t('install.ios')}</span></p>
    {/if}
    <button type="button" class="btn-link" onclick={notNow}>{t('install.notNow')}</button>
  </section>
{/if}

<style>
  .install {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
  }
  .head {
    display: flex;
    gap: 14px;
    align-items: flex-start;
  }
  .head p {
    font-size: 16px;
    margin-top: 2px;
  }
  .ios {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    font-size: 16px;
    padding: 12px;
    border-radius: 12px;
    background: var(--tint);
    color: var(--accent-text);
  }
  .ios :global(svg) {
    flex-shrink: 0;
    margin-top: 1px;
  }
  .btn-link {
    min-height: 44px;
  }
</style>
