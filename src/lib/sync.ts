// Two-way sync between this device and the account's lists.
//
// - Every change is saved locally first and marked dirty (works offline).
// - A sync pushes dirty items, then pulls the server's current state.
// - Realtime events bring other people's changes in right away.
// - Conflicts: the most recent edit wins.
import type PocketBase from 'pocketbase'
import type { RecordModel } from 'pocketbase'
import { account, checkConsent } from './account.svelte'
import { changes, db, isAccountList, photoBlob, storePhoto, type Item, type List, type Role } from './db'
import { t } from './i18n'
import { saveSettings, settings } from './settings.svelte'

let pb: PocketBase | null = null
let running: Promise<void> | null = null
let again = false
let timer: ReturnType<typeof setTimeout> | undefined
const cleanups: (() => void)[] = []

// PocketBase dates look like "2026-10-17 10:00:00.000Z"; Safari only parses them with a "T".
const parseDate = (s: string) => (s ? Date.parse(s.replace(' ', 'T')) : NaN)
const iso = (ms: number) => new Date(ms).toISOString()

function roleFor(rec: RecordModel, userId: string): Role | null {
  if (rec.owner === userId) return 'owner'
  if ((rec.editors as string[]).includes(userId)) return 'editor'
  if ((rec.viewers as string[]).includes(userId)) return 'viewer'
  return null
}

const toList = (rec: RecordModel, userId: string): List | null => {
  const role = roleFor(rec, userId)
  return role ? { id: rec.id, name: rec.name, role } : null
}

export async function ensureList(c: PocketBase): Promise<List> {
  const userId = c.authStore.record!.id
  const lists = (await c.collection('lists').getFullList()).map((r) => toList(r, userId)).filter((l): l is List => !!l)
  const own = lists.find((l) => l.role === 'owner') ?? lists[0]
  if (own) {
    await db.lists.bulkPut(lists)
    return own
  }
  const created = toList(await c.collection('lists').create({ name: t('lists.defaultName') }), userId)!
  await db.lists.put(created)
  return created
}

export function startSync(c: PocketBase) {
  pb = c
  const onChange = () => schedule(800)
  // Back online or back in front: catch up, and restart live updates if they aren't running
  // (e.g. the app was opened without a connection).
  const wake = () => {
    schedule(0)
    if (!c.realtime.isConnected) subscribe()
  }
  const onOnline = wake
  const onVisible = () => document.visibilityState === 'visible' && wake()
  // A safety net in case the live connection dies without anyone noticing.
  const every = setInterval(() => document.visibilityState === 'visible' && schedule(0), 5 * 60_000)
  cleanups.push(() => clearInterval(every))
  changes.addEventListener('change', onChange)
  addEventListener('online', onOnline)
  document.addEventListener('visibilitychange', onVisible)
  cleanups.push(
    () => changes.removeEventListener('change', onChange),
    () => removeEventListener('online', onOnline),
    () => document.removeEventListener('visibilitychange', onVisible),
  )
  // Renewing the session also tells the server the account is in use (see the inactivity clean-up).
  c.collection('users')
    .authRefresh()
    .then((r) => checkConsent(r.record))
    .catch((e) => {
      if (e?.status === 401) expired()
    })
    .finally(() => {
      syncNow()
      subscribe()
    })
}

export function stopSync() {
  clearTimeout(timer)
  while (cleanups.length) cleanups.pop()!()
  pb?.realtime.unsubscribe().catch(() => {})
  pb = null
}

function schedule(ms: number) {
  clearTimeout(timer)
  timer = setTimeout(syncNow, ms)
}

export function syncNow(): Promise<void> {
  if (!pb || account.expired) return Promise.resolve()
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    account.status = 'syncing'
    try {
      do {
        again = false
        await push()
        await pull()
      } while (again)
      account.status = 'idle'
      account.lastSync = Date.now()
    } catch (e) {
      handleError(e)
    } finally {
      running = null
    }
  })()
  return running
}

