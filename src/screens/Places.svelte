<script lang="ts">
  import Icon from '../components/Icon.svelte'
  import { db, renamePlace } from '../lib/db'
  import { t } from '../lib/i18n'
  import { escapeRe, ROOMS, splitPlace } from '../lib/parser'
  import { data, places, showToast } from '../lib/store.svelte'

  const groups = $derived(places(data.items, data.rooms))
  let open = $state<string | null>(null)
  let editing = $state(false)
  let dialog: HTMLDialogElement
  let target = $state<{ room: string; spot?: string; label: string } | null>(null)
  let newName = $state('')

  $effect(() => {
    if (open === null && groups.length) open = groups[0].room
  })

  function startRename(room: string, spot?: string) {
    target = { room, spot, label: spot ?? room }
    newName = spot ?? room
    dialog.showModal()
  }

  const replaceFirst = (text: string, find: string, by: string) => text.replace(new RegExp(escapeRe(find), 'i'), by)

  async function rename(e: SubmitEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!target || !name || name === target.label) return dialog.close()
    const { room, spot } = target
    const merged =
      spot === undefined
        ? groups.some((g) => g.room.toLocaleLowerCase() === name.toLocaleLowerCase())
        : groups.find((g) => g.room === room)?.spots.some((s) => s.spot.toLocaleLowerCase() === name.toLocaleLowerCase())

    if (spot === undefined) {
      const known = [...ROOMS.en, ...ROOMS.de, ...data.rooms].some((r) => r.toLocaleLowerCase() === name.toLocaleLowerCase())
      if (!known) await db.rooms.put({ name })
      await renamePlace((where) => (splitPlace(where, data.rooms).room === room ? replaceFirst(where, room, name) : null))
    } else {
      await renamePlace((where) => {
        const p = splitPlace(where, data.rooms)
        if (p.room !== room || p.spot !== spot) return null
        if (!spot) return `${where} ${name}`
        return new RegExp(escapeRe(spot), 'i').test(where) ? replaceFirst(where, spot, name) : room ? `${room} ${name}` : name
      })
    }
    if (spot === undefined && open === room) open = name
    showToast({ title: merged ? t('places.merged') : t('places.renamed'), text: `${target.label} → ${name}` }, 3000)
    dialog.close()
  }

  async function removePlace(room: string, spot?: string) {
    const ids = data.items
      .filter((i) => {
        const p = splitPlace(i.where, data.rooms)
        return p.room === room && (spot === undefined || p.spot === spot)
      })
      .map((i) => i.id)
    const label = spot ?? (room || t('places.other'))
    if (!confirm(t('places.deleteConfirm', { name: label, n: ids.length }))) return
    await db.items.bulkDelete(ids)
    showToast({ title: t('places.deleted'), text: label }, 3000)
  }

  const count = (n: number) => (n === 1 ? t('places.thing') : t('places.things', { n }))
</script>

