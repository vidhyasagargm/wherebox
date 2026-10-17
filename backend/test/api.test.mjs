// End-to-end tests for the Wherebox backend.
// Starts a real PocketBase with a throwaway database and a tiny SMTP server that
// captures the emailed sign-in codes. Run: npm run test:backend
import { spawn, execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'

const ROOT = resolve(import.meta.dirname, '..')
const BIN = process.env.PB_BIN ?? join(ROOT, '.bin', 'pocketbase')
const PORT = 8000 + Math.floor(Math.random() * 900)
const SMTP_PORT = PORT + 1000
const API = `http://127.0.0.1:${PORT}`
const ADMIN = { email: 'admin@test.local', password: 'test-only-password-123' }

// --- Minimal SMTP sink: stores each message's text by recipient ---
const mail = new Map()
const smtp = createServer((sock) => {
  let data = false
  let buf = ''
  let rcpt = ''
  sock.write('220 sink\r\n')
  sock.on('data', (chunk) => {
    buf += chunk.toString()
    let i
    while ((i = buf.indexOf('\r\n')) >= 0) {
      const line = buf.slice(0, i)
      buf = buf.slice(i + 2)
      if (data) {
        if (line === '.') {
          data = false
          sock.write('250 ok\r\n')
        } else mail.set(rcpt, (mail.get(rcpt) ?? '') + line + '\n')
        continue
      }
      const cmd = line.slice(0, 4).toUpperCase()
      if (cmd === 'EHLO' || cmd === 'HELO') sock.write('250 sink\r\n')
      else if (cmd === 'RCPT') {
        rcpt = /<([^>]+)>/.exec(line)?.[1] ?? ''
        mail.set(rcpt, '')
        sock.write('250 ok\r\n')
      } else if (cmd === 'DATA') {
        data = true
        sock.write('354 go\r\n')
      } else if (cmd === 'QUIT') {
        sock.write('221 bye\r\n')
        sock.end()
      } else sock.write('250 ok\r\n')
    }
  })
})

let pb
let dir
const waitFor = async (fn, ms = 8000) => {
  const end = Date.now() + ms
  for (;;) {
    try {
      const v = await fn()
      if (v) return v
    } catch {}
    if (Date.now() > end) throw new Error('timeout')
    await new Promise((r) => setTimeout(r, 100))
  }
}

async function call(method, path, { token, body, raw } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { ...(token ? { Authorization: token } : {}), ...(body && !raw ? { 'Content-Type': 'application/json' } : {}) },
    body: raw ?? (body ? JSON.stringify(body) : undefined),
  })
  const text = await res.text()
  return { status: res.status, json: text ? JSON.parse(text) : null }
}

// Signs a user in through the real email-code flow and returns their token and id.
async function signIn(email, { consent = true, name = '' } = {}) {
  mail.delete(email)
  const req = await call('POST', '/api/collections/users/request-otp', { body: { email, consent, consentVersion: '2026-10-17', name } })
  assert.equal(req.status, 200)
  const text = await waitFor(() => mail.get(email)?.match(/\b(\d{6})\b/))
  const auth = await call('POST', '/api/collections/users/auth-with-otp', { body: { otpId: req.json.otpId, password: text[1] } })
  assert.equal(auth.status, 200, JSON.stringify(auth.json))
  return { token: auth.json.token, id: auth.json.record.id, record: auth.json.record }
}