function handleError(e: unknown) {
  const status = (e as { status?: number })?.status
  if (status === 401) expired()
  else if (status === 0 || !navigator.onLine) account.status = 'offline'
  else {
    account.status = 'error'
    console.warn('sync failed', e)
  }
}

function expired() {
  account.expired = true
  account.status = 'idle'
}

let subscribing = false
async function subscribe() {
  if (!pb || subscribing) return
  const userId = pb.authStore.record?.id
  if (!userId) return
  subscribing = true
  try {
    // Start clean, so a failed earlier attempt doesn't leave duplicate listeners.
    await pb.realtime.unsubscribe().catch(() => {})
    // The live connection reconnects by itself after a lost signal, but changes made in the
    // meantime are not replayed: catch up with a full sync on every reconnect.
    let connected = false
    await pb.realtime.subscribe('PB_CONNECT', () => {
      if (connected) schedule(0)
      connected = true
    })
    await pb.collection('items').subscribe('*', async (e) => {
      if (e.action === 'delete') {
        const local = await db.items.get(e.record.id)
        if (local && !local.dirty) await db.items.delete(e.record.id)
      } else await applyRemote(e.record)
    })
    // List changes (renamed, someone added or removed) are rare: just resync.
    await pb.collection('lists').subscribe('*', () => schedule(0))
  } catch {
    // Live updates are a bonus; syncs still run, and the next wake-up tries again.
  } finally {
    subscribing = false
  }
}

// --- Push: send local changes ---

function serverFields(item: Item): Record<string, unknown> {
  const body: Record<string, unknown> = {
    name: item.name,
    where: item.where,
    since: iso(item.since),
    note: item.note ?? '',
    history: item.history ?? [],
    foundAt: item.foundAt ? iso(item.foundAt) : '',
  }
  if (item.photoDirty) {
    const blob = photoBlob(item.photo)
    body.photo = blob ? new File([blob], 'spot.jpg', { type: blob.type || 'image/jpeg' }) : null
  }
  return body
}

async function push() {
  const c = pb!
  const lists = new Map((await db.lists.toArray()).map((l) => [l.id, l]))
  const dirty = (await db.items.where('dirty').equals(1).toArray()).filter((i) => isAccountList(i.listId))
  const col = c.collection('items')

  for (const item of dirty) {
    const list = lists.get(item.listId)
    // No longer a member, or only allowed to view: the next pull restores the server's version.
    if (!list || list.role === 'viewer') {
      await db.items.update(item.id, { dirty: 0 })
      continue
    }
    try {
      if (item.deleted) {
        await col.delete(item.id).catch((e) => {
          if (e?.status !== 404) throw e
        })
        await db.items.delete(item.id)
        continue
      }
      const body = serverFields(item)
      let rec: RecordModel
      if (item.synced) {
        rec = await col.update(item.id, body).catch((e) => {
          if (e?.status === 404) return col.create({ ...body, id: item.id, list: item.listId })
          throw e
        })
      } else {
        rec = await col.create({ ...body, id: item.id, list: item.listId }).catch((e) => {
          // Created earlier but the reply never arrived: it already exists.
          if (e?.status === 400 && e?.response?.data?.id) return col.update(item.id, body)
          throw e
        })
      }
      // Only mark clean if nothing changed locally while we were sending.
      await db.transaction('rw', db.items, async () => {
        const now = await db.items.get(item.id)
        if (!now) return
        const clean = now.updatedAt === item.updatedAt
        await db.items.update(item.id, { synced: 1, photoName: rec.photo || undefined, ...(clean ? { dirty: 0, photoDirty: 0 } : {}) })
      })
    } catch (e) {
      const status = (e as { status?: number })?.status
      // Rejected by the server (e.g. invalid or not allowed): drop the change instead of retrying forever.
      if (status && status >= 400 && status < 500 && status !== 401 && status !== 429) {
        console.warn('change rejected', item.id, e)
        await db.items.update(item.id, { dirty: 0 })
      } else throw e
    }
  }
}

