// Every screen and feature of the app without an account: onboarding, saving and asking,
// answers, matches, not found, unclear sentences, item details and photos, places,
// voice input and read-aloud (with a simulated microphone and voice), settings, backups,
// German, dark mode, offline use, install hints, deep links, storage blocked, desktop layout,
// and basic accessibility on every screen.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { BROWSER, checks, eventually, startStack } from './harness.mjs'

// A scripted microphone, voice and clipboard. Tests queue what the "user says" in window.__speech.
function mocks() {
  window.__said = []
  window.__speech = []
  window.__copied = null
  const synth = { speaking: false, speak: (u) => u.text && window.__said.push(u.text), cancel() {}, getVoices: () => [], addEventListener() {} }
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true })
  if (!window.SpeechSynthesisUtterance)
    window.SpeechSynthesisUtterance = class {
      constructor(text) {
        this.text = text
      }
    }
  class FakeRecognition {
    start() {
      this.onstart?.()
      const next = window.__speech.shift() ?? { error: 'no-speech' }
      setTimeout(() => {
        if (next.error) {
          this.onerror?.({ error: next.error })
          this.onend?.()
          return
        }
        const result = [{ transcript: next.text }]
        result.isFinal = true
        this.onresult?.({ resultIndex: 0, results: [result] })
        setTimeout(() => this.onend?.(), 50)
      }, 250)
    }
    stop() {}
    abort() {}
  }
  window.SpeechRecognition = window.webkitSpeechRecognition = FakeRecognition
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t) => (window.__copied = t) }, configurable: true })
}

// Every button and link on screen has a name a screen reader can announce, and there's one main heading.
async function accessible(p) {
  return p.evaluate(() => {
    const unnamed = [...document.querySelectorAll('button, a[href], input:not([type=hidden]):not(.sr), textarea')]
      .filter((el) => el.offsetParent !== null)
      .filter((el) => {
        const label = el.getAttribute('aria-label') || el.textContent.trim() || (el.id && document.querySelector(`label[for="${el.id}"]`)?.textContent.trim()) || el.closest('label')?.textContent.trim()
        return !label
      })
      .map((el) => el.outerHTML.slice(0, 80))
    const h1 = document.querySelectorAll('h1').length
    return { unnamed, h1 }
  })
}

