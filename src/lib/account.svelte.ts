// Optional account: sign-in by emailed code, then sync and sharing.
// The PocketBase SDK is only downloaded once someone signs in, so people who
// never use an account don't pay for it.
import type PocketBase from 'pocketbase'
import { db, isAccountList, LOCAL, moveAll } from './db'
import { saveSettings, settings } from './settings.svelte'

export type AccountUser = { id: string; email: string; name: string }

export const account = $state<{
  user: AccountUser | null
  status: 'idle' | 'syncing' | 'offline' | 'error'
  lastSync: number | null
  // The session ran out (e.g. offline for over 30 days); data stays, sync pauses until sign-in.
  expired: boolean
  // The privacy notice or terms changed since this account agreed; asked before continuing.
  needsConsent: boolean
  // Whether this server offers accounts at all. Hosts can run the app without a backend.
  available: boolean
}>({ user: null, status: 'idle', lastSync: null, expired: false, needsConsent: false, available: false })

// Asks the server whether accounts exist here. Without a backend, sign-in stays hidden.
export async function checkAvailable() {
  try {
    const r = await fetch('/api/health', { signal: AbortSignal.timeout(4000) })
    account.available = r.ok
  } catch {
    account.available = false
  }
}

const AUTH_KEY = 'pocketbase_auth'
// Fallback if the server can't be asked; must match the server's CONSENT_VERSION.
const CONSENT_VERSION = '2026-10-17'

let pb: PocketBase | null = null

export async function client(): Promise<PocketBase> {
  if (pb) return pb
  const { default: PocketBase } = await import('pocketbase')
  pb = new PocketBase(location.origin)
  // Requests overlap during sync; don't let the SDK cancel duplicates.
  pb.autoCancellation(false)
  return pb
}

const toUser = (r: { id: string; email?: string; name?: string }): AccountUser => ({ id: r.id, email: r.email ?? '', name: r.name ?? '' })

// On app start: restore a previous session without loading the SDK for signed-out users.
export async function restoreSession() {
  let saved = false
  try {
    saved = !!localStorage.getItem(AUTH_KEY)
  } catch {}
  if (!saved) {
    await checkAvailable()
    // Offline at start: look again once there's a connection.
    if (!account.available) addEventListener('online', checkAvailable, { once: true })
    return
  }
  account.available = true
  const c = await client()
  if (!c.authStore.record) return
  account.user = toUser(c.authStore.record)
  const { startSync } = await import('./sync')
  startSync(c)
}

// Compares what the account agreed to with the current version.
export async function checkConsent(record: { [key: string]: unknown }) {
  const current = await consentVersion()
  const agreed = typeof record.consentVersion === 'string' ? record.consentVersion : ''
  account.needsConsent = !!agreed && agreed !== current
}

export async function agreeToCurrent() {
  const c = await client()
  await c.send('/api/wb/me/consent', { method: 'POST', body: { version: await consentVersion() } })
  account.needsConsent = false
}

export async function consentVersion(): Promise<string> {
  try {
    const r = await fetch('/api/wb/consent')
    if (r.ok) return (await r.json()).version
  } catch {}
  return CONSENT_VERSION
}

export async function requestCode(email: string, name: string): Promise<string> {
  const c = await client()
  const version = await consentVersion()
  // The consent flag lets the server create an account for a new address; existing accounts just get a code.
  const r = await c.collection('users').requestOTP(email, { body: { email, consent: true, consentVersion: version, name } })
  return r.otpId
}

export async function verifyCode(otpId: string, code: string) {
  const c = await client()
  const auth = await c.collection('users').authWithOTP(otpId, code.replace(/\D/g, ''))
  account.user = toUser(auth.record)
  account.expired = false
  await checkConsent(auth.record)
  // Make sure there's a list to sync into.
  const { ensureList, startSync } = await import('./sync')
  const list = await ensureList(c)
  if (!isAccountList(settings.activeList)) {
    settings.activeList = list.id
    saveSettings()
  }
  startSync(c)
  return list
}

export async function moveDeviceItems(toList: string) {
  const n = await moveAll(LOCAL, toList)
  const { syncNow } = await import('./sync')
  syncNow()
  return n
}

export async function localCount() {
  return (await db.items.where('listId').equals(LOCAL).toArray()).filter((i) => !i.deleted).length
}

// Signing out removes account data from this device (it may be shared), but keeps the device-only list.
export async function signOut() {
  const { stopSync } = await import('./sync')
  stopSync()
  const c = await client()
  c.authStore.clear()
  const listIds = (await db.lists.toArray()).map((l) => l.id)
  await db.transaction('rw', db.items, db.lists, async () => {
    for (const id of listIds) await db.items.where('listId').equals(id).delete()
    await db.lists.clear()
  })
  account.user = null
  account.status = 'idle'
  account.lastSync = null
  account.expired = false
  account.needsConsent = false
  settings.activeList = LOCAL
  saveSettings()
}

export async function updateName(name: string) {
  if (!account.user) return
  const c = await client()
  const r = await c.collection('users').update(account.user.id, { name })
  account.user = toUser(r)
}
