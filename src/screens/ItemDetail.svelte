<script lang="ts">
  import Icon from '../components/Icon.svelte'
  import Photo from '../components/Photo.svelte'
  import TopBar from '../components/TopBar.svelte'
  import { compressPhoto, deleteItem, markFound, updateItem } from '../lib/db'
  import { date, monthYear, t } from '../lib/i18n'
  import { go, route } from '../lib/router.svelte'
  import { data, showToast } from '../lib/store.svelte'

  const item = $derived(data.items.find((i) => i.id === route.current.param))
  let photoInput = $state<HTMLInputElement>()
  let note = $state<string | null>(null)

  async function pickPhoto(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0]
    if (!file || !item) return
    await updateItem(item.id, { photo: await compressPhoto(file) })
  }

  async function saveNote() {
    if (!item || note === null) return
    const value = note.trim()
    if (value !== (item.note ?? '')) await updateItem(item.id, { note: value || undefined })
    note = null
  }

  async function remove() {
    if (!item || !confirm(t('item.deleteConfirm', { name: item.name }))) return
    await deleteItem(item.id)
    showToast({ title: t('item.deleted'), text: item.name }, 3000)
    go('', {}, true)
  }

  async function found() {
    if (!item) return
    await markFound(item.id)
    showToast({ title: t('answer.foundToast') }, 3000)
  }

  function range(from: number, to: number) {
    const a = monthYear(from)
    const b = monthYear(to)
    return a === b ? a : `${a} – ${b}`
  }
</script>

<div class="screen">
  <TopBar>
    {#snippet end()}
      {#if item}
        <a class="chip" href={`#/confirm?id=${item.id}&what=${encodeURIComponent(item.name)}&where=${encodeURIComponent(item.where)}`}>
          <Icon name="edit" size={20} />{t('edit')}
        </a>
      {/if}
    {/snippet}
  </TopBar>
  <main>
    {#if !item}
      {#if data.loaded}<h1 tabindex="-1">{t('item.missing')}</h1>{/if}
    {:else}
      <h1 tabindex="-1" class="name">{item.name}</h1>

      <section class="card where">
        <span class="muted">{t('item.itsIn')}</span>
        <span class="place">{item.where}</span>
        <span class="since muted"><Icon name="clock" size={20} stroke={2} />{t('item.since', { date: date(item.since, true) })}</span>

        {#if item.photo}
          <Photo blob={item.photo} alt={t('item.photoAlt', { name: item.name })} />
          <div class="photo-actions">
            <button type="button" class="chip" onclick={() => photoInput?.click()}><Icon name="camera" size={20} />{t('item.changePhoto')}</button>
            <button type="button" class="chip" onclick={() => updateItem(item.id, { photo: undefined })}><Icon name="trash" size={20} />{t('item.removePhoto')}</button>
          </div>
        {:else}
          <button type="button" class="add-photo photo-placeholder" onclick={() => photoInput?.click()}>
            <span><Icon name="camera" size={22} />{t('item.addPhoto')}</span>
          </button>
        {/if}
        <input bind:this={photoInput} class="sr" type="file" accept="image/*" capture="environment" tabindex="-1" aria-hidden="true" onchange={pickPhoto} />

        <div class="field">
          <label for="note">{t('item.note')}</label>
          <textarea
            id="note"
            class="input"
            placeholder={t('item.notePh')}
            value={note ?? item.note ?? ''}
            oninput={(e) => (note = e.currentTarget.value)}
            onblur={saveNote}></textarea>
        </div>
      </section>

      <div class="buttons">
        <a class="btn btn-primary" href={`#/confirm?id=${item.id}&what=${encodeURIComponent(item.name)}&moved=1`}>{t('answer.moved')}</a>
        <button type="button" class="btn" onclick={found}><Icon name="check" />{t('answer.found')}</button>
      </div>

      <section class="history" aria-labelledby="hist">
        <h2 id="hist">{t('item.history')}</h2>
        {#if item.history.length}
          <ol>
            {#each item.history as h, i (i)}
              <li><span class="hp">{h.where}</span><span class="muted">{range(h.from, h.to)}</span></li>
            {/each}
          </ol>
        {:else}
          <p class="muted">{t('item.noHistory')}</p>
        {/if}
        <p class="muted first">{t('item.firstSaved', { date: date(item.createdAt, true) })}</p>
      </section>

      <button type="button" class="btn btn-danger" onclick={remove}><Icon name="trash" />{t('item.delete')}</button>
    {/if}
  </main>
</div>

<style>
  .name {
    font-size: 36px;
  }
  .where {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .place {
    font-size: 28px;
    font-weight: 800;
    line-height: 1.1;
    color: var(--accent-text);
    margin-top: -4px;
  }
  .since {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
  }
  .add-photo {
    min-height: 120px;
    border: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .add-photo span {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border-radius: 12px;
    background: var(--surface);
    font-weight: 700;
    font-size: 16px;
  }
  .photo-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .buttons {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .history {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  ol {
    list-style: none;
    margin: 0;
    padding: 0 0 0 18px;
    border-left: 3px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  li {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  li::before {
    content: '';
    position: absolute;
    left: -26px;
    top: 6px;
    width: 13px;
    height: 13px;
    border-radius: 50%;
    background: var(--bg);
    border: 3px solid var(--border-strong);
  }
  .hp {
    font-weight: 700;
    font-size: 17px;
  }
  li .muted,
  .first {
    font-size: 15px;
  }
</style>
