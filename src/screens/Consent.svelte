<script lang="ts">
  import Icon from '../components/Icon.svelte'
  import { agreeToCurrent, signOut } from '../lib/account.svelte'
  import { t } from '../lib/i18n'
  import { showToast } from '../lib/store.svelte'

  // Shown instead of the app when the privacy notice or terms changed since the account agreed.
  let agreed = $state(false)
  let busy = $state(false)

  async function agree() {
    busy = true
    try {
      await agreeToCurrent()
    } catch {
      showToast({ title: navigator.onLine ? t('lists.failed') : t('lists.offline') }, 4000)
    } finally {
      busy = false
    }
  }
</script>

<div class="screen">
  <main>
    <span class="badge" aria-hidden="true"><Icon name="shield" size={30} stroke={2} /></span>
    <h1 tabindex="-1">{t('consent.title')}</h1>
    <p class="lead muted">{t('consent.text')}</p>
    <p class="links"><a href="#/terms">{t('terms.title')}</a><a href="#/privacy">{t('privacy.title')}</a></p>
    <label class="check">
      <input type="checkbox" bind:checked={agreed} />
      <span>{t('consent.check')}</span>
    </label>
  </main>
  <div class="actions">
    <button type="button" class="btn btn-primary" disabled={!agreed || busy} onclick={agree}>{t('consent.agree')}</button>
    <button type="button" class="btn-link" onclick={() => signOut()}>{t('account.signOut')}</button>
  </div>
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
  .lead {
    font-size: 18px;
    line-height: 1.5;
  }
  .links {
    display: flex;
    gap: 20px;
    font-weight: 600;
    font-size: 17px;
  }
  .links a {
    min-height: 44px;
    display: inline-flex;
    align-items: center;
  }
  .check {
    display: flex;
    gap: 14px;
    align-items: flex-start;
    font-size: 17px;
    line-height: 1.45;
    cursor: pointer;
  }
  .check input {
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
