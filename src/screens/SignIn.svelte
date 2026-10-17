<script lang="ts">
  import { onMount } from 'svelte'
  import Icon from '../components/Icon.svelte'
  import TopBar from '../components/TopBar.svelte'
  import { localCount, moveDeviceItems, requestCode, verifyCode } from '../lib/account.svelte'
  import { t } from '../lib/i18n'
  import { go } from '../lib/router.svelte'
  import { showToast } from '../lib/store.svelte'
  import { pendingInvite } from '../lib/lists'

  type Step = 'email' | 'code' | 'move'

  let step = $state<Step>('email')
  let email = $state('')
  let name = $state('')
  let consent = $state(false)
  let code = $state('')
  let otpId = ''
  let listId = ''
  let waiting = $state(false)
  let error = $state('')
  let toMove = $state(0)
  let emailInput = $state<HTMLInputElement>()
  let codeInput = $state<HTMLInputElement>()

  onMount(() => emailInput?.focus())

  function explain(e: unknown) {
    const status = (e as { status?: number })?.status
    if (!navigator.onLine || status === 0) return t('signin.offline')
    if (status === 429) return t('signin.tooMany')
    if (status === 400 || status === 401) return t('signin.wrongCode')
    return t('signin.failed')
  }

  async function send(e?: SubmitEvent) {
    e?.preventDefault()
    error = ''
    if (!email.trim()) return emailInput?.focus()
    if (!consent) {
      error = t('signin.consentNeeded')
      return
    }
    waiting = true
    try {
      otpId = await requestCode(email.trim().toLowerCase(), name.trim())
      code = ''
      step = 'code'
      queueMicrotask(() => codeInput?.focus())
    } catch (err) {
      error = explain(err)
    } finally {
      waiting = false
    }
  }

  async function verify(e?: SubmitEvent) {
    e?.preventDefault()
    error = ''
    if (code.replace(/\D/g, '').length < 6) return codeInput?.focus()
    waiting = true
    try {
      listId = (await verifyCode(otpId, code)).id
      toMove = await localCount()
      if (toMove > 0) step = 'move'
      else finish()
    } catch (err) {
      error = explain(err)
      codeInput?.select()
    } finally {
      waiting = false
    }
  }

  async function move() {
    waiting = true
    const n = await moveDeviceItems(listId)
    waiting = false
    showToast({ title: t('signin.done'), text: t('signin.moved', { n }) }, 4000)
    next()
  }

  function finish() {
    showToast({ title: t('signin.done') }, 3000)
    next()
  }

  // Back to the invite that sent them here, or home.
  function next() {
    const invite = pendingInvite()
    if (invite) go('join/' + invite, {}, true)
    else go('', {}, true)
  }

  // Codes pasted from the email often carry spaces; submit as soon as all six digits are there.
  function onCodeInput() {
    if (code.replace(/\D/g, '').length === 6 && !waiting) verify()
  }
</script>

<div class="screen">
  <TopBar icon="close" />
  <main>
    {#if step === 'email'}
      <div class="intro">
        <span class="badge" aria-hidden="true"><Icon name="cloud" size={30} stroke={2} /></span>
        <h1 tabindex="-1">{t('signin.title')}</h1>
        <p class="muted">{t('signin.intro')}</p>
      </div>
      <form id="signin" onsubmit={send} novalidate>
        <div class="field">
          <label for="email">{t('signin.email')}</label>
          <input id="email" class="input" type="email" bind:this={emailInput} bind:value={email} autocomplete="email" inputmode="email" enterkeyhint="next" required />
        </div>
        <div class="field">
          <label for="name">{t('signin.name')}</label>
          <input id="name" class="input" bind:value={name} autocomplete="given-name" maxlength="50" enterkeyhint="done" />
          <span class="hint muted">{t('account.nameHint')}</span>
        </div>
        <label class="consent">
          <input type="checkbox" bind:checked={consent} />
          <span>{t('signin.consent')} <a href="#/terms">{t('terms.title')}</a> · <a href="#/privacy">{t('signin.privacy')}</a></span>
        </label>
      </form>
    {:else if step === 'code'}
      <div class="intro">
        <span class="badge" aria-hidden="true"><Icon name="check" size={30} stroke={2} /></span>
        <h1 tabindex="-1">{t('signin.codeTitle')}</h1>
        <p class="muted">{t('signin.codeIntro', { email })}</p>
      </div>
      <form id="code" onsubmit={verify}>
        <div class="field">
          <label for="otp">{t('signin.code')}</label>
          <input
            id="otp"
            class="input code"
            bind:this={codeInput}
            bind:value={code}
            oninput={onCodeInput}
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="12"
            enterkeyhint="done" />
        </div>
      </form>
      <div class="links">
        <button type="button" class="btn-link" onclick={() => send()} disabled={waiting}>{t('signin.resend')}</button>
        <button type="button" class="btn-link" onclick={() => ((step = 'email'), (error = ''))}>{t('signin.otherEmail')}</button>
      </div>
    {:else}
      <div class="intro">
        <span class="badge" aria-hidden="true"><Icon name="upload" size={30} stroke={2} /></span>
        <h1 tabindex="-1">{t('signin.moveTitle')}</h1>
        <p class="muted">{t('signin.moveText', { n: toMove })}</p>
      </div>
    {/if}

    {#if error}<p class="error" role="alert"><Icon name="alert" size={22} stroke={2} />{error}</p>{/if}
  </main>
  <div class="actions">
    {#if step === 'email'}
      <button type="submit" form="signin" class="btn btn-primary" disabled={waiting}>{t('signin.send')}</button>
    {:else if step === 'code'}
      <button type="submit" form="code" class="btn btn-primary" disabled={waiting}>{t('signin.verify')}</button>
    {:else}
      <button type="button" class="btn btn-primary" onclick={move} disabled={waiting}>{t('signin.move')}</button>
      <button type="button" class="btn" onclick={finish}>{t('signin.keep')}</button>
    {/if}
  </div>
</div>

<style>
  .intro {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .intro p {
    font-size: 18px;
    line-height: 1.5;
    /* Never hyphenate email addresses. */
    hyphens: manual;
    overflow-wrap: anywhere;
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
  form {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  .hint {
    font-size: 15px;
  }
  .consent {
    display: flex;
    gap: 14px;
    align-items: flex-start;
    font-size: 16px;
    line-height: 1.45;
    cursor: pointer;
  }
  .consent input {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    margin: 0;
    accent-color: var(--primary);
  }
  .consent a {
    display: inline-block;
    font-weight: 600;
    padding: 4px 0;
  }
  .code {
    font-size: 28px;
    font-weight: 700;
    letter-spacing: 0.3em;
    text-align: center;
  }
  .links {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 4px 20px;
  }
  .error {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 12px 14px;
    border-radius: 14px;
    border: 2px solid var(--danger);
    color: var(--danger);
    font-weight: 600;
    font-size: 16px;
  }
  .btn:disabled,
  .btn-link:disabled {
    opacity: 0.6;
  }
</style>