test('every section of the app', { timeout: 420_000 }, async () => {
  const s = await startStack()
  const { check, report } = checks()
  try {
    const { BASE, say, titles } = s
    const toast = (p) => p.locator('.toast').innerText().catch(() => '')
    const a11y = []
    const look = async (p, screen) => {
      const r = await accessible(p)
      if (r.unnamed.length || r.h1 !== 1) a11y.push(`${screen}: ${r.h1} h1, unnamed: ${r.unnamed.join(' ')}`)
    }

    // --- First visit: onboarding ---
    const d = await s.device({ settings: null, init: mocks })
    const p = d.p
    await p.waitForSelector('text=Step 1 of 3')
    check('first visit shows the introduction', await p.getByText('Tell it where you put things.').count())
    await look(p, 'onboarding')
    await p.getByRole('button', { name: 'Next' }).click()
    check('step 2 explains speaking or typing', await p.getByText('Speak or type.').count())
    await p.getByRole('button', { name: 'Next' }).click()
    check('step 3 explains the data stays on the phone', await p.getByText('It stays on your phone.').count())
    if (BROWSER === 'webkit') check('iPhone gets the home-screen warning', await p.getByText(/Safari can delete your list/).count())
    await p.getByRole('button', { name: /Start/ }).click()
    await p.waitForSelector('#q')

    // --- Empty state and the example ---
    check('empty state invites a first save', await p.getByText('Nothing saved yet').count())
    if (BROWSER === 'webkit') {
      check('install card explains Add to Home Screen on iPhone', await p.getByText(/Add to Home Screen/).count())
      await p.getByRole('button', { name: 'Not now' }).click()
      check('install card can be dismissed', !(await p.getByText(/Add to Home Screen/).count()))
    }
    await look(p, 'home (empty)')
    await p.getByRole('button', { name: /I put the passport in the bedroom drawer/ }).click()
    await p.waitForTimeout(400)
    check('the example saves', (await titles(p)).includes('Passport'))
    check('saving shows a confirmation with undo and edit', /Saved[\s\S]*Passport → Bedroom drawer/.test(await toast(p)) && (await p.getByRole('button', { name: 'Undo' }).count()) && (await p.getByRole('button', { name: 'Edit' }).count()))
    await p.getByRole('button', { name: 'Undo' }).click()
    await p.waitForTimeout(300)
    check('undo removes it again', !(await titles(p)).includes('Passport'))

    // --- Saving in different words ---
    for (const sentence of [
      'I put the passport in the bedroom drawer',
      'spare keys are in the hallway key bowl',
      'I left my laptop charger on the living room sofa table',
      'phone charger is on the bedroom nightstand',
      'camera charger in the study desk drawer',
      'The winter jackets are in the bedroom wardrobe',
      'Christmas lights in the attic red box',
      'I hid the birth certificate under the mattress',
      'drill on the garage top shelf',
    ])
      await say(p, sentence)
    const saved = await titles(p)
    check('recently saved shows the newest first', saved[0] === 'Drill', saved.slice(0, 3).join(','))
    await say(p, 'Moved the drill to the garage workbench')
    check('moving says Moved', /Moved/.test(await toast(p)))
    await p.getByRole('button', { name: 'Edit' }).click()
    await p.waitForTimeout(300)
    check('edit opens the form with the saved values', (await p.inputValue('#what')) === 'Drill' && (await p.inputValue('#where')) === 'Garage workbench')
    await look(p, 'edit form')
    await p.fill('#where', 'Garage workbench drawer')
    await p.getByRole('button', { name: 'Save' }).click()
    await p.waitForTimeout(300)
    check('editing changes the place', (await p.locator('.row-sub').first().innerText()) === 'Garage workbench drawer')

    // --- Asking ---
    await say(p, 'Where is my passport?')
    check('answer shows the place', (await p.locator('h1').first().innerText()) === 'Bedroom drawer')
    check('answer reads naturally', (await p.getByText('Your passport is in the').count()) > 0)
    await look(p, 'answer')
    await p.getByRole('button', { name: /Found it/i }).click()
    await p.waitForTimeout(300)
    check('found it says so and goes home', /Glad you found it/.test(await toast(p)) && (await p.locator('#q').count()))
    await say(p, 'where are the spare keys')
    await p.getByRole('link', { name: 'I moved it' }).click()
    await p.waitForTimeout(300)
    check('"I moved it" asks only for the new place', (await p.inputValue('#what')) === 'Spare keys' && (await p.evaluate(() => document.activeElement?.id)) === 'where')
    await p.fill('#where', 'Coat pocket')
    await p.getByRole('button', { name: 'Save' }).click()
    await p.waitForTimeout(300)
    await say(p, 'where are the spare keys')
    await p.getByRole('link', { name: 'Where was it before?' }).click()
    await p.waitForTimeout(300)
    check('history shows the old place', (await p.locator('.history li').allInnerTexts()).some((x) => x.includes('Hallway key bowl')))

    // --- Several matches, not found, did you mean, unclear ---
    await say(p, "Where's the charger?")
    check('several chargers: asks which one', (await p.getByText('Which charger?').count()) && (await p.locator('.match').count()) === 3)
    await look(p, 'matches')
    await p.locator('.match').filter({ hasText: 'Phone charger' }).click()
    await p.waitForTimeout(300)
    check('picking one shows its answer', (await p.locator('h1').first().innerText()) === 'Bedroom nightstand')
    await say(p, 'Where is my umbrella?')
    check('nothing found says so', await p.getByText('No “Umbrella” saved yet.').count())
    await look(p, 'not found')
    await p.getByRole('link', { name: /Save where it is/i }).click()
    await p.waitForTimeout(300)
    check('"save where it is" prefills the thing', (await p.inputValue('#what')) === 'Umbrella')
    await p.fill('#where', 'Hallway stand')
    await p.getByRole('button', { name: 'Save' }).click()
    await p.waitForTimeout(300)
    check('…and saves it', (await titles(p)).includes('Umbrella'))
    await say(p, 'Where are the passport photos?')
    check('did you mean offers close names', (await p.locator('.suggest .row-title').allInnerTexts()).includes('Passport'))
    await say(p, 'garage shelf hammer blue box')
    check('an unclear sentence asks what and where, prefilled', (await p.inputValue('#what')) === 'Hammer' && (await p.inputValue('#where')) === 'Garage shelf, blue box')
    await p.getByRole('button', { name: 'Save' }).click()
    await p.waitForTimeout(300)
    check('…and saves', (await titles(p)).includes('Hammer'))

    // --- Item detail: note, photo, delete ---
    await p.goto(BASE + '/#/')
    await p.locator('.row-title', { hasText: 'Passport' }).click()
    await p.waitForTimeout(300)
    await look(p, 'item detail')
    await p.fill('#note', 'Under the blue folder')
    await p.locator('h1').click()
    await p.waitForTimeout(300)
    await p.reload()
    await p.waitForSelector('#note')
    check('a note is kept', (await p.inputValue('#note')) === 'Under the blue folder')
    await p.locator('input[type=file]').setInputFiles(await s.jpegFile())
    check('a full-size phone photo is added and shown', await eventually(async () => (await p.locator('main img').count()) > 0, 6000))
    await p.reload()
    check('…and still there after reopening', await eventually(async () => (await p.locator('main img').count()) > 0, 4000))
    await say(p, 'Where is my passport?')
    check('the answer shows the photo and note', (await p.locator('main img').count()) > 0 && (await p.getByText('Under the blue folder').count()) > 0)
    await p.goto(BASE + '/#/')
    await p.locator('.row-title', { hasText: 'Passport' }).click()
    await p.getByRole('button', { name: 'Remove photo' }).click()
    await p.waitForTimeout(300)
    check('the photo can be removed', (await p.locator('main img').count()) === 0)
    await p.goto(BASE + '/#/')
    await p.locator('.row-title', { hasText: 'Hammer' }).click()
    p.once('dialog', (dlg) => dlg.accept())
    await p.getByRole('button', { name: 'Delete this item' }).click()
    await p.waitForTimeout(300)
    check('an item can be deleted', !(await titles(p)).includes('Hammer') && /Deleted/.test(await toast(p)))

    // --- Places ---
    await p.goto(BASE + '/#/places')
    await p.waitForTimeout(300)
    await look(p, 'places')
    const rooms = await p.locator('.room-name').allInnerTexts()
    check('places are grouped into rooms', ['Bedroom', 'Garage', 'Attic'].every((r) => rooms.includes(r)), rooms.join(','))
    await p.getByRole('button', { name: /^Garage/ }).click()
    check('a room opens to show its spots', (await p.locator('.spot').allInnerTexts()).some((x) => /workbench/i.test(x)))
    await p.getByRole('button', { name: 'Edit' }).click()
    await p.locator('.room', { hasText: 'Bedroom' }).getByRole('button', { name: 'Rename' }).click()
    await p.fill('#rename', 'Master bedroom')
    await p.getByRole('button', { name: 'Save' }).click()
    await p.waitForTimeout(400)
    check('renaming a room renames it everywhere', (await p.locator('.room-name').allInnerTexts()).includes('Master bedroom'))
    await say(p, 'Where is my passport?')
    check('…including in answers', /Master bedroom/i.test(await p.locator('h1').first().innerText()))
    await p.goto(BASE + '/#/places')
    await p.getByRole('button', { name: 'Edit' }).click()
    p.once('dialog', (dlg) => dlg.accept())
    await p.locator('.room', { hasText: 'Attic' }).getByRole('button', { name: 'Delete place' }).click()
    await p.waitForTimeout(400)
    check('deleting a place removes what was in it', !(await p.locator('.room-name').allInnerTexts()).includes('Attic'))

    // --- Voice and reading aloud ---
    await p.goto(BASE + '/#/')
    await p.evaluate(() => window.__speech.push({ text: 'I put the torch in the kitchen drawer' }))
    await p.getByRole('button', { name: /Tap to speak/i }).click()
    check('first use explains where the voice goes', await p.getByText('Before you speak').count())
    await look(p, 'voice notice')
    await p.getByRole('button', { name: /OK, start speaking/i }).click()
    check('listening shows what was said', await eventually(async () => (await p.locator('h1').first().innerText()).includes('torch'), 4000))
    check('a spoken sentence is saved', await eventually(async () => (await titles(p)).includes('Torch'), 4000))
    check('…and confirmed out loud', await eventually(async () => (await p.evaluate(() => window.__said)).some((t) => /Saved\. Torch/.test(t)), 3000))
    await p.evaluate(() => window.__speech.push({ text: 'Where is my passport' }))
    await p.getByRole('button', { name: /Tap to speak/i }).click()
    check('a spoken question is answered out loud', await eventually(async () => (await p.evaluate(() => window.__said)).some((t) => /Your passport is in the/i.test(t)), 5000))
    await p.getByRole('button', { name: 'Say it again' }).click()
    check('"say it again" repeats the answer', (await p.evaluate(() => window.__said.filter((t) => /Your passport/i.test(t)).length)) >= 2)
    await p.goto(BASE + '/#/')
    await p.evaluate(() => window.__speech.push({ error: 'no-speech' }))
    await p.getByRole('button', { name: /Tap to speak/i }).click()
    check("silence says it didn't hear", await eventually(async () => (await p.getByText("Sorry, I didn't hear that.").count()) > 0, 3000))
    await look(p, 'voice error')
    await p.evaluate(() => window.__speech.push({ error: 'not-allowed' }))
    await p.getByRole('button', { name: /Try again/i }).click()
    check('a blocked microphone is explained', await eventually(async () => (await p.getByText('Wherebox may not use the microphone.').count()) > 0, 3000))
    await p.getByRole('button', { name: 'Type it instead' }).click()
    check('"type it instead" goes back to typing', await eventually(async () => (await p.locator('#q').count()) > 0, 2000))
    // Right after "type it instead" the app expects keyboard dictation and may read the answer; after that, typing is quiet.
    await say(p, 'Where is my passport?')
    await p.evaluate(() => (window.__said = []))
    await say(p, 'Where is my passport?')
    check('typed questions stay quiet by default', (await p.evaluate(() => window.__said.length)) === 0)

    // --- Settings ---
    await p.goto(BASE + '/#/settings')
    await p.waitForTimeout(300)
    await look(p, 'settings')
    check('with a backend, sync and sharing is offered', (await p.getByText('Sync and share').count()) > 0)
    const noBackend = await s.device({ init: mocks, ignore: [/502/] })
    await noBackend.p.route('**/api/health', (r) => r.fulfill({ status: 502, body: '' }))
    await noBackend.p.reload()
    await noBackend.p.goto(BASE + '/#/settings')
    await noBackend.p.waitForTimeout(600)
    check('without a backend, account features are hidden', (await noBackend.p.getByText('Sync and share').count()) === 0)
    await p.getByRole('button', { name: 'Always' }).click()
    await say(p, 'Where is my passport?')
    check('"read answers aloud: always" also reads typed answers', await eventually(async () => (await p.evaluate(() => window.__said.length)) > 0, 3000))
    await p.goto(BASE + '/#/settings')
    await p.getByRole('button', { name: 'After I speak' }).click()
    await p.getByRole('button', { name: 'Dark' }).click()
    check('dark mode', (await p.evaluate(() => document.documentElement.dataset.theme)) === 'dark')
    await p.getByRole('button', { name: 'Light' }).click()
    check('light mode', (await p.evaluate(() => document.documentElement.dataset.theme)) === 'light')
    await p.getByRole('button', { name: 'Copy link' }).click()
    check('quick start link is copied', /#\/listen$/.test(await p.evaluate(() => window.__copied)))
    await p.getByText('How to set it up').click()
    check('quick start explains the setup', (await p.locator('details ol li').count()) >= 3)
    check('about links to the code and coffee', (await p.getByRole('link', { name: 'See the code' }).getAttribute('href'))?.includes('github.com') && (await p.getByRole('link', { name: 'Buy me a coffee' }).getAttribute('href'))?.includes('buymeacoffee.com'))
    await p.getByRole('link', { name: 'Privacy' }).click()
    check('privacy notice opens', (await p.locator('h1').innerText()) === 'Privacy')
    await look(p, 'privacy')
    await p.goto(BASE + '/#/terms')
    check('terms open', (await p.locator('h1').innerText()) === 'Terms of use')

    // --- German ---
    await p.goto(BASE + '/#/settings')
    await p.getByRole('button', { name: 'Deutsch' }).click()
    await p.goto(BASE + '/#/')
    check('German interface', (await p.locator('h1').innerText()) === 'Wo hast du es hingelegt?')
    await say(p, 'Ich habe den Reisepass in die Schublade im Schlafzimmer gelegt')
    check('German sentences save', (await titles(p)).includes('Reisepass') && /Gespeichert/.test(await toast(p)))
    await say(p, 'Wo ist mein Reisepass?')
    check('German questions are answered', (await p.locator('h1').first().innerText()) === 'Schublade im Schlafzimmer')
    await p.goto(BASE + '/#/settings')
    await p.getByRole('button', { name: 'English' }).click()

    // --- Backup: export, then restore on a fresh phone ---
    await p.goto(BASE + '/#/settings')
    const backup = await s.savedFile(p, () => p.getByRole('button', { name: /Export backup/i }).click(), join(s.dir, 'backup.json'))
    const data = JSON.parse(readFileSync(backup, 'utf8'))
    const countItems = (page) =>
      page.evaluate(
        () =>
          new Promise((res) => {
            const r = indexedDB.open('wherebox')
            r.onsuccess = () => {
              const q = r.result.transaction('items').objectStore('items').getAll()
              q.onsuccess = () => res(q.result.filter((i) => !i.deleted).length)
            }
          }),
      )
    check('backup contains everything', data.app === 'wherebox' && data.items.length === (await countItems(p)), `${data.items.length} items`)
    check('backup shows the date', await (async () => (await p.goto(BASE + '/#/settings'), !(await p.getByText('Never').count())))())
    const fresh = await s.device({ init: mocks })
    await fresh.p.goto(BASE + '/#/settings')
    fresh.p.once('dialog', (dlg) => dlg.accept())
    await fresh.p.locator('input[type=file]').setInputFiles(backup)
    await fresh.p.waitForTimeout(800)
    await fresh.p.goto(BASE + '/#/')
    check('a backup restores on another phone', (await countItems(fresh.p)) === data.items.length)

    // --- Backup reminder ---
    await fresh.p.evaluate(
      () =>
        new Promise((res) => {
          const r = indexedDB.open('wherebox')
          r.onsuccess = () => {
            const store = r.result.transaction('items', 'readwrite').objectStore('items')
            const all = store.getAll()
            all.onsuccess = () => {
              for (const i of all.result) store.put({ ...i, createdAt: Date.now() - 10 * 86400000 })
              store.transaction.oncomplete = res
            }
          }
        }),
    )
    await fresh.p.reload()
    await fresh.p.waitForSelector('#q')
    check('a gentle backup reminder appears', await eventually(async () => (await fresh.p.getByText('No backup yet.').count()) > 0, 3000))
    await fresh.p.getByRole('button', { name: 'Remind me later' }).click()
    check('…and can be snoozed', (await fresh.p.getByText('No backup yet.').count()) === 0)

    // --- Deep link straight into listening ---
    await fresh.p.evaluate(() => window.__speech.push({ error: 'no-speech' }))
    await fresh.p.goto(BASE + '/#/listen')
    check('the quick start link opens listening', await eventually(async () => (await fresh.p.getByText(/Before you speak|Listening|didn't hear/).count()) > 0, 3000))

    // --- Offline ---
    await p.goto(BASE + '/')
    await p.waitForTimeout(1500)
    const controlled = await p.evaluate(() => !!navigator.serviceWorker?.controller)
    await d.ctx.setOffline(true)
    await p.reload().catch(() => {})
    check('the app opens without internet', await eventually(async () => (await p.locator('#q').count()) > 0, 5000), `service worker: ${controlled}`)
    await say(p, 'I put the batteries in the kitchen drawer')
    check('saving works offline', (await titles(p)).includes('Batteries'))
    await d.ctx.setOffline(false)

    // --- Storage blocked ---
    const blocked = await s.device({
      ready: null,
      settings: { onboarded: true, lang: 'en' },
      // As in Safari with website data turned off: opening the database fails.
      init: () => {
        indexedDB.open = () => {
          const req = {}
          setTimeout(() => {
            req.error = new DOMException('blocked', 'InvalidStateError')
            req.onerror?.({ target: req, preventDefault() {}, stopPropagation() {} })
          })
          return req
        }
      },
    })
    check('blocked storage explains itself', await eventually(async () => (await blocked.p.getByText('Wherebox can’t save anything here.').count()) > 0, 4000))

    // --- Desktop layout (wide screen) ---
    if (BROWSER === 'chromium') {
      const wide = await s.device({ init: mocks, context: { viewport: { width: 1280, height: 820 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false } })
      await say(wide.p, 'I put the passport in the bedroom drawer')
      await say(wide.p, 'Where is my passport?')
      check('desktop shows home and the answer side by side', (await wide.p.locator('.split .left #q').count()) === 1 && (await wide.p.locator('.split .right h1').innerText()) === 'Bedroom drawer')
      await wide.p.locator('body').press('/')
      check('"/" jumps to the input on desktop', (await wide.p.evaluate(() => document.activeElement?.id)) === 'q')
    }

    check('every screen is screen-reader friendly', a11y.length === 0, a11y.join(' || '))
    check('no page errors', !s.devices.some((x) => x.errors.length), s.devices.flatMap((x) => x.errors).slice(0, 3).join(' | '))
  } catch (e) {
    // Report what passed before the step that got stuck.
    check('the suite ran to the end', false, String(e.message).split('\n')[0])
  } finally {
    await s.close()
  }
  assert.deepEqual(report().map((f) => f.name), [])
})
