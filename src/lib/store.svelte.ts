import { liveQuery } from 'dexie'
import { shouldTalk, spoken as words, talk } from './answers'
import { db, isAccountList, persistStorage, saveItem, undoSave, visible, type Item, type List, type Role } from './db'
import { t } from './i18n'
import { parse, splitPlace } from './parser'
import { go } from './router.svelte'
import { settings } from './settings.svelte'

export const data = $state<{ items: Item[]; rooms: string[]; lists: List[]; loaded: boolean; storageError: boolean }>({
  items: [],
  rooms: [],
  lists: [],
  loaded: false,
  storageError: false,
})

// Private windows and strict privacy settings can block IndexedDB entirely.
const blocked = () => {
  data.storageError = true
  data.loaded = true
}

// Live queries stay silent when the database can't open, so check it directly.
db.open().catch(blocked)

// The screen shows one list at a time; re-query whenever the active list changes.
$effect.root(() => {
  $effect(() => {
    const listId = settings.activeList
    const sub = liveQuery(async () =>
      (await db.items.where('listId').equals(listId).toArray()).filter(visible).sort((a, b) => b.updatedAt - a.updatedAt),
    ).subscribe({
      next: (items) => {
        data.items = items
        data.loaded = true
      },
      error: blocked,
    })
    return () => sub.unsubscribe()
  })
})
liveQuery(() => db.lists.toArray()).subscribe({ next: (lists) => (data.lists = lists), error: blocked })
liveQuery(() => db.rooms.toArray()).subscribe({ next: (rooms) => (data.rooms = rooms.map((r) => r.name)), error: blocked })

// Your role in a list. The device-only list is always yours.
export function listRole(listId: string): Role {
  if (!isAccountList(listId)) return 'owner'
  return data.lists.find((l) => l.id === listId)?.role ?? 'viewer'
}

export const activeRole = () => listRole(settings.activeList)

export const canEdit = () => activeRole() !== 'viewer'

export function activeListName(): string {
  if (!isAccountList(settings.activeList)) return t('lists.device')
  const list = data.lists.find((l) => l.id === settings.activeList)
  if (!list) return ''
  // "Home · Sagar" for someone else's list, so it isn't mixed up with your own "Home".
  return list.role !== 'owner' && list.ownerName ? `${list.name} · ${list.ownerName}` : list.name
}

export type Toast = { id: number; title: string; text?: string; undo?: () => Promise<void>; edit?: () => void }

export const toast = $state<{ current: Toast | null }>({ current: null })

let timer: ReturnType<typeof setTimeout> | undefined
let nextId = 1

export function showToast(t: Omit<Toast, 'id'>, ms = 6000) {
  clearTimeout(timer)
  const id = nextId++
  toast.current = { ...t, id }
  timer = setTimeout(() => {
    if (toast.current?.id === id) toast.current = null
  }, ms)
}

export function hideToast() {
  clearTimeout(timer)
  toast.current = null
}

export async function save(what: string, where: string, id?: string, spoken = false) {
  if (!canEdit()) {
    showToast({ title: t('lists.viewOnly') }, 4000)
    return null
  }
  const result = await saveItem(settings.activeList, what, where, id)
  if (shouldTalk(spoken)) talk(words.saved(result.moved, result.item))
  // First save is the right moment to ask the browser to keep our data.
  if (data.items.length <= 1) persistStorage()
  showToast({
    title: result.moved ? t('saved.moved') : t('saved.saved'),
    text: `${result.item.name} → ${result.item.where}`,
    undo: async () => {
      await undoSave(result)
      showToast({ title: t('saved.undone') }, 2500)
    },
    edit: () => go('confirm', { id: result.item.id, what: result.item.name, where: result.item.where }),
  })
  return result
}

// The single entry point for whatever the user typed or said.
// `spoken` means the user asked by voice, so the answer is read aloud too.
export async function handle(text: string, opts: { replace?: boolean; spoken?: boolean } = {}) {
  const parsed = parse(text, settings.lang)
  if (parsed.kind !== 'ask' && !canEdit()) {
    showToast({ title: t('lists.viewOnly') }, 4000)
    if (shouldTalk(!!opts.spoken)) talk(t('lists.viewOnly'))
    go('', {}, opts.replace)
    return
  }
  if (parsed.kind === 'save') {
    await save(parsed.what, parsed.where, undefined, opts.spoken)
    go('', {}, opts.replace)
  } else if (parsed.kind === 'ask') {
    go('find', { q: parsed.what, said: text, ...(opts.spoken ? { spoken: '1' } : {}) }, opts.replace)
  } else {
    if (shouldTalk(!!opts.spoken)) talk(words.unclear())
    go('confirm', { what: parsed.what, where: parsed.where, said: text }, opts.replace)
  }
}

export type Place = { room: string; spot: string; items: Item[] }

export function places(items: Item[], rooms: string[]) {
  const byRoom = new Map<string, Map<string, Item[]>>()
  for (const item of items) {
    const { room, spot } = splitPlace(item.where, rooms)
    const key = room || ''
    const spots = byRoom.get(key) ?? new Map<string, Item[]>()
    const spotKey = spot || ''
    spots.set(spotKey, [...(spots.get(spotKey) ?? []), item])
    byRoom.set(key, spots)
  }
  return [...byRoom.entries()]
    .map(([room, spots]) => ({
      room,
      count: [...spots.values()].reduce((n, s) => n + s.length, 0),
      spots: [...spots.entries()].map(([spot, items]) => ({ spot, items })).sort((a, b) => b.items.length - a.items.length),
    }))
    .sort((a, b) => (a.room ? 0 : 1) - (b.room ? 0 : 1) || b.count - a.count)
}
