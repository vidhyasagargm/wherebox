import { changed, db, isAccountList, newId, photoBlob, storePhoto, visible, type Item } from './db'
import { isNative } from './platform'
import { settings } from './settings.svelte'

type BackupItem = Omit<Item, 'photo' | 'dirty' | 'deleted' | 'synced' | 'photoDirty' | 'photoName' | 'listId'> & { photo?: string }

type Backup = { app: 'wherebox'; version: 1; exportedAt: number; items: BackupItem[]; rooms: string[] }

const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })

const fromDataUrl = async (url: string) => (await fetch(url)).blob()

export async function exportBackup(): Promise<void> {
  const items = (await db.items.where('listId').equals(settings.activeList).toArray()).filter(visible)
  const rooms = (await db.rooms.toArray()).map((r) => r.name)
  const backup: Backup = {
    app: 'wherebox',
    version: 1,
    exportedAt: Date.now(),
    items: await Promise.all(
      items.map(async ({ photo, dirty: _d, deleted: _x, synced: _s, photoDirty: _p, photoName: _n, listId: _l, ...rest }) => ({
        ...rest,
        ...(photo ? { photo: await toDataUrl(photoBlob(photo)!) } : {}),
      })),
    ),
    rooms,
  }
  const name = `wherebox-backup-${new Date().toISOString().slice(0, 10)}.json`
  await saveFile(new File([JSON.stringify(backup)], name, { type: 'application/json' }))
}

// Hands a file to the user: the share sheet on phones (Files, Drive, email…), a download elsewhere.
export async function saveFile(file: File) {
  // The phone apps' web view can't download: write the file to the app's cache and share it.
  if (isNative) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')])
    const data = (await toDataUrl(file)).split(',')[1]
    const { uri } = await Filesystem.writeFile({ path: file.name, data, directory: Directory.Cache })
    try {
      await Share.share({ title: file.name, files: [uri] })
    } catch (e) {
      // Closing the share sheet isn't an error.
      if (/cancel/i.test((e as Error).message)) throw Object.assign(new Error('cancelled'), { name: 'AbortError' })
      throw e
    }
    return
  }
  if (navigator.canShare?.({ files: [file] }) && matchMedia('(pointer: coarse)').matches) {
    try {
      await navigator.share({ files: [file], title: file.name })
      return
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e
    }
  }
  const url = URL.createObjectURL(file)
  const a = Object.assign(document.createElement('a'), { href: url, download: file.name })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export async function readBackup(file: File): Promise<Backup> {
  const data = JSON.parse(await file.text())
  if (data?.app !== 'wherebox' || !Array.isArray(data.items)) throw new Error('invalid')
  return data as Backup
}

// Restores into the list on screen. Merges by id, so restoring the same backup twice adds no duplicates.
export async function importBackup(backup: Backup): Promise<number> {
  const listId = settings.activeList
  const account = isAccountList(listId)
  const items: Item[] = []
  for (const raw of backup.items) {
    if (typeof raw.id !== 'string' || typeof raw.name !== 'string' || typeof raw.where !== 'string') continue
    const { photo, ...rest } = raw
    const image = photo ? await storePhoto(await fromDataUrl(photo)) : undefined
    items.push({
      ...rest,
      // Older backups used long ids the server doesn't accept.
      id: /^[a-z0-9]{15}$/.test(rest.id) ? rest.id : newId(),
      listId,
      history: Array.isArray(rest.history) ? rest.history : [],
      updatedAt: Date.now(),
      dirty: account ? 1 : 0,
      deleted: 0,
      synced: 0,
      photoDirty: image ? 1 : 0,
      ...(image ? { photo: image } : {}),
    })
  }
  await db.transaction('rw', db.items, db.rooms, async () => {
    await db.items.bulkPut(items)
    await db.rooms.bulkPut((backup.rooms ?? []).filter((r) => typeof r === 'string').map((name) => ({ name })))
  })
  changed(listId)
  return items.length
}