before(async () => {
  await new Promise((r) => smtp.listen(SMTP_PORT, '127.0.0.1', r))
  dir = mkdtempSync(join(tmpdir(), 'wb-pb-'))
  const args = ['--dir', join(dir, 'pb_data'), '--migrationsDir', join(ROOT, 'pb_migrations'), '--hooksDir', join(ROOT, 'pb_hooks')]
  execFileSync(BIN, ['migrate', 'up', ...args], { stdio: 'pipe' })
  execFileSync(BIN, ['superuser', 'upsert', ADMIN.email, ADMIN.password, ...args], { stdio: 'pipe' })
  pb = spawn(BIN, ['serve', '--http', `127.0.0.1:${PORT}`, ...args], {
    env: { ...process.env, SMTP_HOST: '127.0.0.1', SMTP_PORT: String(SMTP_PORT), SMTP_FROM: 'noreply@test.local', WB_APP_URL: 'http://localhost:5173' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let log = ''
  pb.stdout.on('data', (d) => (log += d))
  pb.stderr.on('data', (d) => (log += d))
  pb.on('exit', (code) => code && console.error(log))
  await waitFor(async () => (await fetch(API + '/api/health')).ok)

  // The tests sign in many times from one address; lift the limits until the rate-limit test.
  const admin = await adminToken()
  const settings = (await call('GET', '/api/settings', { token: admin })).json
  productionLimits = settings.rateLimits
  await call('PATCH', '/api/settings', { token: admin, body: { rateLimits: { ...productionLimits, rules: productionLimits.rules.map((r) => ({ ...r, maxRequests: 10000 })) } } })
})

let productionLimits
async function adminToken() {
  return (await call('POST', '/api/collections/_superusers/auth-with-password', { body: { identity: ADMIN.email, password: ADMIN.password } })).json.token
}

after(() => {
  pb?.kill()
  smtp.close()
  if (dir) rmSync(dir, { recursive: true, force: true })
})

describe('sign-up and sign-in', () => {
  it('does not create an account or send mail without consent', async () => {
    const r = await call('POST', '/api/collections/users/request-otp', { body: { email: 'noconsent@test.local' } })
    assert.equal(r.status, 200)
    assert.ok(r.json.otpId, 'same response shape as for real accounts')
    await new Promise((res) => setTimeout(res, 500))
    assert.equal(mail.has('noconsent@test.local'), false)
  })

  it('creates the account with consent, verifies it on sign-in and records consent', async () => {
    const a = await signIn('alice@test.local', { name: 'Alice' })
    assert.equal(a.record.verified, true)
    assert.equal(a.record.consentVersion, '2026-10-17')
    assert.ok(a.record.consentAt)
    assert.ok(a.record.lastActiveAt)
    assert.equal(a.record.avatar, undefined)
  })

  it('tells the app which consent version to ask for', async () => {
    const r = await call('GET', '/api/wb/consent')
    assert.equal(r.status, 200)
    assert.match(r.json.version, /^\d{4}-\d{2}-\d{2}$/)
  })

  it('records agreement to the current version only', async () => {
    const a = await signIn('consent@test.local')
    assert.equal((await call('POST', '/api/wb/me/consent', { token: a.token, body: { version: '2000-01-01' } })).status, 400)
    const version = (await call('GET', '/api/wb/consent')).json.version
    const r = await call('POST', '/api/wb/me/consent', { token: a.token, body: { version } })
    assert.equal(r.status, 200)
    assert.equal(r.json.consentVersion, version)
    assert.equal((await call('POST', '/api/wb/me/consent', { body: { version } })).status, 401)
  })

  it('has no password sign-in', async () => {
    const r = await call('POST', '/api/collections/users/auth-with-password', { body: { identity: 'alice@test.local', password: 'x' } })
    assert.notEqual(r.status, 200)
  })

  it('rejects creating accounts directly and editing consent fields', async () => {
    const r = await call('POST', '/api/collections/users/records', { body: { email: 'x@test.local', password: '12345678', passwordConfirm: '12345678' } })
    assert.notEqual(r.status, 200)
    const a = await signIn('alice@test.local')
    const u = await call('PATCH', `/api/collections/users/records/${a.id}`, { token: a.token, body: { consentVersion: 'fake' } })
    assert.notEqual(u.status, 200)
    const ok = await call('PATCH', `/api/collections/users/records/${a.id}`, { token: a.token, body: { name: 'Alice B' } })
    assert.equal(ok.status, 200)
  })
})

describe('lists, items and sharing', () => {
  let alice, bob, eve, list, item

  before(async () => {
    alice = await signIn('alice@test.local')
    bob = await signIn('bob@test.local', { name: 'Bob' })
    eve = await signIn('eve@test.local')
  })

  it('makes the creator the owner, whatever the client sends', async () => {
    const r = await call('POST', '/api/collections/lists/records', { token: alice.token, body: { name: 'Home', owner: bob.id, editors: [bob.id, eve.id] } })
    assert.equal(r.status, 200, JSON.stringify(r.json))
    list = r.json
    assert.equal(list.owner, alice.id)
    assert.deepEqual(list.editors, [alice.id])
    assert.deepEqual(list.viewers, [])
  })

  it('lets editors add items and sets the author', async () => {
    const r = await call('POST', '/api/collections/items/records', {
      token: alice.token,
      body: { list: list.id, name: 'Passport', where: 'Bedroom drawer', since: '2026-10-17 10:00:00.000Z', createdBy: bob.id },
    })
    assert.equal(r.status, 200, JSON.stringify(r.json))
    item = r.json
    assert.equal(item.createdBy, alice.id)
  })

  it('accepts client-chosen ids, so offline-created items keep their id', async () => {
    const id = 'abcdefghij12345'
    const r = await call('POST', '/api/collections/items/records', { token: alice.token, body: { id, list: list.id, name: 'Drill', where: 'Garage', since: '2026-10-17 10:00:00.000Z' } })
    assert.equal(r.status, 200, JSON.stringify(r.json))
    assert.equal(r.json.id, id)
  })

  it('hides lists and items from non-members', async () => {
    assert.equal((await call('GET', `/api/collections/lists/records/${list.id}`, { token: eve.token })).status, 404)
    assert.equal((await call('GET', '/api/collections/items/records', { token: eve.token })).json.totalItems, 0)
    assert.equal((await call('GET', '/api/collections/items/records')).json.totalItems, 0)
    const w = await call('POST', '/api/collections/items/records', { token: eve.token, body: { list: list.id, name: 'x', where: 'y', since: '2026-10-17 10:00:00.000Z' } })
    assert.notEqual(w.status, 200)
    assert.equal((await call('GET', `/api/wb/lists/${list.id}/members`, { token: eve.token })).status, 404)
  })

  it("doesn't let anyone read other users' accounts", async () => {
    const r = await call('GET', '/api/collections/users/records', { token: eve.token })
    assert.deepEqual(r.json.items.map((u) => u.id), [eve.id])
  })

  it('only lets the owner create invites', async () => {
    assert.equal((await call('POST', `/api/wb/lists/${list.id}/invites`, { token: eve.token, body: { role: 'viewer' } })).status, 404)
  })

  it('lets a viewer join by link, read but not write', async () => {
    const inv = await call('POST', `/api/wb/lists/${list.id}/invites`, { token: alice.token, body: { role: 'viewer' } })
    assert.equal(inv.status, 200)
    const preview = await call('GET', `/api/wb/invites/${inv.json.token}`)
    assert.deepEqual([preview.json.list, preview.json.role, preview.json.inviter], ['Home', 'viewer', 'Alice B'])
    const acc = await call('POST', `/api/wb/invites/${inv.json.token}/accept`, { token: bob.token })
    assert.equal(acc.json.role, 'viewer')
    assert.equal((await call('GET', '/api/collections/items/records', { token: bob.token })).json.totalItems, 2)
    const w = await call('PATCH', `/api/collections/items/records/${item.id}`, { token: bob.token, body: { where: 'Garage' } })
    assert.notEqual(w.status, 200)
  })

  it('rejects unknown and fake invite tokens', async () => {
    assert.equal((await call('GET', '/api/wb/invites/not-a-real-token')).status, 404)
    assert.equal((await call('POST', '/api/wb/invites/not-a-real-token/accept', { token: eve.token })).status, 404)
  })

  it('shows members with names or masked emails only', async () => {
    const r = await call('GET', `/api/wb/lists/${list.id}/members`, { token: bob.token })
    assert.equal(r.status, 200)
    const roles = Object.fromEntries(r.json.map((m) => [m.id, m.role]))
    assert.deepEqual(roles, { [alice.id]: 'owner', [bob.id]: 'viewer' })
    assert.ok(!JSON.stringify(r.json).includes('@test.local'), 'no full email addresses')
  })

  it('lets the owner promote a viewer to editor', async () => {
    assert.equal((await call('PATCH', `/api/wb/lists/${list.id}/members/${alice.id}`, { token: bob.token, body: { role: 'viewer' } })).status, 403)
    const r = await call('PATCH', `/api/wb/lists/${list.id}/members/${bob.id}`, { token: alice.token, body: { role: 'editor' } })
    assert.equal(r.status, 200)
    const w = await call('PATCH', `/api/collections/items/records/${item.id}`, { token: bob.token, body: { where: 'Hallway' } })
    assert.equal(w.status, 200)
  })

  it("doesn't let editors change list membership or move items", async () => {
    const r = await call('PATCH', `/api/collections/lists/records/${list.id}`, { token: bob.token, body: { name: 'Mine' } })
    assert.notEqual(r.status, 200)
    const r2 = await call('PATCH', `/api/collections/lists/records/${list.id}`, { token: alice.token, body: { viewers: [eve.id] } })
    assert.notEqual(r2.status, 200)
    const other = await call('POST', '/api/collections/lists/records', { token: bob.token, body: { name: 'Bob stuff' } })
    const mv = await call('PATCH', `/api/collections/items/records/${item.id}`, { token: bob.token, body: { list: other.json.id } })
    assert.notEqual(mv.status, 200)
  })

  it('protects photos behind a file token', async () => {
    const form = new FormData()
    form.set('list', list.id)
    form.set('name', 'Spare keys')
    form.set('where', 'Key bowl')
    form.set('since', '2026-10-17 10:00:00.000Z')
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
    form.set('photo', new Blob([png], { type: 'image/png' }), 'spot.png')
    const r = await call('POST', '/api/collections/items/records', { token: alice.token, raw: form })
    assert.equal(r.status, 200, JSON.stringify(r.json))
    const url = `${API}/api/files/items/${r.json.id}/${r.json.photo}`
    assert.equal((await fetch(url)).status, 404, 'no access without a token')
    const ft = await call('POST', '/api/files/token', { token: eve.token })
    assert.equal((await fetch(`${url}?token=${ft.json.token}`)).status, 404, 'non-member token is refused')
    const ft2 = await call('POST', '/api/files/token', { token: bob.token })
    assert.equal((await fetch(`${url}?token=${ft2.json.token}`)).status, 200)
  })

  it('lets members leave, but not the owner', async () => {
    assert.equal((await call('DELETE', `/api/wb/lists/${list.id}/members/${alice.id}`, { token: alice.token })).status, 400)
    assert.equal((await call('DELETE', `/api/wb/lists/${list.id}/members/${bob.id}`, { token: bob.token })).status, 204)
    assert.equal((await call('GET', `/api/collections/lists/records/${list.id}`, { token: bob.token })).status, 404)
  })

  it('revokes invite links', async () => {
    const inv = await call('POST', `/api/wb/lists/${list.id}/invites`, { token: alice.token, body: { role: 'editor' } })
    assert.equal((await call('DELETE', `/api/wb/lists/${list.id}/invites`, { token: alice.token })).status, 200)
    assert.equal((await call('GET', `/api/wb/invites/${inv.json.token}`)).status, 404)
  })
})

describe('GDPR', () => {
  it('exports the account and its lists', async () => {
    const a = await signIn('alice@test.local')
    const r = await call('GET', '/api/wb/me/export', { token: a.token })
    assert.equal(r.status, 200)
    assert.equal(r.json.account.email, 'alice@test.local')
    assert.ok(r.json.lists.some((l) => l.name === 'Home' && l.role === 'owner'))
  })

  it("deletes an account with its own lists, keeps others' lists intact", async () => {
    const carol = await signIn('carol@test.local', { name: 'Carol' })
    const dave = await signIn('dave@test.local', { name: 'Dave' })
    const own = (await call('POST', '/api/collections/lists/records', { token: carol.token, body: { name: 'Carol home' } })).json
    await call('POST', '/api/collections/items/records', { token: carol.token, body: { list: own.id, name: 'Ring', where: 'Box', since: '2026-10-17 10:00:00.000Z' } })
    const daves = (await call('POST', '/api/collections/lists/records', { token: dave.token, body: { name: 'Dave home' } })).json
    const inv = await call('POST', `/api/wb/lists/${daves.id}/invites`, { token: dave.token, body: { role: 'editor' } })
    await call('POST', `/api/wb/invites/${inv.json.token}/accept`, { token: carol.token })
    const shared = (await call('POST', '/api/collections/items/records', { token: carol.token, body: { list: daves.id, name: 'Torch', where: 'Shed', since: '2026-10-17 10:00:00.000Z' } })).json

    assert.equal((await call('DELETE', '/api/wb/me', { token: carol.token, body: {} })).status, 400, 'needs explicit confirmation')
    assert.equal((await call('DELETE', '/api/wb/me', { token: carol.token, body: { confirm: true } })).status, 204)

    const admin = (await call('POST', '/api/collections/_superusers/auth-with-password', { body: { identity: ADMIN.email, password: ADMIN.password } })).json.token
    assert.equal((await call('GET', `/api/collections/users/records/${carol.id}`, { token: admin })).status, 404)
    assert.equal((await call('GET', `/api/collections/lists/records/${own.id}`, { token: admin })).status, 404)
    assert.equal((await call('GET', `/api/collections/items/records?filter=${encodeURIComponent(`list="${own.id}"`)}`, { token: admin })).json.totalItems, 0)
    const keptList = (await call('GET', `/api/collections/lists/records/${daves.id}`, { token: dave.token })).json
    assert.deepEqual(keptList.editors, [dave.id])
    const keptItem = (await call('GET', `/api/collections/items/records/${shared.id}`, { token: dave.token })).json
    assert.equal(keptItem.name, 'Torch')
    assert.equal(keptItem.createdBy, '')
  })

  it('lets a superuser delete an account on request, and nobody else', async () => {
    const zoe = await signIn('zoe@test.local')
    assert.equal((await call('DELETE', `/api/wb/admin/users/${zoe.id}`, { token: zoe.token })).status, 403)
    const admin = await adminToken()
    assert.equal((await call('DELETE', `/api/wb/admin/users/${zoe.id}`, { token: admin })).status, 204)
    assert.equal((await call('GET', `/api/collections/users/records/${zoe.id}`, { token: admin })).status, 404)
  })

  it('removes unconfirmed sign-ups and expired invites in the daily cleanup', async () => {
    const admin = (await call('POST', '/api/collections/_superusers/auth-with-password', { body: { identity: ADMIN.email, password: ADMIN.password } })).json.token
    const r = await call('POST', '/api/wb/admin/cleanup', { token: admin })
    assert.equal(r.status, 200)
    assert.equal(typeof r.json.unverified, 'number')
    assert.equal((await call('POST', '/api/wb/admin/cleanup', { token: (await signIn('cleanup@test.local')).token })).status, 403)
  })

  it('does not store IP addresses in request logs', async () => {
    const admin = (await call('POST', '/api/collections/_superusers/auth-with-password', { body: { identity: ADMIN.email, password: ADMIN.password } })).json.token
    const settings = (await call('GET', '/api/settings', { token: admin })).json
    assert.equal(settings.logs.logIP, false)
    assert.equal(settings.logs.logAuthId, false)
  })

  it('rate-limits code requests', async () => {
    await call('PATCH', '/api/settings', { token: await adminToken(), body: { rateLimits: productionLimits } })
    const codes = []
    for (let i = 0; i < 5; i++) codes.push((await call('POST', '/api/collections/users/request-otp', { body: { email: 'spam@test.local' } })).status)
    assert.ok(codes.includes(429), `got ${codes}`)
  })
})
