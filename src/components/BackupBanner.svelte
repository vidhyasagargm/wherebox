<script lang="ts">
  import { t } from '../lib/i18n'
  import { DAY, saveSettings, settings } from '../lib/settings.svelte'
  import { data } from '../lib/store.svelte'
  import Icon from './Icon.svelte'

  const now = Date.now()
  const oldest = $derived(Math.min(now, ...data.items.map((i) => i.createdAt)))
  const days = $derived(settings.lastBackup ? Math.floor((now - settings.lastBackup) / DAY) : null)
  // Noticeable but not nagging: only once there's something worth losing, and snoozable for a week.
  const show = $derived(
    data.items.length >= 3 && now > settings.backupSnoozedUntil && (days === null ? now - oldest > 3 * DAY : days >= 30),
  )

  function later() {
    settings.backupSnoozedUntil = Date.now() + 7 * DAY
    saveSettings()
  }
</script>

{#if show}
  <div class="banner" role="status">
    <span class="text">
      <strong>{days === null ? t('banner.noBackup') : t('banner.backup', { n: days })}</strong>
      <a href="#/settings">{t('banner.backupNow')}</a>
    </span>
    <button type="button" aria-label={t('banner.later')} onclick={later}><Icon name="close" size={20} /></button>
  </div>
{/if}

<style>
  .banner {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 6px 8px 16px;
    border-radius: 16px;
    background: var(--tint);
    border: 1px solid color-mix(in srgb, var(--primary) 25%, transparent);
    color: var(--accent-text);
  }
  .text {
    flex: 1;
    font-size: 16px;
    line-height: 1.35;
  }
  a {
    font-weight: 700;
    color: inherit;
    display: inline-block;
    padding: 4px 0;
  }
  button {
    width: 44px;
    height: 44px;
    border: 0;
    border-radius: 12px;
    background: transparent;
    color: inherit;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
