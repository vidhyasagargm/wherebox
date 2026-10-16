<script lang="ts">
  import { answerLead, spoken, talk } from '../lib/answers'
  import { markFound, type Item } from '../lib/db'
  import { date, t } from '../lib/i18n'
  import { go } from '../lib/router.svelte'
  import { canTalk } from '../lib/talk'
  import { showToast } from '../lib/store.svelte'
  import Icon from './Icon.svelte'
  import Photo from './Photo.svelte'

  let { item }: { item: Item } = $props()

  const lead = $derived(answerLead(item))

  async function found() {
    await markFound(item.id)
    showToast({ title: t('answer.foundToast') }, 3000)
    go('', {}, true)
  }
</script>

<article class="card answer">
  <span class="lead muted">{lead}</span>
  <h1 tabindex="-1">{item.where}</h1>
  <div class="meta">
    <span class="since muted"><Icon name="clock" size={20} stroke={2} />{t('answer.since', { date: date(item.since) })}</span>
    {#if canTalk()}
      <button type="button" class="chip" onclick={() => talk(spoken.answer(item))}><Icon name="speaker" size={22} />{t('answer.sayAgain')}</button>
    {/if}
  </div>
  {#if item.photo}<Photo blob={item.photo} alt={t('item.photoAlt', { name: item.name })} />{/if}
  {#if item.note}<p class="note">{item.note}</p>{/if}
</article>

<div class="actions">
  <button type="button" class="btn btn-primary" onclick={found}><Icon name="check" stroke={2.6} />{t('answer.found')}</button>
  <a class="btn" href={`#/confirm?id=${item.id}&what=${encodeURIComponent(item.name)}&moved=1`}>{t('answer.moved')}</a>
  <a class="btn-link" href={'#/item/' + item.id}>{t('answer.before')}</a>
</div>

<style>
  .answer {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .lead {
    font-size: 18px;
  }
  h1 {
    margin-top: -6px;
    font-size: 40px;
    line-height: 1.05;
    color: var(--accent-text);
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .since {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 17px;
  }
  .note {
    font-size: 17px;
    line-height: 1.45;
  }
</style>
