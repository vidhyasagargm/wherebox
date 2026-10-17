// Managing account lists: create, rename, delete, members and invite links.
// These need a connection; the screens explain when there isn't one.
import { client } from './account.svelte'
import { db, LOCAL, type List, type Role } from './db'
import { api, webLink } from './platform'
import { saveSettings, settings } from './settings.svelte'

export type Member = { id: string; name: string; role: Role; you: boolean }
export type InvitePreview = { list: string; inviter: string; role: 'editor' | 'viewer'; expiresAt: string }

// Invites are stored here while someone signs in, so they return to the invite afterwards.
const PENDING_INVITE = 'wherebox.pendingInvite'

async function sync() {
  const { syncNow } = await import('./sync')
  await syncNow()
}

export function setActiveList(id: string) {
  settings.activeList = id
  saveSettings()
}

export async function createList(name: string): Promise<List> {
  const c = await client()
  const rec = await c.collection('lists').create({ name })
  const list: List = { id: rec.id, name: rec.name, role: 'owner' }
  await db.lists.put(list)
  return list
}

export async function renameList(id: string, name: string) {
  const c = await client()
  await c.collection('lists').update(id, { name })
  await db.lists.update(id, { name })
}

// Removes the list from this device straight away; the server confirms on the next sync.
async function dropLocally(id: string) {
  await db.transaction('rw', db.items, db.lists, async () => {
    await db.items.where('listId').equals(id).delete()
    await db.lists.delete(id)
  })
  if (settings.activeList === id) {
    const next = (await db.lists.toArray()).find((l) => l.role === 'owner')
    setActiveList(next?.id ?? LOCAL)
  }
}

export async function deleteList(id: string) {
  const c = await client()
  await c.collection('lists').delete(id)
  await dropLocally(id)
}

export async function members(listId: string): Promise<Member[]> {
  const c = await client()
  return c.send(`/api/wb/lists/${listId}/members`, { method: 'GET' })
}

export async function setMemberRole(listId: string, userId: string, role: 'editor' | 'viewer') {
  const c = await client()
  await c.send(`/api/wb/lists/${listId}/members/${userId}`, { method: 'PATCH', body: { role } })
}

export async function removeMember(listId: string, userId: string) {
  const c = await client()
  await c.send(`/api/wb/lists/${listId}/members/${userId}`, { method: 'DELETE' })
}

export async function leaveList(listId: string) {
  const c = await client()
  await c.send(`/api/wb/lists/${listId}/members/${c.authStore.record!.id}`, { method: 'DELETE' })
  await dropLocally(listId)
}

export function inviteLink(token: string) {
  // After the "#", so the token never reaches any server log.
  return webLink(`join/${token}`)
}

export async function createInvite(listId: string, role: 'editor' | 'viewer'): Promise<{ url: string; expiresAt: string }> {
  const c = await client()
  const r = await c.send(`/api/wb/lists/${listId}/invites`, { method: 'POST', body: { role } })
  return { url: inviteLink(r.token), expiresAt: r.expiresAt }
}

export async function revokeInvites(listId: string): Promise<number> {
  const c = await client()
  return (await c.send(`/api/wb/lists/${listId}/invites`, { method: 'DELETE' })).revoked
}

export async function previewInvite(token: string): Promise<InvitePreview> {
  const res = await fetch(api(`/api/wb/invites/${encodeURIComponent(token)}`))
  if (!res.ok) throw Object.assign(new Error('invite'), { status: res.status })
  return res.json()
}

export async function acceptInvite(token: string): Promise<{ list: string; role: Role }> {
  const c = await client()
  const r = await c.send(`/api/wb/invites/${encodeURIComponent(token)}/accept`, { method: 'POST' })
  await sync()
  setActiveList(r.list)
  clearPendingInvite()
  return r
}

export function rememberInvite(token: string) {
  try {
    sessionStorage.setItem(PENDING_INVITE, token)
  } catch {}
}

export function pendingInvite(): string | null {
  try {
    return sessionStorage.getItem(PENDING_INVITE)
  } catch {
    return null
  }
}

function clearPendingInvite() {
  try {
    sessionStorage.removeItem(PENDING_INVITE)
  } catch {}
}
