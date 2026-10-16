<script lang="ts">
  import type { Snippet } from 'svelte'
  import { t } from '../lib/i18n'
  import { back } from '../lib/router.svelte'
  import Icon from './Icon.svelte'

  let { label, icon = 'back', children, end }: { label?: string; icon?: 'back' | 'close'; children?: Snippet; end?: Snippet } = $props()
</script>

<header class="topbar">
  <button type="button" class="icon-btn" aria-label={label ?? (icon === 'close' ? t('close') : t('back'))} onclick={() => back()}>
    <Icon name={icon} size={22} />
  </button>
  <span class="muted" style="flex: 1">{@render children?.()}</span>
  {@render end?.()}
</header>
