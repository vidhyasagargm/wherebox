<script lang="ts">
  import { onMount } from 'svelte'
  import Icon from '../components/Icon.svelte'
  import TopBar from '../components/TopBar.svelte'
  import { date, t } from '../lib/i18n'
  import {
    createInvite,
    deleteList,
    leaveList,
    members as loadMembers,
    removeMember,
    renameList,
    revokeInvites,
    setMemberRole,
    type Member,
  } from '../lib/lists'
  import { go, route } from '../lib/router.svelte'
  import { data, showToast } from '../lib/store.svelte'

  const id = route.current.param
  const list = $derived(data.lists.find((l) => l.id === id))
  const owner = $derived(list?.role === 'owner')

  let people = $state<Member[] | null>(null)
  let name = $state('')
  let inviteRole = $state<'editor' | 'viewer'>('editor')
  let invite = $state<{ url: string; expiresAt: string } | null>(null)
  let busy = $state(false)

  onMount(async () => {
    name = list?.name ?? ''
    await refresh()
  })

  async function refresh() {
    try {
      people = await loadMembers(id)
    } catch {
      people = []
    }
  }

  // Runs an action that needs the server, with one consistent error message.
  async function attempt(fn: () => Promise<void>) {
    busy = true
    try {
      await fn()
    } catch {
      showToast({ title: navigator.onLine ? t('lists.failed') : t('lists.offline') }, 4000)
    } finally {
      busy = false
    }
  }

  const rename = () =>
    attempt(async () => {
      const value = name.trim()
      if (!list || !value || value === list.name) return
      await renameList(id, value)
      showToast({ title: t('lists.renamed') }, 2500)
    })

  const changeRole = (m: Member, role: 'editor' | 'viewer') =>
    attempt(async () => {
      await setMemberRole(id, m.id, role)
      await refresh()
    })

  const remove = (m: Member) =>
    attempt(async () => {
      if (!confirm(t('lists.removeConfirm', { name: m.name }))) return
      await removeMember(id, m.id)
      await refresh()
    })

  const makeInvite = () =>
    attempt(async () => {
      invite = await createInvite(id, inviteRole)
    })

  async function share() {
    if (!invite || !list) return
    const text = t('lists.shareText', { name: list.name })
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Wherebox', text, url: invite.url })
        return
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
      }
    }
    await copy()
  }

  async function copy() {
    if (!invite) return
    await navigator.clipboard?.writeText(invite.url)
    showToast({ title: t('lists.copied') }, 2500)
  }

  const revoke = () =>
    attempt(async () => {
      await revokeInvites(id)
      invite = null
      showToast({ title: t('lists.revoked') }, 2500)
    })

  const leave = () =>
    attempt(async () => {
      if (!list || !confirm(t('lists.leaveConfirm', { name: list.name }))) return
      await leaveList(id)
      showToast({ title: t('lists.left') }, 3000)
      go('lists', {}, true)
    })

  const destroy = () =>
    attempt(async () => {
      if (!list || !confirm(t('lists.deleteConfirm', { name: list.name }))) return
      await deleteList(id)
      showToast({ title: t('lists.deleted') }, 3000)
      go('lists', {}, true)
    })
</script>

<div class="screen">
  <TopBar />
  <main>
    {#if !list}
      <h1 tabindex="-1">{t('item.missing')}</h1>
    {:else}
      <h1 tabindex="-1">{list.name}</h1>

      {#if owner}
        <section class="field">
          <label for="list-name">{t('lists.rename')}</label>
          <input id="list-name" class="input" bind:value={name} onblur={rename} maxlength="80" autocomplete="off" />
        </section>
      {/if}

      <section aria-labelledby="people">
        <h2 id="people">{t('lists.members')}</h2>
        {#if people === null}
          <p class="muted">…</p>
        {:else}
          <ul class="list">
            {#each people as m (m.id)}
              <li class="person">
                <span class="row-main">
                  <span class="row-title">{m.name}{m.you ? ` (${t('lists.you')})` : ''}</span>
                  <span class="row-sub">{t(`lists.role.${m.role}`)}</span>
                </span>
                {#if owner && !m.you}
                  <div class="person-actions">
                    {#if m.role === 'viewer'}
                      <button type="button" class="chip" disabled={busy} onclick={() => changeRole(m, 'editor')}><Icon name="edit" size={18} />{t('lists.makeEditor')}</button>
                    {:else}
                      <button type="button" class="chip" disabled={busy} onclick={() => changeRole(m, 'viewer')}><Icon name="eye" size={18} />{t('lists.makeViewer')}</button>
                    {/if}
                    <button type="button" class="chip danger" disabled={busy} onclick={() => remove(m)}><Icon name="close" size={18} />{t('lists.remove')}</button>
                  </div>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      </section>

      {#if owner}
        <section class="card invite" aria-labelledby="inv">
          <h2 id="inv">{t('lists.invite')}</h2>
          <p class="muted">{t('lists.inviteText')}</p>
          <fieldset>
            <legend>{t('lists.inviteRole')}</legend>
            <div class="seg">
              <button type="button" aria-pressed={inviteRole === 'editor'} onclick={() => ((inviteRole = 'editor'), (invite = null))}>{t('lists.inviteEdit')}</button>
              <button type="button" aria-pressed={inviteRole === 'viewer'} onclick={() => ((inviteRole = 'viewer'), (invite = null))}>{t('lists.inviteView')}</button>
            </div>
          </fieldset>
          {#if invite}
            <code>{invite.url}</code>
            <p class="muted small">{t('lists.linkValid', { date: date(Date.parse(invite.expiresAt), true) })}</p>
            <button type="button" class="btn btn-primary" onclick={share}><Icon name="share" />{t('lists.share')}</button>
            <button type="button" class="btn" onclick={copy}><Icon name="copy" />{t('lists.copy')}</button>
          {:else}
            <button type="button" class="btn btn-primary" disabled={busy} onclick={makeInvite}><Icon name="link" />{t('lists.createLink')}</button>
          {/if}
          <button type="button" class="btn-link" disabled={busy} onclick={revoke}>{t('lists.revoke')}</button>
        </section>
        <button type="button" class="btn btn-danger" disabled={busy} onclick={destroy}><Icon name="trash" />{t('lists.delete')}</button>
      {:else}
        <button type="button" class="btn btn-danger" disabled={busy} onclick={leave}>{t('lists.leave')}</button>
      {/if}
    {/if}
  </main>
</div>

<style>
  section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .person {
    background: var(--surface);
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .person-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .danger {
    color: var(--danger);
  }
  .invite {
    gap: 12px;
  }
  .invite p {
    font-size: 16px;
  }
  fieldset {
    border: 0;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  legend {
    font-weight: 700;
    font-size: 17px;
    padding: 0;
    margin-bottom: 8px;
  }
  code {
    font-size: 14px;
    padding: 10px 12px;
    border-radius: 10px;
    background: var(--bg);
    word-break: break-all;
  }
  .small {
    font-size: 15px;
  }
  .chip:disabled,
  .btn:disabled {
    opacity: 0.6;
  }
</style>