<div class="screen has-nav">
  <main>
    <div class="head">
      <h1 tabindex="-1">{t('places.title')}</h1>
      {#if groups.length}
        <button type="button" class="chip" aria-pressed={editing} onclick={() => (editing = !editing)}>
          {editing ? t('done') : t('edit')}
        </button>
      {/if}
    </div>
    <p class="muted intro">{groups.length ? t('places.intro') : t('places.empty')}</p>

    <div class="rooms">
      {#each groups as g (g.room)}
        {@const isOpen = open === g.room}
        <section class="room" class:open={isOpen}>
          <div class="room-head">
            <button type="button" class="toggle" aria-expanded={isOpen} onclick={() => (open = isOpen ? '' : g.room)}>
              <span class="room-name">{g.room || t('places.other')}</span>
              <span class="count">{count(g.count)}</span>
              <span class="chev"><Icon name="down" size={22} /></span>
            </button>
          </div>
          {#if editing && g.room}
            <div class="edit-row">
              <button type="button" class="chip" onclick={() => startRename(g.room)}><Icon name="edit" size={18} />{t('places.rename')}</button>
              <button type="button" class="chip danger" onclick={() => removePlace(g.room)}><Icon name="trash" size={18} />{t('places.deletePlace')}</button>
            </div>
          {/if}
          {#if isOpen}
            <ul>
              {#each g.spots as s (s.spot)}
                <li>
                  <div class="spot-head">
                    <span class="spot">{s.spot || g.room}</span>
                    {#if editing}
                      <button type="button" class="mini" aria-label={`${t('places.rename')}: ${s.spot || g.room}`} onclick={() => startRename(g.room, s.spot)}>
                        <Icon name="edit" size={18} />
                      </button>
                      <button type="button" class="mini danger" aria-label={`${t('places.deletePlace')}: ${s.spot || g.room}`} onclick={() => removePlace(g.room, s.spot)}>
                        <Icon name="trash" size={18} />
                      </button>
                    {/if}
                  </div>
                  <span class="things">
                    {#each s.items as item, i (item.id)}<a href={'#/item/' + item.id}>{item.name}</a>{i < s.items.length - 1 ? ', ' : ''}{/each}
                  </span>
                </li>
              {/each}
            </ul>
          {/if}
        </section>
      {/each}
    </div>
  </main>
</div>

<dialog bind:this={dialog} aria-labelledby="rename-title">
  <form onsubmit={rename}>
    <h2 id="rename-title">{t('places.renameTitle', { name: target?.label ?? '' })}</h2>
    <div class="field">
      <label for="rename">{t('places.newName')}</label>
      <input id="rename" class="input" bind:value={newName} autocomplete="off" />
    </div>
    <p class="muted hint">{t('places.renameHint')}</p>
    <button type="submit" class="btn btn-primary">{t('save')}</button>
    <button type="button" class="btn-link" onclick={() => dialog.close()}>{t('cancel')}</button>
  </form>
</dialog>

<style>
  main {
    padding-bottom: calc(var(--nav-h) + 24px) !important;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-top: 12px;
  }
  .intro {
    margin-top: -8px;
    font-size: 17px;
  }
  .rooms {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .room {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 18px;
    overflow: hidden;
  }
  .room.open {
    border: 2px solid var(--primary);
  }
  .toggle {
    width: 100%;
    min-height: 66px;
    padding: 12px 16px;
    border: 0;
    background: transparent;
    display: flex;
    align-items: center;
    gap: 12px;
    text-align: left;
  }
  .open .toggle {
    background: var(--tint);
  }
  .room-name {
    flex: 1;
    font-size: 19px;
    font-weight: 800;
  }
  .count {
    font-size: 16px;
    color: var(--muted);
  }
  .open .count {
    color: var(--accent-text);
  }
  .chev {
    display: flex;
    transition: transform 0.15s;
  }
  .open .chev {
    transform: rotate(180deg);
  }
  .edit-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 10px 16px;
    border-top: 1px solid var(--divider);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li {
    padding: 12px 16px;
    border-top: 1px solid var(--divider);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .spot-head {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .spot {
    flex: 1;
    font-size: 17px;
    font-weight: 700;
  }
  .things {
    font-size: 16px;
    line-height: 1.6;
    color: var(--muted);
  }
  .things a {
    color: var(--muted);
    text-underline-offset: 3px;
    padding: 6px 0;
  }
  .mini {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: var(--surface);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .danger {
    color: var(--danger);
  }
  dialog {
    width: min(440px, calc(100vw - 32px));
    border: 0;
    border-radius: 20px;
    padding: 20px;
    background: var(--surface);
    color: var(--text);
    box-shadow: var(--shadow);
  }
  dialog::backdrop {
    background: rgba(16, 32, 26, 0.5);
  }
  dialog form {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .hint {
    font-size: 15px;
  }
</style>
