<script lang="ts">
  import Icon from '../components/Icon.svelte'
  import Logo from '../components/Logo.svelte'
  import { t } from '../lib/i18n'
  import { go } from '../lib/router.svelte'
  import { saveSettings, settings } from '../lib/settings.svelte'

  let step = $state(1)

  function finish() {
    settings.onboarded = true
    saveSettings()
    go('', {}, true)
  }

  function next() {
    if (step < 3) {
      step++
      queueMicrotask(() => document.querySelector<HTMLElement>('main h1')?.focus())
    } else finish()
  }
</script>

<div class="screen onb">
  <header class="topbar">
    <span class="muted" style="flex: 1">{t('onb.step', { n: step })}</span>
    {#if step < 3}<button type="button" class="chip" onclick={finish}>{t('onb.skip')}</button>{/if}
  </header>
  <main>
    <div class="art" aria-hidden="true">
      {#if step === 1}
        <div class="bubble me">“{t('onb.1.say')}”</div>
        <div class="bubble app"><Icon name="check" size={20} stroke={2.6} />{t('onb.1.saved')}</div>
        <div class="bubble me">“{t('onb.1.ask')}”</div>
        <div class="bubble app strong">{t('onb.1.answer')}</div>
      {:else if step === 2}
        <div class="mic"><Icon name="mic" size={52} stroke={2} /></div>
        <div class="or"><span class="kb"><Icon name="keyboard" size={28} stroke={1.8} /></span></div>
      {:else}
        <div class="phone"><Logo size={72} /><span class="lock"><Icon name="shield" size={30} stroke={2} /></span></div>
      {/if}
    </div>
    <div class="copy">
      <h1 tabindex="-1">{t(`onb.${step as 1 | 2 | 3}.title`)}</h1>
      <p class="muted">{t(`onb.${step as 1 | 2 | 3}.text`)}</p>
    </div>
    <div class="dots" aria-hidden="true">
      {#each [1, 2, 3] as n (n)}<span class:on={n === step}></span>{/each}
    </div>
    <button type="button" class="btn btn-primary" onclick={next}>{step < 3 ? t('onb.next') : t('onb.start')}</button>
  </main>
</div>

<style>
  .onb main {
    padding-bottom: calc(32px + env(safe-area-inset-bottom));
  }
  .art {
    flex: 1;
    min-height: 260px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 10px;
  }
  .bubble {
    max-width: 85%;
    padding: 12px 16px;
    border-radius: 18px;
    font-size: 17px;
    font-weight: 600;
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .me {
    align-self: flex-end;
    background: var(--surface);
    border: 1px solid var(--border);
    border-bottom-right-radius: 6px;
  }
  .app {
    align-self: flex-start;
    background: var(--tint);
    color: var(--accent-text);
    border-bottom-left-radius: 6px;
  }
  .app.strong {
    background: var(--primary);
    color: #fff;
    font-size: 22px;
    font-weight: 800;
  }
  .mic {
    align-self: center;
    width: 140px;
    height: 140px;
    border-radius: 50%;
    background: var(--primary);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 0 18px color-mix(in srgb, var(--primary) 16%, transparent);
  }
  .or {
    align-self: center;
    margin-top: 34px;
  }
  .kb {
    display: flex;
    padding: 12px 18px;
    border-radius: 14px;
    border: 2px solid var(--border-strong);
    background: var(--surface);
  }
  .phone {
    align-self: center;
    position: relative;
    width: 150px;
    height: 230px;
    border-radius: 28px;
    border: 4px solid var(--text);
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--surface);
  }
  .lock {
    position: absolute;
    right: -22px;
    bottom: 22px;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--tint);
    color: var(--accent-text);
    display: flex;
    align-items: center;
    justify-content: center;
    border: 3px solid var(--bg);
  }
  .copy {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .copy h1 {
    font-size: 34px;
  }
  .copy p {
    font-size: 19px;
    line-height: 1.5;
  }
  .dots {
    display: flex;
    gap: 8px;
    justify-content: center;
  }
  .dots span {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--border-strong);
  }
  .dots span.on {
    width: 28px;
    border-radius: 5px;
    background: var(--primary);
  }
</style>
