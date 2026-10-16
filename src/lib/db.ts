import Dexie, { type EntityTable } from 'dexie'

export type Move = { where: string; from: number; to: number }

export type Item = {
  id: string
  name: string
  where: string
  since: number
  note?: string
  photo?: Blob
  history: Move[]
  createdAt: number
  updatedAt: number
  foundAt?: number
}

// Rooms the user named themselves (by renaming a place), so they group like built-in rooms.
export type Room = { name: string }

export const db = new Dexie('wherebox') as Dexie & {
  items: EntityTable<Item, 'id'>
  rooms: EntityTable<Room, 'name'>
}

db.version(1).stores({
  items: 'id, name, updatedAt',
  rooms: 'name',
})

const sameName = (a: string, b: string) => a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase()

export type SaveResult = { item: Item; moved: boolean; previous?: Item }

// Saving a name that already exists is a move: the old place goes into history.
export async function saveItem(name: string, where: string, id?: string): Promise<SaveResult> {
  const now = Date.now()
  const all = await db.items.toArray()
  const existing = id ? all.find((i) => i.id === id) : all.find((i) => sameName(i.name, name))
  if (existing) {
    const previous = structuredClone(existing)
    const placeChanged = !sameName(existing.where, where)
    const item: Item = {
      ...existing,
      name,
      where,
      since: placeChanged ? now : existing.since,
      history: placeChanged ? [{ where: existing.where, from: existing.since, to: now }, ...existing.history] : existing.history,
      updatedAt: now,
    }
    await db.items.put(item)
    return { item, moved: placeChanged, previous }
  }
  const item: Item = { id: crypto.randomUUID(), name, where, since: now, history: [], createdAt: now, updatedAt: now }
  await db.items.add(item)
  return { item, moved: false }
}

export async function undoSave(result: SaveResult) {
  if (result.previous) await db.items.put(result.previous)
  else await db.items.delete(result.item.id)
}

export async function updateItem(id: string, changes: Partial<Item>) {
  await db.items.update(id, { ...changes, updatedAt: Date.now() })
}

export async function deleteItem(id: string) {
  await db.items.delete(id)
}

export async function markFound(id: string) {
  await db.items.update(id, { foundAt: Date.now() })
}

// Rewrites every item's place text, used to rename or merge places.
export async function renamePlace(match: (where: string) => string | null) {
  await db.transaction('rw', db.items, async () => {
    const all = await db.items.toArray()
    for (const item of all) {
      const next = match(item.where)
      if (next !== null && next !== item.where) await db.items.update(item.id, { where: next, updatedAt: Date.now() })
    }
  })
}

// Ask the browser not to clear our data under storage pressure.
export async function persistStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  if (await navigator.storage.persisted()) return true
  return navigator.storage.persist()
}

export async function compressPhoto(file: File, max = 1280): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('photo'))), 'image/jpeg', 0.8))
}
