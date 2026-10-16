<script lang="ts">
  import Answer from '../components/Answer.svelte'
  import Icon from '../components/Icon.svelte'
  import TopBar from '../components/TopBar.svelte'
  import { t } from '../lib/i18n'
  import { route } from '../lib/router.svelte'
  import { resolve } from '../lib/search'
  import { settings } from '../lib/settings.svelte'
  import { data } from '../lib/store.svelte'
  import { shouldTalk, spoken, talk } from '../lib/answers'
  import { hush } from '../lib/talk'
  import { onDestroy } from 'svelte'

  const q = $derived(route.current.query.get('q') ?? '')
  const said = $derived(route.current.query.get('said') || q)
  const pickedId = $derived(route.current.query.get('id'))
  const picked = $derived(pickedId ? data.items.find((i) => i.id === pickedId) : undefined)
  const outcome = $derived(resolve(q, data.items))

  // Read the result aloud once, as soon as the data is there.
  let told = false
  $effect(() => {
    if (told || !data.loaded || !shouldTalk(route.current.query.has('spoken'))) return
    told = true
    const item = picked ?? (outcome.kind === 'one' ? outcome.item : undefined)
    if (item) talk(spoken.answer(item))
    else if (outcome.kind === 'many') talk(spoken.many(outcome.matches.map((m) => m.item)))
    else if (outcome.kind === 'none') talk(spoken.none(q, outcome.suggestions))
  })
  onDestroy(hush)
</script>

<div class="screen">
  <TopBar>{t('answer.youAsked', { q: said })}</TopBar>
  <main>
    {#if !data.loaded}
      <!-- Loads in a few milliseconds; nothing to show meanwhile. -->
    {:else if picked}
      <Answer item={picked} />
    {:else if outcome.kind === 'one'}
      <Answer item={outcome.item} />
    {:else if outcome.kind === 'many'}
      <div class="intro">
        <h1 tabindex="-1">{t('matches.title', { q: settings.lang === 'en' ? q.toLocaleLowerCase() : q })}</h1>
        <p class="muted">{t('matches.count', { n: outcome.matches.length })}</p>
      </div>
      <ul class="matches">
        {#each outcome.matches as m, i (m.item.id)}
          <li>
            <a class="match" class:best={i === 0} href={`#/find?q=${encodeURIComponent(q)}&said=${encodeURIComponent(said)}&id=${m.item.id}`}>
              <span class="row-main">
                {#if i === 0}<span class="badge">{t('matches.best')}</span>{/if}
                <span class="name">{m.item.name}</span>
                <span class="row-sub">{m.item.where}</span>
              </span>
              <Icon name="chevron" size={22} />
            </a>
          </li>
        {/each}
      </ul>
      <div class="actions">
        <a class="btn" href={`#/confirm?what=${encodeURIComponent(q)}`}>{t('matches.none')}</a>
      </div>
    {:else}
      <div class="intro">
        <span class="icon"><Icon name="search" size={30} stroke={2} /></span>
        <h1 tabindex="-1">{t('notFound.title', { q })}</h1>
        <p class="muted">{t('notFound.text')}</p>
      </div>
      {#if outcome.suggestions.length}
        <section class="suggest" aria-labelledby="dym">
          <h2 id="dym">{t('notFound.didYouMean')}</h2>
          <ul class="list">
            {#each outcome.suggestions as item (item.id)}
              <li>
                <a class="row" href={`#/find?q=${encodeURIComponent(item.name)}&id=${item.id}`}>
                  <span class="row-main"><span class="row-title">{item.name}</span><span class="row-sub">{item.where}</span></span>
                  <Icon name="chevron" size={22} />
                </a>
              </li>
            {/each}
          </ul>
        </section>
      {/if}
      <div class="actions">
        <a class="btn btn-primary" href={`#/confirm?what=${encodeURIComponent(q)}`}><Icon name="plus" />{t('notFound.save')}</a>
      </div>
    {/if}
  </main>
</div>

<style>
  .intro {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 4px;
  }
  .intro p {
    font-size: 18px;
    line-height: 1.5;
  }
  .icon {
    width: 64px;
    height: 64px;
    border-radius: 18px;
    background: var(--tint);
    color: var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 4px;
  }
  .matches {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .match {
    min-height: 80px;
    padding: 14px 16px;
    border-radius: 18px;
    border: 1px solid var(--border);
    background: var(--surface);
    display: flex;
    align-items: center;
    gap: 12px;
    text-decoration: none;
    color: var(--text);
  }
  .match.best {
    border: 2px solid var(--primary);
  }
  .badge {
    align-self: flex-start;
    padding: 3px 10px;
    border-radius: 999px;
    background: var(--tint);
    color: var(--accent-text);
    font-size: 13px;
    font-weight: 700;
  }
  .name {
    font-size: 20px;
    font-weight: 700;
  }
  .suggest {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
</style>
