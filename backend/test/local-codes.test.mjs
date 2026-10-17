// Local mode: without an email server, WB_LOG_SIGNIN_CODES=true prints sign-in codes in the log.
import { spawn, execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { after, before, it } from 'node:test'
import assert from 'node:assert/strict'

const ROOT = resolve(import.meta.dirname, '..')
const BIN = process.env.PB_BIN ?? join(ROOT, '.bin', 'pocketbase')
const PORT = 9000 + Math.floor(Math.random() * 900)
const API = `http://127.0.0.1:${PORT}`
let pb, dir, log = ''

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'wb-local-'))
  const args = ['--dir', join(dir, 'pb_data'), '--migrationsDir', join(ROOT, 'pb_migrations'), '--hooksDir', join(ROOT, 'pb_hooks')]
  execFileSync(BIN, ['migrate', 'up', ...args], { stdio: 'pipe' })
  pb = spawn(BIN, ['serve', '--http', `127.0.0.1:${PORT}`, ...args], { env: { ...process.env, WB_LOG_SIGNIN_CODES: 'true', SMTP_HOST: '' }, stdio: ['ignore', 'pipe', 'pipe'] })
  pb.stdout.on('data', (d) => (log += d))
  pb.stderr.on('data', (d) => (log += d))
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(API + '/api/health')).ok) return
    } catch {}
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error('PocketBase did not start')
})

after(() => {
  pb?.kill()
  if (dir) rmSync(dir, { recursive: true, force: true })
})

it('signs in with a code from the server log, no email server needed', async () => {
  assert.match(log, /WB_LOG_SIGNIN_CODES is on/)
  const req = await (await fetch(API + '/api/collections/users/request-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'home@lan.local', consent: true, consentVersion: '2026-10-17' }),
  })).json()
  let code
  for (let i = 0; i < 50 && !code; i++) {
    code = /sign-in code for home@lan\.local: (\d{6})/.exec(log)?.[1]
    if (!code) await new Promise((r) => setTimeout(r, 100))
  }
  assert.ok(code, 'code printed in the log')
  const auth = await fetch(API + '/api/collections/users/auth-with-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ otpId: req.otpId, password: code }),
  })
  assert.equal(auth.status, 200)
})
