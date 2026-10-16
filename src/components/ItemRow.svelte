<script lang="ts">
  import type { Item } from '../lib/db'
  import { ago } from '../lib/i18n'

  let { item, fresh = false }: { item: Item; fresh?: boolean } = $props()
</script>

<a class="row" class:fresh href={'#/item/' + item.id}>
  <span class="row-main">
    <span class="row-title">{item.name}</span>
    <span class="row-sub">{item.where}</span>
  </span>
  <span class="row-meta">{ago(item.since)}</span>
</a>

<style>
  .fresh {
    background: var(--tint);
  }
  .fresh .row-sub,
  .fresh .row-meta {
    color: var(--accent-text);
    font-weight: 600;
  }
</style>
