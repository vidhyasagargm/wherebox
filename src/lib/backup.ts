import { db, type Item } from './db'

type BackupItem = Omit<Item, 'photo'> & { photo?: string }

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
  const items = await db.items.toArray()
  const rooms = (await db.rooms.toArray()).map((r) => r.name)
  const backup: Backup = {
    app: 'wherebox',
    version: 1,
    exportedAt: Date.now(),
    items: await Promise.all(items.map(async ({ photo, ...rest }) => ({ ...rest, ...(photo ? { photo: await toDataUrl(photo) } : {}) }))),
    rooms,
  }
  const name = `wherebox-backup-${new Date().toISOString().slice(0, 10)}.json`
  const file = new File([JSON.stringify(backup)], name, { type: 'application/json' })

  // On phones the share sheet lets people pick Files, Drive, email or a messenger.
  if (navigator.canShare?.({ files: [file] }) && matchMedia('(pointer: coarse)').matches) {
    try {
      await navigator.share({ files: [file], title: name })
      return
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e
    }
  }
  const url = URL.createObjectURL(file)
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
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

// Merges by id: restoring the same backup twice does not create duplicates.
export async function importBackup(backup: Backup): Promise<number> {
  const items: Item[] = []
  for (const raw of backup.items) {
    if (typeof raw.id !== 'string' || typeof raw.name !== 'string' || typeof raw.where !== 'string') continue
    const { photo, ...rest } = raw
    items.push({
      ...rest,
      history: Array.isArray(rest.history) ? rest.history : [],
      ...(photo ? { photo: await fromDataUrl(photo) } : {}),
    })
  }
  await db.transaction('rw', db.items, db.rooms, async () => {
    await db.items.bulkPut(items)
    await db.rooms.bulkPut((backup.rooms ?? []).filter((r) => typeof r === 'string').map((name) => ({ name })))
  })
  return items.length
}
