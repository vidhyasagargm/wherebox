import Dexie, { type EntityTable } from 'dexie'

export type Move = { where: string; from: number; to: number }

// The list that only lives on this device (no account needed).
export const LOCAL = 'local'

export type Item = {
  id: string
  listId: string
  name: string
  where: string
  since: number
  note?: string
  photo?: Blob
  history: Move[]
  createdAt: number
  updatedAt: number
  foundAt?: number
  // Sync bookkeeping, only meaningful for account lists (0/1 so Dexie can index them).
  dirty: number
  deleted: number
  synced?: number
  photoDirty?: number
  photoName?: string
}

export type Role = 'owner' | 'editor' | 'viewer'

// An account list, as last seen from the server.
export type List = { id: string; name: string; role: Role }

// Rooms the user named themselves (by renaming a place), so they group like built-in rooms.
export type Room = { name: string }

export const db = new Dexie('wherebox') as Dexie & {
  items: EntityTable<Item, 'id'>
  rooms: EntityTable<Room, 'name'>
  lists: EntityTable<List, 'id'>
}

db.version(1).stores({
  items: 'id, name, updatedAt',
  rooms: 'name',
})

db.version(2)
  .stores({
    items: 'id, name, updatedAt, listId, dirty',
    rooms: 'name',
    lists: 'id',
  })
  .upgrade((tx) =>
    tx
      .table('items')
      .toCollection()
      .modify((item: Item) => {
        item.listId ??= LOCAL
        item.dirty = 0
        item.deleted = 0
      }),
  )

export const isAccountList = (listId: string) => listId !== LOCAL

// 15 lowercase letters/digits: the id format the server uses, so offline-created items keep their id.
export function newId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = crypto.getRandomValues(new Uint8Array(15))
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

// Sync listens to this to push changes soon after they're made.
export const changes = new EventTarget()
export const changed = (listId: string) => {
  if (isAccountList(listId)) changes.dispatchEvent(new Event('change'))
}

// Marks an item as edited now; account-list items also become "to sync".
function touched<T extends Partial<Item>>(listId: string, fields: T): T & { updatedAt: number; dirty: number } {
  return { ...fields, updatedAt: Date.now(), dirty: isAccountList(listId) ? 1 : 0 }
}

const sameName = (a: string, b: string) => a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase()

export const visible = (item: Item) => !item.deleted

export type SaveResult = { item: Item; moved: boolean; previous?: Item }

// Saving a name that already exists in the list is a move: the old place goes into history.
export async function saveItem(listId: string, name: string, where: string, id?: string): Promise<SaveResult> {
  const now = Date.now()
  const inList = (await db.items.where('listId').equals(listId).toArray()).filter(visible)
  const existing = id ? inList.find((i) => i.id === id) : inList.find((i) => sameName(i.name, name))
  if (existing) {
    const previous = structuredClone(existing)
    const placeChanged = !sameName(existing.where, where)
    const item: Item = {
      ...existing,
      ...touched(listId, {}),
      name,
      where,
      since: placeChanged ? now : existing.since,
      history: placeChanged ? [{ where: existing.where, from: existing.since, to: now }, ...existing.history] : existing.history,
    }
    await db.items.put(item)
    changed(listId)
    return { item, moved: placeChanged, previous }
  }
  const item: Item = {
    id: newId(),
    listId,
    name,
    where,
    since: now,
    history: [],
    createdAt: now,
    ...touched(listId, {}),
    deleted: 0,
  }
  await db.items.add(item)
  changed(listId)
  return { item, moved: false }
}

export async function undoSave(result: SaveResult) {
  if (result.previous) {
    await db.items.put({ ...result.previous, ...touched(result.previous.listId, {}) })
    changed(result.previous.listId)
  } else await deleteItem(result.item.id)
}

export async function updateItem(id: string, fields: Partial<Item>) {
  const item = await db.items.get(id)
  if (!item) return
  await db.items.update(id, touched(item.listId, { ...fields, ...('photo' in fields ? { photoDirty: 1 } : {}) }))
  changed(item.listId)
}

// Account-list items that the server knows about are kept as a "deleted" marker until the deletion is synced.
export async function deleteItem(id: string) {
  const item = await db.items.get(id)
  if (!item) return
  if (isAccountList(item.listId) && item.synced) await db.items.update(id, { ...touched(item.listId, {}), deleted: 1, photo: undefined })
  else await db.items.delete(id)
  changed(item.listId)
}

export async function deleteItems(ids: string[]) {
  for (const id of ids) await deleteItem(id)
}

export async function markFound(id: string) {
  await updateItem(id, { foundAt: Date.now() })
}

// Rewrites the place text of items in one list, used to rename or merge places.
export async function renamePlace(listId: string, match: (where: string) => string | null) {
  const items = (await db.items.where('listId').equals(listId).toArray()).filter(visible)
  for (const item of items) {
    const next = match(item.where)
    if (next !== null && next !== item.where) await db.items.update(item.id, touched(listId, { where: next }))
  }
  changed(listId)
}

// Moves everything from one list into another (e.g. this device's list into a new account).
export async function moveAll(fromList: string, toList: string): Promise<number> {
  const items = (await db.items.where('listId').equals(fromList).toArray()).filter(visible)
  await db.transaction('rw', db.items, async () => {
    for (const item of items) {
      await db.items.delete(item.id)
      await db.items.add({
        ...item,
        // Older items have long ids the server doesn't accept.
        id: /^[a-z0-9]{15}$/.test(item.id) ? item.id : newId(),
        listId: toList,
        ...touched(toList, {}),
        synced: 0,
        deleted: 0,
        photoDirty: item.photo ? 1 : 0,
        photoName: undefined,
      })
    }
  })
  changed(toList)
  return items.length
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
