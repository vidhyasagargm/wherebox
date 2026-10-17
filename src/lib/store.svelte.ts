import { liveQuery } from 'dexie'
import { shouldTalk, spoken as words, talk } from './answers'
import { db, persistStorage, saveItem, undoSave, type Item } from './db'
import { t } from './i18n'
import { parse, splitPlace } from './parser'
import { go } from './router.svelte'
import { settings } from './settings.svelte'

export const data = $state<{ items: Item[]; rooms: string[]; loaded: boolean; storageError: boolean }>({
  items: [],
  rooms: [],
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

liveQuery(() => db.items.orderBy('updatedAt').reverse().toArray()).subscribe({
  next: (items) => {
    data.items = items
    data.loaded = true
  },
  error: blocked,
})
liveQuery(() => db.rooms.toArray()).subscribe({ next: (rooms) => (data.rooms = rooms.map((r) => r.name)), error: blocked })

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
  const result = await saveItem(what, where, id)
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
