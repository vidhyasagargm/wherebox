// Shared setup for the end-to-end tests. Everything runs like production:
// the built app served by nginx with the real nginx.conf (so the API allowlist,
// security headers and service worker are part of every test), a real PocketBase
// with a throwaway database, and a tiny SMTP server that catches sign-in codes.
//
//   npm run test:e2e                     Chromium
//   E2E_BROWSER=webkit npm run test:e2e  Safari's engine, as an iPhone
//
// Needs: the PocketBase binary in backend/.bin, nginx on the PATH, and the browsers
// (`npx playwright install chromium webkit`; CHROME_PATH may point at an installed Chrome).
import { execFileSync, spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { chromium, devices, webkit } from 'playwright'

const REPO = resolve(import.meta.dirname, '..')
const PB = process.env.PB_BIN ?? join(REPO, 'backend/.bin/pocketbase')
export const ADMIN = { email: 'admin@test.local', password: 'test-only-password-123' }
export const BROWSER = process.env.E2E_BROWSER === 'webkit' ? 'webkit' : 'chromium'

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

// The production build, made once per test file.
let built = false
function buildApp() {
  if (built || process.env.E2E_SKIP_BUILD) return
  execFileSync('npx', ['vite', 'build', '--logLevel', 'error'], { cwd: REPO, stdio: 'inherit' })
  built = true
}

// The real nginx.conf, adjusted only for paths, ports and the backend address.
function startNginx(dir, port, pbPort) {
  const site = readFileSync(join(REPO, 'nginx.conf'), 'utf8')
    .replace('listen 8080;', `listen 127.0.0.1:${port};`)
    .replace('root /usr/share/nginx/html;', `root ${join(REPO, 'dist')};`)
    .replace(/resolver [^;]+;/, '')
    .replace('http://pocketbase:8090', `http://127.0.0.1:${pbPort}`)
    .replace('/dev/stdout', join(dir, 'access.log'))
    .replace('/dev/stderr', join(dir, 'error.log'))
  mkdirSync(join(dir, 'tmp'), { recursive: true })
  const conf = join(dir, 'nginx.conf')
  writeFileSync(
    conf,
    `pid ${join(dir, 'nginx.pid')};
error_log ${join(dir, 'nginx-error.log')};
daemon off;
events {}
http {
  types { text/html html; text/css css; application/javascript js mjs; application/json json; application/manifest+json webmanifest; image/svg+xml svg; image/png png; image/x-icon ico; font/woff2 woff2; }
  default_type application/octet-stream;
  client_body_temp_path ${dir}/tmp; proxy_temp_path ${dir}/tmp; fastcgi_temp_path ${dir}/tmp; uwsgi_temp_path ${dir}/tmp; scgi_temp_path ${dir}/tmp;
${site}
}
`,
  )
  // -e: don't touch the system's default error log (not writable without root on Linux).
  const flags = ['-e', join(dir, 'nginx-error.log'), '-c', conf, '-p', dir]
  execFileSync('nginx', ['-t', '-q', ...flags], { stdio: 'inherit' })
  return spawn('nginx', flags, { stdio: 'ignore' })
}

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

export async function startStack({ pbPort = 8090, webPort = 5180, smtpPort = 2526 } = {}) {
  buildApp()
  const smtp = await smtpSink(smtpPort)
  const dir = mkdtempSync(join(tmpdir(), 'wb-e2e-'))
  const args = ['--dir', join(dir, 'pb_data'), '--migrationsDir', join(REPO, 'backend/pb_migrations'), '--hooksDir', join(REPO, 'backend/pb_hooks')]
  execFileSync(PB, ['migrate', 'up', ...args], { stdio: 'pipe' })
  execFileSync(PB, ['superuser', 'upsert', ADMIN.email, ADMIN.password, ...args], { stdio: 'pipe' })
  const pb = spawn(PB, ['serve', '--http', `127.0.0.1:${pbPort}`, ...args], {
    // The suite signs the same people in many times; the per-address limit has its own test.
    env: { ...process.env, SMTP_HOST: '127.0.0.1', SMTP_PORT: String(smtpPort), SMTP_FROM: 'noreply@test.local', WB_TEST_NO_ADDRESS_LIMIT: 'true' },
    stdio: 'ignore',
  })
  const API = `http://127.0.0.1:${pbPort}`
  const BASE = `http://localhost:${webPort}`
  await wait(async () => (await fetch(API + '/api/health')).ok)
  const nginx = startNginx(dir, webPort, pbPort)
  await wait(async () => (await fetch(BASE + '/')).ok)

  const browser =
    BROWSER === 'webkit' ? await webkit.launch() : await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {})
  const phone = BROWSER === 'webkit' ? devices['iPhone 15'] : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }
  const all = []

  // A simulated phone. Errors are collected, except ones a test causes on purpose.
  // `settings: null` starts like a first visit; `init` runs in the page before the app (e.g. to mock APIs).
  async function device({ ignore = [], settings = { onboarded: true, lang: 'en', installDismissedUntil: 9e15 }, init, initArg, context = {}, ready = '#q' } = {}) {
    const ctx = await browser.newContext({ ...phone, acceptDownloads: true, ...context })
    await ctx.addInitScript((s) => {
      if (s && !localStorage.getItem('wherebox.settings')) localStorage.setItem('wherebox.settings', JSON.stringify(s))
    }, settings)
    if (init) await ctx.addInitScript(init, initArg)
    // Report uncaught promise errors with their stack, so a failure says where it came from.
    await ctx.addInitScript(() =>
      addEventListener('unhandledrejection', (e) => console.error('UNHANDLED ' + (e.reason?.stack || e.reason?.message || e.reason))),
    )
    const p = await ctx.newPage()
    const errors = []
    // Requests failing while a test is deliberately offline are expected (Chromium and WebKit word it differently).
    const offline = [/ERR_INTERNET_DISCONNECTED/, /network connection was lost/i, /Could not connect/i, /due to access control checks/, /WebKit encountered an internal error/]
    const expected = (text) => [...offline, ...ignore].some((re) => re.test(text))
    // WebKit reports a request failing while offline as a page error; real exceptions still count.
    p.on('pageerror', (e) => !expected(e.message) && errors.push(e.message))
    p.on('console', (m) => m.text().startsWith('UNHANDLED ') && errors.push(m.text().slice(0, 600)))
    p.on('console', (m) => m.type() === 'error' && !expected(m.text()) && errors.push(m.text()))
    await p.goto(BASE + '/')
    if (settings?.onboarded && ready) await p.waitForSelector(ready)
    const d = { ctx, p, errors }
    all.push(d)
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

  // A realistic phone photo (4032×3024 JPEG).
  const jpegFile = async () => {
    const f = join(dir, 'photo.jpg')
    const { default: sharp } = await import('sharp')
    await sharp({ create: { width: 4032, height: 3024, channels: 3, background: '#a86' } }).jpeg({ quality: 90 }).toFile(f)
    return f
  }

  // Saves a file the app hands to the user: a download on desktop, the share sheet on phones.
  async function savedFile(p, click, target) {
    await p.evaluate(() => {
      window.__shared = null
      navigator.canShare = () => true
      navigator.share = async (data) => {
        window.__shared = await data.files[0].text()
      }
    })
    const download = p.waitForEvent('download', { timeout: 15000 }).catch(() => null)
    await click()
    const shared = await wait(() => p.evaluate(() => window.__shared), 15000).catch(() => null)
    if (shared) writeFileSync(target, shared)
    else await (await download).saveAs(target)
    return target
  }

  async function close() {
    await browser.close()
    pb.kill()
    nginx.kill()
    smtp.close()
    rmSync(dir, { recursive: true, force: true })
  }

  return { BASE, mail: smtp.mail, device, devices: all, say, titles, signIn, api, adminToken, jpegFile, savedFile, dir, close }
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