// --- Pull: bring this device up to date with the server ---

async function pull() {
  const c = pb!
  const userId = c.authStore.record!.id

  const remoteLists = (await c.collection('lists').getFullList()).map((r) => toList(r, userId)).filter((l): l is List => !!l)
  const listIds = new Set(remoteLists.map((l) => l.id))
  const known = await db.lists.toArray()
  const goneLists = known.filter((l) => !listIds.has(l.id)).map((l) => l.id)
  // Shared lists show whose they are ("From Sagar"), so two lists called "Home" can be told apart.
  for (const l of remoteLists) {
    if (l.role === 'owner') continue
    l.ownerName = known.find((k) => k.id === l.id)?.ownerName
    if (l.ownerName) continue
    try {
      const people: { name: string; role: Role }[] = await c.send(`/api/wb/lists/${l.id}/members`, { method: 'GET' })
      l.ownerName = people.find((p) => p.role === 'owner')?.name
    } catch {}
  }
  await db.transaction('rw', db.items, db.lists, async () => {
    await db.lists.bulkPut(remoteLists)
    for (const id of goneLists) {
      await db.lists.delete(id)
      await db.items.where('listId').equals(id).delete()
    }
  })
  // The list on screen was removed or left: show another one.
  if (isAccountList(settings.activeList) && !listIds.has(settings.activeList)) {
    settings.activeList = remoteLists.find((l) => l.role === 'owner')?.id ?? remoteLists[0]?.id ?? 'local'
    saveSettings()
  }

  const remote = await c.collection('items').getFullList({ batch: 500 })
  const remoteIds = new Set(remote.map((r) => r.id))
  for (const rec of remote) await applyRemote(rec)

  // Deleted on the server by someone else.
  const stale = (await db.items.toArray()).filter((i) => listIds.has(i.listId) && i.synced && !i.dirty && !remoteIds.has(i.id))
  await db.items.bulkDelete(stale.map((i) => i.id))
}

let fileToken: { value: string; at: number } | null = null
async function photoUrl(rec: RecordModel) {
  if (!fileToken || Date.now() - fileToken.at > 60_000) fileToken = { value: await pb!.files.getToken(), at: Date.now() }
  return pb!.files.getURL(rec, rec.photo, { token: fileToken.value })
}

async function applyRemote(rec: RecordModel) {
  const local = await db.items.get(rec.id)
  const remoteUpdated = parseDate(rec.updated)
  // Unsent local changes win: they're pushed next, and the server's result comes back after.
  // (Comparing clocks across devices is unreliable, and this also covers the echo of an
  // upload that is still finishing.)
  if (local?.dirty) return
  // Unchanged: skip, so the screen doesn't redraw for nothing.
  if (local && !local.dirty && local.updatedAt === remoteUpdated && (local.photoName ?? '') === (rec.photo ?? '')) return

  let photo = local?.photoName === rec.photo ? local?.photo : undefined
  let photoName: string | undefined = rec.photo || undefined
  if (rec.photo && rec.photo !== local?.photoName) {
    try {
      const res = await fetch(await photoUrl(rec))
      if (res.ok) photo = await storePhoto(await res.blob())
    } catch {}
    // Couldn't download it: keep what we have and try again next sync.
    if (!photo) {
      photo = local?.photo
      photoName = local?.photoName
    }
  }
  const item: Item = {
    id: rec.id,
    listId: rec.list,
    name: rec.name,
    where: rec.where,
    since: parseDate(rec.since),
    note: rec.note || undefined,
    history: Array.isArray(rec.history) ? rec.history : [],
    foundAt: rec.foundAt ? parseDate(rec.foundAt) : undefined,
    createdAt: parseDate(rec.created),
    updatedAt: remoteUpdated,
    photo,
    photoName,
    dirty: 0,
    deleted: 0,
    synced: 1,
    photoDirty: 0,
  }
  await db.items.put(item)
}
