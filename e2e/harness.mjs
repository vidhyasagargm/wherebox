// Shared setup for the end-to-end tests: a real PocketBase with a throwaway
// database, a tiny SMTP server that catches sign-in codes, the Vite dev server,
// and simulated phones (browser contexts) that talk to them.
//
//   npm run test:e2e
//
// Needs the PocketBase binary in backend/.bin and a Chromium: either
// `npx playwright install chromium`, or CHROME_PATH pointing at an installed one.
import { execFileSync, spawn } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright'

const REPO = resolve(import.meta.dirname, '..')
const PB = process.env.PB_BIN ?? join(REPO, 'backend/.bin/pocketbase')
export const ADMIN = { email: 'admin@test.local', password: 'test-only-password-123' }

const wait = async (fn, ms = 10000) => {
  const end = Date.now() + ms
  for (;;) {
    try {
      const v = await fn()
      if (v) return v
    } catch {}
    if (Date.now() > end) throw new Error('timed out')
    await new Promise((r) => setTimeout(r, 150))
  }
}
export const eventually = (fn, ms = 8000) => wait(fn, ms).catch(() => false)

function smtpSink(port) {
  const mail = new Map()
  const server = createServer((s) => {
    let data = false
    let buf = ''
    let rcpt = ''
    s.write('220 sink\r\n')
    s.on('data', (c) => {
      buf += c
      let i
      while ((i = buf.indexOf('\r\n')) >= 0) {
        const line = buf.slice(0, i)
        buf = buf.slice(i + 2)
        if (data) {
          if (line === '.') {
            data = false
            s.write('250 ok\r\n')
          } else mail.set(rcpt, (mail.get(rcpt) ?? '') + line + '\n')
          continue
        }
        const cmd = line.slice(0, 4).toUpperCase()
        if (cmd === 'RCPT') {
          rcpt = /<([^>]+)>/.exec(line)[1]
          mail.set(rcpt, '')
          s.write('250 ok\r\n')
        } else if (cmd === 'DATA') {
          data = true
          s.write('354 go\r\n')
        } else if (cmd === 'QUIT') s.end()
        else s.write('250 ok\r\n')
      }
    })
  })
  return new Promise((r) => server.listen(port, '127.0.0.1', () => r({ mail, close: () => server.close() })))
}

export async function startStack({ pbPort = 8090, vitePort = 5180, smtpPort = 2526 } = {}) {
  const smtp = await smtpSink(smtpPort)
  const dir = mkdtempSync(join(tmpdir(), 'wb-e2e-'))
  const args = ['--dir', join(dir, 'pb_data'), '--migrationsDir', join(REPO, 'backend/pb_migrations'), '--hooksDir', join(REPO, 'backend/pb_hooks')]
  execFileSync(PB, ['migrate', 'up', ...args], { stdio: 'pipe' })
  execFileSync(PB, ['superuser', 'upsert', ADMIN.email, ADMIN.password, ...args], { stdio: 'pipe' })
  const pb = spawn(PB, ['serve', '--http', `127.0.0.1:${pbPort}`, ...args], {
    env: { ...process.env, SMTP_HOST: '127.0.0.1', SMTP_PORT: String(smtpPort), SMTP_FROM: 'noreply@test.local', WB_TEST_NO_ADDRESS_LIMIT: 'true' },
    stdio: 'ignore',
  })
  const vite = spawn('npx', ['vite', '--port', String(vitePort), '--strictPort'], {
    cwd: REPO,
    env: { ...process.env, WB_API_TARGET: `http://127.0.0.1:${pbPort}` },
    stdio: 'ignore',
    detached: true,
  })
  const API = `http://127.0.0.1:${pbPort}`
  const BASE = `http://localhost:${vitePort}`
  await wait(async () => (await fetch(API + '/api/health')).ok)
  await wait(async () => (await fetch(BASE + '/')).ok, 30000)

  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {})
  const devices = []

  // A simulated phone. Errors are collected, except ones a test causes on purpose.
  async function device({ ignore = [] } = {}) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, acceptDownloads: true })
    await ctx.addInitScript(() => {
      if (!localStorage.getItem('wherebox.settings'))
        localStorage.setItem('wherebox.settings', JSON.stringify({ onboarded: true, lang: 'en', installDismissedUntil: 9e15 }))
    })
    const p = await ctx.newPage()
    const errors = []
    const expected = (text) => [/ERR_INTERNET_DISCONNECTED/, ...ignore].some((re) => re.test(text))
    p.on('pageerror', (e) => errors.push(e.message))
    p.on('console', (m) => m.type() === 'error' && !expected(m.text()) && errors.push(m.text()))
    await p.goto(BASE + '/')
    await p.waitForSelector('#q')
    const d = { ctx, p, errors }
    devices.push(d)
    return d
  }

  const say = async (p, text) => {
    await p.goto(BASE + '/#/')
    await p.fill('#q', text)
    await p.keyboard.press('Enter')
    await p.waitForTimeout(300)
  }
  const titles = (p) => p.locator('.row-title').allInnerTexts()

  // Signs in through the real flow: email, consent, code from the caught email.
  async function signIn(p, email, name) {
    if (!p.url().includes('#/signin')) {
      await p.goto(BASE + '/#/settings')
      await p.getByRole('link', { name: 'Sign in or create account' }).click()
    }
    await p.fill('#email', email)
    if (name) await p.fill('#name', name)
    await p.locator('.consent input').check()
    smtp.mail.delete(email)
    await p.getByRole('button', { name: 'Send code' }).click()
    const code = (await wait(() => smtp.mail.get(email)?.match(/\b(\d{6})\b/)))[1]
    await p.fill('#otp', code)
    await p.waitForTimeout(1200)
  }

  async function api(method, path, token, body) {
    const r = await fetch(API + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: token } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
    const text = await r.text()
    return { status: r.status, json: text ? JSON.parse(text) : null }
  }
  const adminToken = async () => (await api('POST', '/api/collections/_superusers/auth-with-password', null, { identity: ADMIN.email, password: ADMIN.password })).json.token

  const pngFile = () => {
    const f = join(dir, 'spot.png')
    writeFileSync(f, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'))
    return f
  }

  async function close() {
    await browser.close()
    pb.kill()
    try {
      process.kill(-vite.pid)
    } catch {}
    smtp.close()
    rmSync(dir, { recursive: true, force: true })
  }

  return { BASE, mail: smtp.mail, device, devices, say, titles, signIn, api, adminToken, pngFile, dir, close }
}

// Collects named checks so one run reports everything that failed, not just the first.
export function checks() {
  const results = []
  return {
    check: (name, ok, detail = '') => results.push({ name, ok: !!ok, detail }),
    report() {
      const failed = results.filter((r) => !r.ok)
      for (const r of results) console.log(`${r.ok ? '✔' : '✖'} ${r.name}${r.detail ? `  (${r.detail})` : ''}`)
      return failed
    },
  }
}
