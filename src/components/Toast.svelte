<script lang="ts">
  import { t } from '../lib/i18n'
  import { hideToast, toast } from '../lib/store.svelte'
  import Icon from './Icon.svelte'

  let { raised = true }: { raised?: boolean } = $props()
</script>

<div class="wrap" class:raised role="status" aria-live="polite">
  {#if toast.current}
    {@const current = toast.current}
    <div class="toast">
      <div class="head">
        <span class="tick"><Icon name="check" size={20} stroke={2.8} /></span>
        <span class="text">
          <span class="title">{current.title}</span>
          {#if current.text}<span class="body">{current.text}</span>{/if}
        </span>
        {#if !current.undo && !current.edit}
          <button type="button" class="x" aria-label={t('close')} onclick={hideToast}><Icon name="close" size={20} /></button>
        {/if}
      </div>
      {#if current.undo || current.edit}
        <div class="buttons">
          {#if current.undo}
            <button type="button" onclick={() => current.undo?.()}>{t('undo')}</button>
          {/if}
          {#if current.edit}
            <button
              type="button"
              onclick={() => {
                hideToast()
                current.edit?.()
              }}>{t('edit')}</button>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .wrap {
    position: fixed;
    left: 16px;
    right: 16px;
    bottom: calc(24px + env(safe-area-inset-bottom));
    z-index: 30;
    display: flex;
    justify-content: center;
    pointer-events: none;
  }
  .raised {
    bottom: calc(var(--nav-h) + 14px + env(safe-area-inset-bottom));
  }
  .toast {
    pointer-events: auto;
    width: 100%;
    max-width: 480px;
    background: var(--toast-bg);
    color: var(--toast-text);
    border-radius: 18px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    box-shadow: var(--shadow);
    animation: rise 0.18s ease-out;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .tick {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: #1f6b45;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .title {
    font-size: 15px;
    color: var(--toast-muted);
  }
  .body {
    font-size: 20px;
    font-weight: 700;
  }
  .text .title:only-child {
    font-size: 18px;
    font-weight: 700;
    color: inherit;
  }
  .x {
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
  .buttons {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    gap: 10px;
  }
  .buttons button {
    min-height: 52px;
    border-radius: 12px;
    border: 1px solid color-mix(in srgb, currentColor 40%, transparent);
    background: transparent;
    font-size: 17px;
    font-weight: 700;
  }
  @keyframes rise {
    from {
      transform: translateY(12px);
      opacity: 0;
    }
  }
</style>
