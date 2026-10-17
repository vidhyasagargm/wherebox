<script lang="ts">
  import { onMount } from 'svelte'
  import Icon from '../components/Icon.svelte'
  import TopBar from '../components/TopBar.svelte'
  import { account } from '../lib/account.svelte'
  import { t } from '../lib/i18n'
  import { acceptInvite, previewInvite, rememberInvite, type InvitePreview } from '../lib/lists'
  import { go, route } from '../lib/router.svelte'
  import { showToast } from '../lib/store.svelte'
  import { isIOS, isStandalone } from '../lib/speech'

  const token = route.current.param
  let preview = $state<InvitePreview | null>(null)
  let invalid = $state(false)
  let busy = $state(false)

  onMount(async () => {
    try {
      preview = await previewInvite(token)
    } catch {
      invalid = true
    }
  })

  function signIn() {
    // Come back here after signing in.
    rememberInvite(token)
    go('signin')
  }

  async function join() {
    if (!preview) return
    busy = true
    try {
      await acceptInvite(token)
      showToast({ title: t('join.joined', { list: preview.list }) }, 4000)
      go('', {}, true)
    } catch (e) {
      if ((e as { status?: number })?.status === 404) invalid = true
      else showToast({ title: navigator.onLine ? t('lists.failed') : t('lists.offline') }, 4000)
    } finally {
      busy = false
    }
  }
</script>

<div class="screen">
  <TopBar icon="close" />
  <main>
    {#if invalid}
      <span class="badge" aria-hidden="true"><Icon name="alert" size={30} stroke={2} /></span>
      <h1 tabindex="-1">{t('join.invalid')}</h1>
      <p class="muted lead">{t('join.invalidText')}</p>
    {:else if !preview}
      <p class="muted lead" role="status">{t('join.checking')}</p>
    {:else}
      <span class="badge" aria-hidden="true"><Icon name="users" size={30} stroke={2} /></span>
      <h1 tabindex="-1">{t('join.title')}</h1>
      <p class="lead">
        {preview.inviter ? t('join.text', { inviter: preview.inviter, list: preview.list }) : t('join.textNoName', { list: preview.list })}
      </p>
      <p class="muted lead">{preview.role === 'editor' ? t('join.canEdit') : t('join.canView')}</p>
      {#if isIOS && !isStandalone()}
        <p class="hint"><Icon name="phone" size={22} stroke={2} /><span>{t('join.iosHint')}</span></p>
      {/if}
    {/if}
  </main>
  {#if preview && !invalid}
    <div class="actions">
      {#if account.user}
        <button type="button" class="btn btn-primary" disabled={busy} onclick={join}>{t('join.accept')}</button>
      {:else}
        <button type="button" class="btn btn-primary" onclick={signIn}>{t('join.signIn')}</button>
      {/if}
    </div>
  {/if}
</div>

<style>
  main {
    justify-content: center;
  }
  .badge {
    width: 64px;
    height: 64px;
    border-radius: 18px;
    background: var(--tint);
    color: var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .hint {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 12px 14px;
    border-radius: 14px;
    background: var(--tint);
    color: var(--accent-text);
    font-size: 16px;
    line-height: 1.45;
  }
  .hint :global(svg) {
    flex-shrink: 0;
  }
  .lead {
    font-size: 19px;
    line-height: 1.5;
  }
</style>
