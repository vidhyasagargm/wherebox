// "Download my data" (Art. 15/20 GDPR) and "Delete my account" (Art. 17).
import { client, signOut } from './account.svelte'
import { saveFile } from './backup'
import { changed, db, LOCAL, newId, visible } from './db'

const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })

const parse = (s: string) => (s ? Date.parse(s.replace(' ', 'T')) : undefined)

// Everything the server holds about you and your lists, fetched fresh from the server.
// The file also works with "Import backup", so it doubles as a backup.
export async function downloadMyData() {
  const c = await client()
  const me = await c.send('/api/wb/me/export', { method: 'GET' })
  const records = await c.collection('items').getFullList({ batch: 500 })
  const token = records.some((r) => r.photo) ? await c.files.getToken() : ''
  const items = []
  for (const r of records) {
    let photo: string | undefined
    if (r.photo) {
      try {
        const res = await fetch(c.files.getURL(r, r.photo, { token }))
        if (res.ok) photo = await toDataUrl(await res.blob())
      } catch {}
    }
    items.push({
      id: r.id,
      list: r.list,
      name: r.name,
      where: r.where,
      since: parse(r.since),
      note: r.note || undefined,
      history: r.history ?? [],
      foundAt: parse(r.foundAt),
      createdAt: parse(r.created),
      updatedAt: parse(r.updated),
      addedByYou: r.createdBy === me.account.id,
      ...(photo ? { photo } : {}),
    })
  }
  const data = { app: 'wherebox', version: 1, kind: 'account-export', exportedAt: Date.now(), account: me.account, lists: me.lists, items, rooms: [] }
  const name = `wherebox-my-data-${new Date().toISOString().slice(0, 10)}.json`
  await saveFile(new File([JSON.stringify(data, null, 2)], name, { type: 'application/json' }))
}

// Copies every account list's items into the device-only list, so they survive the deletion.
// Returns the new ids, so the copy can be undone if the deletion fails.
async function keepCopyOnDevice(): Promise<string[]> {
  const lists = await db.lists.toArray()
  const items = (await db.items.toArray()).filter((i) => visible(i) && lists.some((l) => l.id === i.listId))
  const now = Date.now()
  const copies = items.map((i) => ({ ...i, id: newId(), listId: LOCAL, updatedAt: now, dirty: 0, deleted: 0, synced: 0, photoDirty: 0, photoName: undefined }))
  await db.items.bulkAdd(copies)
  changed(LOCAL)
  return copies.map((i) => i.id)
}

export async function deleteAccount(keepCopy: boolean) {
  const c = await client()
  // Send anything still waiting, so the kept copy and the server agree. If the deletion fails, the copy is undone.
  const { syncNow } = await import('./sync')
  await syncNow()
  const copies = keepCopy ? await keepCopyOnDevice() : []
  try {
    await c.send('/api/wb/me', { method: 'DELETE', body: { confirm: true } })
  } catch (e) {
    await db.items.bulkDelete(copies)
    throw e
  }
  await signOut()
}
