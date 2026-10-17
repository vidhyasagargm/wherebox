<script lang="ts">
  import { account, signOut, updateName } from '../lib/account.svelte'
  import { ago, t } from '../lib/i18n'
  import { showToast } from '../lib/store.svelte'
  import Icon from './Icon.svelte'

  let name = $state(account.user?.name ?? '')

  const status = $derived.by(() => {
    if (account.expired) return t('account.expired')
    if (account.status === 'syncing') return t('account.syncing')
    if (account.status === 'offline') return t('account.offline')
    if (account.status === 'error') return t('account.error')
    return account.lastSync ? t('account.synced', { when: ago(account.lastSync).toLocaleLowerCase() }) : t('account.syncing')
  })

  async function syncNow() {
    const { syncNow } = await import('../lib/sync')
    syncNow()
  }

  async function saveName() {
    if (!account.user || name.trim() === account.user.name) return
    await updateName(name.trim())
    showToast({ title: t('account.saved') }, 2000)
  }

  let downloading = $state(false)
  async function download() {
    downloading = true
    try {
      const { downloadMyData } = await import('../lib/gdpr')
      await downloadMyData()
      showToast({ title: t('data.downloaded') }, 3000)
    } catch (e) {
      if ((e as Error).name !== 'AbortError') showToast({ title: navigator.onLine ? t('lists.failed') : t('lists.offline') }, 4000)
    } finally {
      downloading = false
    }
  }

  async function out() {
    if (confirm(t('account.signOutConfirm'))) await signOut()
  }
</script>

<div class="card account">
  {#if account.user}
    <p class="who"><Icon name="user" size={22} stroke={2} /><span>{t('account.signedInAs', { email: account.user.email })}</span></p>
    <p class="status" class:warn={account.expired || account.status === 'error'} role="status">
      <Icon name={account.status === 'offline' ? 'cloudOff' : account.status === 'syncing' ? 'sync' : 'cloudCheck'} size={22} stroke={2} />
      <span>{status}</span>
    </p>
    {#if account.expired}
      <a class="btn btn-primary" href="#/signin">{t('signin.title')}</a>
    {:else}
      <button type="button" class="btn" onclick={syncNow} disabled={account.status === 'syncing'}><Icon name="sync" />{t('account.syncNow')}</button>
    {/if}
    <div class="field">
      <label for="acct-name">{t('account.name')}</label>
      <input id="acct-name" class="input" bind:value={name} onblur={saveName} maxlength="50" autocomplete="given-name" />
      <span class="hint muted">{t('account.nameHint')}</span>
    </div>
    <div class="data">
      <h3>{t('data.title')}</h3>
      <p class="hint muted">{t('data.downloadHint')}</p>
      <button type="button" class="btn" onclick={download} disabled={downloading}><Icon name="download" />{t('data.download')}</button>
      <a class="btn btn-danger" href="#/delete-account"><Icon name="trash" />{t('data.delete')}</a>
    </div>
    <button type="button" class="btn-link" onclick={out}>{t('account.signOut')}</button>
  {:else}
    <p class="pitch">{t('account.pitch')}</p>
    <a class="btn btn-primary" href="#/signin"><Icon name="cloud" />{t('account.signIn')}</a>
  {/if}
</div>

<style>
  .account {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .who,
  .status {
    display: flex;
    gap: 10px;
    align-items: center;
    font-size: 16px;
    overflow-wrap: anywhere;
    hyphens: manual;
  }
  .who {
    font-weight: 700;
  }
  .status {
    color: var(--accent-text);
  }
  .status.warn {
    color: var(--danger);
    font-weight: 600;
  }
  .data {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-top: 14px;
    margin-top: 4px;
    border-top: 1px solid var(--divider);
  }
  h3 {
    margin: 0;
    font-size: 18px;
  }
  .pitch {
    font-size: 17px;
    line-height: 1.45;
  }
  .hint {
    font-size: 15px;
  }
  .btn:disabled {
    opacity: 0.6;
  }
</style>
