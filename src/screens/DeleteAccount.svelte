<script lang="ts">
  import Icon from '../components/Icon.svelte'
  import TopBar from '../components/TopBar.svelte'
  import { account } from '../lib/account.svelte'
  import { t } from '../lib/i18n'
  import { go } from '../lib/router.svelte'
  import { data, showToast } from '../lib/store.svelte'

  let keep = $state(true)
  let busy = $state(false)

  const own = $derived(data.lists.filter((l) => l.role === 'owner'))
  const shared = $derived(data.lists.filter((l) => l.role !== 'owner'))

  async function download() {
    const { downloadMyData } = await import('../lib/gdpr')
    try {
      await downloadMyData()
    } catch (e) {
      if ((e as Error).name !== 'AbortError') showToast({ title: navigator.onLine ? t('lists.failed') : t('lists.offline') }, 4000)
    }
  }

  async function remove() {
    if (!confirm(t('delete.confirmAgain'))) return
    busy = true
    try {
      const { deleteAccount } = await import('../lib/gdpr')
      await deleteAccount(keep)
      showToast({ title: t('delete.done') }, 4000)
      go('', {}, true)
    } catch {
      showToast({ title: navigator.onLine ? t('lists.failed') : t('lists.offline') }, 4000)
    } finally {
      busy = false
    }
  }
</script>

<div class="screen">
  <TopBar />
  <main>
    {#if !account.user}
      <h1 tabindex="-1">{t('delete.done')}</h1>
    {:else}
      <span class="badge" aria-hidden="true"><Icon name="alert" size={30} stroke={2} /></span>
      <h1 tabindex="-1">{t('delete.title')}</h1>
      <p class="lead">{t('delete.intro')}</p>
      {#if own.length}
        <section>
          <p>{t('delete.own')}</p>
          <ul>
            {#each own as l (l.id)}<li>{l.name}</li>{/each}
          </ul>
        </section>
      {/if}
      {#if shared.length}
        <section>
          <p>{t('delete.shared')}</p>
          <ul>
            {#each shared as l (l.id)}<li>{l.name}{l.ownerName ? ` · ${l.ownerName}` : ''}</li>{/each}
          </ul>
        </section>
      {/if}
      <label class="keep">
        <input type="checkbox" bind:checked={keep} />
        <span><strong>{t('delete.keep')}</strong><br /><span class="muted">{t('delete.keepHint')}</span></span>
      </label>
      <button type="button" class="btn" onclick={download}><Icon name="download" />{t('delete.download')}</button>
    {/if}
  </main>
  {#if account.user}
    <div class="actions">
      <button type="button" class="btn btn-danger" disabled={busy} onclick={remove}><Icon name="trash" />{t('delete.confirm')}</button>
    </div>
  {/if}
</div>

<style>
  .badge {
    width: 64px;
    height: 64px;
    border-radius: 18px;
    background: var(--tint);
    color: var(--danger);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .lead,
  section p {
    font-size: 17px;
    line-height: 1.5;
  }
  ul {
    margin: 6px 0 0;
    padding-left: 22px;
    font-size: 17px;
    font-weight: 700;
  }
  .keep {
    display: flex;
    gap: 14px;
    align-items: flex-start;
    font-size: 16px;
    line-height: 1.45;
    cursor: pointer;
  }
  .keep input {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    margin: 0;
    accent-color: var(--primary);
  }
  .btn:disabled {
    opacity: 0.6;
  }
</style>
