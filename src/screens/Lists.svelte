<script lang="ts">
  import Icon from '../components/Icon.svelte'
  import TopBar from '../components/TopBar.svelte'
  import { account } from '../lib/account.svelte'
  import { LOCAL, type List } from '../lib/db'
  import { t } from '../lib/i18n'
  import { createList, setActiveList } from '../lib/lists'
  import { go } from '../lib/router.svelte'
  import { settings } from '../lib/settings.svelte'
  import { data, showToast } from '../lib/store.svelte'

  let dialog: HTMLDialogElement
  let newName = $state('')
  let busy = $state(false)

  const lists = $derived([...data.lists].sort((a, b) => (a.role === 'owner' ? 0 : 1) - (b.role === 'owner' ? 0 : 1) || a.name.localeCompare(b.name)))

  function open(id: string) {
    setActiveList(id)
    go('', {}, true)
  }

  async function create(e: SubmitEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    busy = true
    try {
      const list = await createList(name)
      dialog.close()
      newName = ''
      open(list.id)
    } catch {
      showToast({ title: navigator.onLine ? t('lists.failed') : t('lists.offline') }, 4000)
    } finally {
      busy = false
    }
  }

  const roleLabel = (l: List) =>
    l.role !== 'owner' && l.ownerName ? t('lists.sharedBy', { name: l.ownerName, role: t(`lists.role.${l.role}`) }) : t(`lists.role.${l.role}`)
</script>

<div class="screen">
  <TopBar />
  <main>
    <h1 tabindex="-1">{t('lists.title')}</h1>
    <ul class="list">
      <li>
        <div class="row-wrap" class:current={settings.activeList === LOCAL}>
          <button type="button" class="row pick" onclick={() => open(LOCAL)} aria-current={settings.activeList === LOCAL ? 'true' : undefined}>
            <span class="icon" aria-hidden="true"><Icon name="phone" size={22} stroke={2} /></span>
            <span class="row-main">
              <span class="row-title">{t('lists.device')}</span>
              <span class="row-sub">{t('lists.deviceHint')}</span>
            </span>
            {#if settings.activeList === LOCAL}<Icon name="check" size={22} stroke={2.6} />{/if}
          </button>
        </div>
      </li>
      {#each lists as l (l.id)}
        <li>
          <div class="row-wrap" class:current={settings.activeList === l.id}>
            <button type="button" class="row pick" onclick={() => open(l.id)} aria-current={settings.activeList === l.id ? 'true' : undefined}>
              <span class="icon" aria-hidden="true"><Icon name={l.role === 'owner' ? 'list' : 'users'} size={22} stroke={2} /></span>
              <span class="row-main">
                <span class="row-title">{l.name}</span>
                <span class="row-sub">{roleLabel(l)}</span>
              </span>
              {#if settings.activeList === l.id}<Icon name="check" size={22} stroke={2.6} />{/if}
            </button>
            <a class="manage" href={'#/list/' + l.id} aria-label={`${t('lists.manage')}: ${l.name}`}><Icon name="sliders" size={22} stroke={1.8} /></a>
          </div>
        </li>
      {/each}
    </ul>

    {#if account.user}
      <button type="button" class="btn" onclick={() => dialog.showModal()}><Icon name="plus" />{t('lists.new')}</button>
    {:else if account.available}
      <div class="card hint">
        <p>{t('lists.signInHint')}</p>
        <a class="btn" href="#/signin"><Icon name="cloud" />{t('account.signIn')}</a>
      </div>
    {/if}
  </main>
</div>

<dialog bind:this={dialog} aria-labelledby="new-title">
  <form onsubmit={create}>
    <h2 id="new-title">{t('lists.new')}</h2>
    <div class="field">
      <label for="list-name">{t('lists.newName')}</label>
      <input id="list-name" class="input" bind:value={newName} placeholder={t('lists.newPh')} maxlength="80" autocomplete="off" />
    </div>
    <button type="submit" class="btn btn-primary" disabled={busy}>{t('lists.create')}</button>
    <button type="button" class="btn-link" onclick={() => dialog.close()}>{t('cancel')}</button>
  </form>
</dialog>

<style>
  .row-wrap {
    display: flex;
    background: var(--surface);
  }
  .row-wrap.current {
    background: var(--tint);
  }
  .pick {
    flex: 1;
    background: transparent;
  }
  .current .row-sub {
    color: var(--accent-text);
  }
  .icon {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    background: var(--bg);
    color: var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .manage {
    width: 64px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text);
    border-left: 1px solid var(--divider);
  }
  .hint {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .hint p {
    font-size: 17px;
  }
  dialog {
    width: min(440px, calc(100vw - 32px));
    border: 0;
    border-radius: 20px;
    padding: 20px;
    background: var(--surface);
    color: var(--text);
    box-shadow: var(--shadow);
  }
  dialog::backdrop {
    background: rgba(16, 32, 26, 0.5);
  }
  dialog form {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
</style>
