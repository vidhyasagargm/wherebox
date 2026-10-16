<script lang="ts">
  import { onMount } from 'svelte'
  import TopBar from '../components/TopBar.svelte'
  import { t } from '../lib/i18n'
  import { back, go, route } from '../lib/router.svelte'
  import { save } from '../lib/store.svelte'

  const q = route.current.query
  const id = q.get('id') ?? undefined
  const said = q.get('said')
  let what = $state(q.get('what') ?? '')
  let where = $state(q.get('where') ?? '')
  let whatInput: HTMLInputElement
  let whereInput: HTMLInputElement

  const title = said ? t('unclear.title') : id ? t('unclear.edit') : t('unclear.new')

  onMount(() => {
    // Put the cursor where the answer is missing.
    if (q.has('moved') || (what && !where)) whereInput.focus()
    else if (!what) whatInput.focus()
  })

  async function submit(e: SubmitEvent) {
    e.preventDefault()
    if (!what.trim()) return whatInput.focus()
    if (!where.trim()) return whereInput.focus()
    await save(what.trim(), where.trim(), id)
    go('', {}, true)
  }
</script>

<div class="screen">
  <TopBar icon="close" label={t('cancel')} />
  <main>
    <div class="intro">
      <h1 tabindex="-1">{title}</h1>
      {#if said}<p class="muted">{t('unclear.said', { text: said })}</p>{/if}
    </div>
    <form id="confirm" onsubmit={submit}>
      <div class="field">
        <label for="what">{t('unclear.what')}</label>
        <input id="what" class="input" bind:this={whatInput} bind:value={what} placeholder={t('unclear.whatPh')} autocomplete="off" enterkeyhint="next" />
      </div>
      <div class="field">
        <label for="where">{t('unclear.where')}</label>
        <input id="where" class="input" bind:this={whereInput} bind:value={where} placeholder={t('unclear.wherePh')} autocomplete="off" enterkeyhint="done" />
      </div>
    </form>
  </main>
  <div class="actions">
    <button type="submit" form="confirm" class="btn btn-primary">{t('save')}</button>
    <button type="button" class="btn-link" onclick={() => back()}>{t('cancel')}</button>
  </div>
</div>

<style>
  .intro {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .intro p {
    font-size: 18px;
    line-height: 1.5;
  }
  form {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
</style>
