// Privacy and terms pages, downloading your data, agreeing again after a change,
// deleting an account (keeping a copy) and importing the download.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { checks, startStack } from './harness.mjs'

test('GDPR features', { timeout: 300_000 }, async () => {
  const s = await startStack()
  const { check, report } = checks()
  try {
    const { BASE, say, signIn, api } = s
    const admin = await s.adminToken()
    const userByEmail = async (email) => (await api('GET', '/api/collections/users/records?filter=' + encodeURIComponent(`email="${email}"`), admin)).json.items[0]

    const a = await s.device()
    await a.p.goto(BASE + '/#/signin')
    await a.p.waitForTimeout(300)
    check('sign-in links to terms and privacy', (await a.p.getByRole('link', { name: 'Terms of use' }).count()) === 1 && (await a.p.getByRole('link', { name: 'Read the privacy notice' }).count()) === 1)
    await a.p.getByRole('link', { name: 'Terms of use' }).click()
    await a.p.waitForTimeout(300)
    check('terms page shows its sections', (await a.p.locator('main h2').allInnerTexts()).includes('Liability'))
    await a.p.goto(BASE + '/#/privacy')
    await a.p.waitForTimeout(300)
    const headings = await a.p.locator('main h2').allInnerTexts()
    check('privacy notice covers accounts, email, retention and rights', ['With an account: what we store', 'Sign-in emails', 'How long we keep data', 'Your rights'].every((h) => headings.includes(h)))

    await signIn(a.p, 'anna@test.local', 'Anna')
    await say(a.p, 'I put the passport in the bedroom drawer')
    await a.p.goto(BASE + '/#/')
    await a.p.locator('.row-title', { hasText: 'Passport' }).click()
    await a.p.locator('input[type=file]').setInputFiles(s.pngFile())
    await a.p.waitForTimeout(2000)

    const o = await s.device()
    await signIn(o.p, 'otto@test.local', 'Otto')
    await say(o.p, 'drill in the garage')
    await o.p.waitForTimeout(1500)
    await o.p.goto(BASE + '/#/lists')
    await o.p.getByRole('listitem').filter({ hasText: 'Yours' }).getByRole('link').click()
    await o.p.waitForTimeout(400)
    await o.p.getByRole('button', { name: 'Create invite link' }).click()
    await o.p.waitForTimeout(400)
    const link = await o.p.locator('code').innerText()
    await a.p.goto(link.replace(/^https?:\/\/[^/]+/, BASE))
    await a.p.getByRole('button', { name: 'Join list' }).click()
    await a.p.waitForTimeout(1200)
    await say(a.p, 'torch in the shed')
    await a.p.waitForTimeout(1500)

    await a.p.goto(BASE + '/#/settings')
    await a.p.waitForTimeout(400)
    const [download] = await Promise.all([a.p.waitForEvent('download'), a.p.getByRole('button', { name: 'Download my data' }).click()])
    const file = join(s.dir, 'my-data.json')
    await download.saveAs(file)
    const data = JSON.parse(readFileSync(file, 'utf8'))
    check('export has account, lists and items', data.account.email === 'anna@test.local' && data.lists.length === 2 && data.items.length === 3)
    check('export includes the photo', data.items.some((i) => i.name === 'Passport' && String(i.photo).startsWith('data:image/')))
    check('export marks what you added', data.items.find((i) => i.name === 'Torch')?.addedByYou === true && data.items.find((i) => i.name === 'Drill')?.addedByYou === false)

    // Simulate a terms change: the account agreed to an older version.
    const anna = await userByEmail('anna@test.local')
    await api('PATCH', `/api/collections/users/records/${anna.id}`, admin, { consentVersion: '2025-01-01' })
    await a.p.reload()
    await a.p.waitForTimeout(2000)
    check('asks to agree again after a change', (await a.p.getByText('We updated our privacy notice and terms').count()) > 0)
    check('agree button waits for the checkbox', await a.p.getByRole('button', { name: 'I agree' }).isDisabled())
    await a.p.locator('.check input').check()
    await a.p.getByRole('button', { name: 'I agree' }).click()
    await a.p.waitForTimeout(800)
    check('app continues after agreeing', (await a.p.getByText('We updated our privacy notice and terms').count()) === 0)
    check('server records the new agreement', (await userByEmail('anna@test.local')).consentVersion === (await api('GET', '/api/wb/consent')).json.version)

    await a.p.goto(BASE + '/#/delete-account')
    await a.p.waitForTimeout(400)
    const text = await a.p.locator('main').innerText()
    check('delete screen lists own and shared lists', text.includes('Home') && text.includes('Otto'))
    a.p.once('dialog', (d) => d.accept())
    await a.p.getByRole('button', { name: 'Delete my account' }).click()
    await a.p.waitForTimeout(2500)
    check('account is gone on the server', (await api('GET', `/api/collections/users/records/${anna.id}`, admin)).status === 404)
    await a.p.goto(BASE + '/#/')
    await a.p.waitForTimeout(600)
    const kept = await a.p.locator('.row-title').allInnerTexts()
    check('a copy stays on the device', ['Passport', 'Torch', 'Drill'].every((n) => kept.includes(n)), kept.join(','))
    check('signed out afterwards', (await a.p.locator('.sync').count()) === 0)
    await o.p.goto(BASE + '/#/')
    await o.p.waitForTimeout(1500)
    const otto = await o.p.locator('.row-title').allInnerTexts()
    check("the other person's list keeps what was added to it", otto.includes('Torch') && otto.includes('Drill'))

    await a.p.goto(BASE + '/#/settings')
    a.p.once('dialog', (d) => d.accept())
    await a.p.locator('input[type=file]').setInputFiles(file)
    await a.p.waitForTimeout(1200)
    check('downloaded data can be imported again', (await a.p.getByText(/things restored/).count()) > 0)

    check('no page errors', !s.devices.some((d) => d.errors.length), s.devices.flatMap((d) => d.errors).slice(0, 3).join(' | '))
  } finally {
    await s.close()
  }
  assert.deepEqual(report().map((f) => f.name), [])
})
