<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import Icon from '../components/Icon.svelte'
  import TopBar from '../components/TopBar.svelte'
  import { speechLang, t } from '../lib/i18n'
  import { parse } from '../lib/parser'
  import { go } from '../lib/router.svelte'
  import { settings } from '../lib/settings.svelte'
  import { canListen, listen, type Session, type SpeechError } from '../lib/speech'
  import { handle } from '../lib/store.svelte'
  import { hush, unlockTalk } from '../lib/talk'

  type Phase = { name: 'listening' } | { name: 'working'; text: string } | { name: 'error'; error: SpeechError }

  let phase = $state<Phase>({ name: 'listening' })
  let transcript = $state('')
  let session: Session | null = null

  const preview = $derived.by(() => {
    if (phase.name !== 'working') return ''
    const p = parse(phase.text, settings.lang)
    return p.kind === 'save' ? `${p.what} → ${p.where}` : ''
  })

  function start() {
    hush()
    unlockTalk()
    transcript = ''
    phase = { name: 'listening' }
    navigator.vibrate?.(30)
    session = listen({
      lang: speechLang(),
      onInterim: (text) => (transcript = text),
      onFinal: (text) => {
        phase = { name: 'working', text }
        // A short pause lets people read what was understood before it's saved.
        setTimeout(() => handle(text, { replace: true, spoken: true }), 700)
      },
      onError: (error) => (phase = { name: 'error', error }),
    })
  }

  onMount(() => {
    if (!canListen()) go('', { dictate: '1' }, true)
    else start()
  })
  onDestroy(() => session?.abort())

  const errorText = $derived.by(() => {
    if (phase.name !== 'error') return { title: '', text: '' }
    if (phase.error === 'not-allowed') return { title: t('voice.noPermission'), text: t('voice.noPermissionText') }
    if (phase.error === 'network') return { title: t('voice.offline'), text: t('voice.offlineText') }
    if (phase.error === 'unsupported') return { title: t('voice.unsupported'), text: t('voice.unsupportedText') }
    return { title: t('voice.noHear'), text: t('voice.noHearText') }
  })
</script>

<div class="screen voice">
  <TopBar icon="close" />
  <main>
    {#if phase.name === 'listening'}
      <div class="center">
        <span class="status" role="status"><span class="dot"></span>{t('voice.listening')}</span>
        <h1 tabindex="-1" class="said" aria-live="polite">
          {#if transcript}{transcript}<span class="caret" aria-hidden="true"></span>{:else}<span class="hint">{t('voice.say')}</span>{/if}
        </h1>
      </div>
      <div class="foot">
        <button type="button" class="big" aria-label={t('voice.stop')} onclick={() => session?.stop()}><Icon name="stop" size={34} /></button>
        <span class="muted">{t('voice.tapDone')}</span>
      </div>
    {:else if phase.name === 'working'}
      <div class="center">
        <span class="status muted" role="status">{t('voice.working')}</span>
        <h1 tabindex="-1" class="said">{phase.text}</h1>
        {#if preview}<div class="card preview">{preview}</div>{/if}
      </div>
      <div class="foot">
        <span class="big idle" aria-hidden="true"><Icon name="mic" size={34} stroke={2} /></span>
        <span class="muted">{preview ? t('voice.saving') : t('voice.working')}</span>
      </div>
    {:else}
      <div class="center">
        <h1 tabindex="-1" role="alert">{errorText.title}</h1>
        <p class="muted lead">{errorText.text}</p>
      </div>
      <div class="buttons">
        {#if phase.error !== 'unsupported'}
          <button type="button" class="btn btn-primary" onclick={start}><Icon name="mic" />{t('voice.tryAgain')}</button>
        {/if}
        <button type="button" class="btn" onclick={() => go('', phase.name === 'error' && phase.error !== 'no-speech' ? { dictate: '1' } : {}, true)}>
          {t('voice.typeInstead')}
        </button>
      </div>
    {/if}
  </main>
</div>

<style>
  .voice main {
    padding-bottom: calc(40px + env(safe-area-inset-bottom));
  }
  .center {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 18px;
  }
  .status {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 18px;
    font-weight: 700;
    color: var(--accent);
  }
  .dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--accent);
    animation: pulse 1.2s ease-in-out infinite;
  }
  .said {
    font-size: 34px;
    line-height: 1.2;
  }
  .hint {
    color: var(--muted);
    font-weight: 700;
    font-size: 26px;
  }
  .caret {
    display: inline-block;
    width: 3px;
    height: 1em;
    margin-left: 4px;
    vertical-align: -0.15em;
    background: var(--accent);
    animation: blink 1s steps(2) infinite;
  }
  .lead {
    font-size: 19px;
    line-height: 1.5;
  }
  .preview {
    font-size: 20px;
    font-weight: 700;
    padding: 16px;
  }
  .foot {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }
  .foot .muted {
    font-size: 17px;
    font-weight: 600;
  }
  .big {
    width: 112px;
    height: 112px;
    border-radius: 50%;
    border: 0;
    background: var(--primary);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 0 14px color-mix(in srgb, var(--primary) 18%, transparent);
    animation: ring 1.6s ease-in-out infinite;
  }
  .big.idle {
    background: var(--border);
    color: var(--muted);
    box-shadow: none;
    animation: none;
  }
  .buttons {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  @keyframes pulse {
    50% {
      box-shadow: 0 0 0 7px color-mix(in srgb, var(--accent) 25%, transparent);
    }
  }
  @keyframes ring {
    50% {
      box-shadow: 0 0 0 22px color-mix(in srgb, var(--primary) 10%, transparent);
    }
  }
  @keyframes blink {
    to {
      visibility: hidden;
    }
  }
</style>
