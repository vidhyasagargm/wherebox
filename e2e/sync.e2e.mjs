// Two phones signed into one account: moving device items in, two-way sync,
// live updates, offline edits, photos, deleting and signing out.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checks, eventually, startStack } from './harness.mjs'

test('sync between two devices', { timeout: 240_000 }, async () => {
  const s = await startStack()
  const { check, report } = checks()
  try {
    const { BASE, say, titles, signIn } = s
    const a = await s.device({ ignore: [/400 \(Bad Request\)/] })

    // A wrong code shows a clear error.
    await say(a.p, 'I put the passport in the bedroom drawer')
    await say(a.p, 'spare keys are in the hallway key bowl')
    await a.p.goto(BASE + '/#/settings')
    await a.p.getByRole('link', { name: 'Sign in or create account' }).click()
    await a.p.fill('#email', 'family@test.local')
    await a.p.getByRole('button', { name: 'Send code' }).click()
    check('asks for consent first', (await a.p.getByText('Please tick the box to continue.').count()) > 0)
    await a.p.locator('.consent input').check()
    await a.p.getByRole('button', { name: 'Send code' }).click()
    await a.p.waitForSelector('#otp')
    await a.p.fill('#otp', '000000')
    await a.p.getByRole('button', { name: 'Sign in' }).click()
    await a.p.waitForTimeout(500)
    check('wrong code shows an error', (await a.p.getByText('That code didn’t work').count()) > 0)
    await a.p.getByRole('button', { name: 'Use a different email' }).click()

    await signIn(a.p, 'family@test.local', 'Sagar')
    check('offers to move device items', (await a.p.getByText('Move your things into your account?').count()) > 0)
    await a.p.getByRole('button', { name: 'Move them' }).click()
    await a.p.waitForTimeout(2000)
    check('items still shown after moving', JSON.stringify((await titles(a.p)).sort()) === '["Passport","Spare keys"]')

    const b = await s.device()
    await signIn(b.p, 'family@test.local')
    check('no move prompt when nothing is local', (await b.p.getByText('Move your things').count()) === 0)
    await b.p.goto(BASE + '/#/')
    await b.p.waitForTimeout(1500)
    check('second device pulls the items', (await titles(b.p)).length === 2)

    await say(a.p, 'I put the drill on the garage shelf')
    await b.p.goto(BASE + '/#/')
    check('new item appears live on the other device', await eventually(async () => (await titles(b.p)).includes('Drill'), 6000))

    await say(b.p, 'Moved the drill to the garage workbench')
    check(
      'a move on one device shows on the other',
      await eventually(async () => {
        await a.p.goto(BASE + '/#/')
        return (await a.p.locator('.row-sub').allInnerTexts()).includes('Garage workbench')
      }),
    )

    await b.ctx.setOffline(true)
    await say(b.p, 'Christmas lights in the attic red box')
    await b.p.waitForTimeout(1500)
    await b.p.goto(BASE + '/#/settings')
    await b.p.waitForTimeout(500)
    check('shows offline status', /Offline/.test(await b.p.locator('.status').innerText()))
    await b.ctx.setOffline(false)
    await b.p.evaluate(() => dispatchEvent(new Event('online')))
    check(
      'offline change syncs when back online',
      await eventually(async () => {
        await a.p.goto(BASE + '/#/')
        return (await titles(a.p)).includes('Christmas lights')
      }),
    )

    await a.p.goto(BASE + '/#/')
    await a.p.locator('.row-title', { hasText: 'Passport' }).click()
    await a.p.locator('input[type=file]').setInputFiles(s.pngFile())
    await a.p.waitForTimeout(2500)
    check(
      'photo syncs to the other device',
      await eventually(async () => {
        await b.p.goto(BASE + '/#/')
        await b.p.locator('.row-title', { hasText: 'Passport' }).click()
        await b.p.waitForTimeout(400)
        return (await b.p.locator('main img').count()) > 0
      }),
    )

    await a.p.goto(BASE + '/#/')
    await a.p.locator('.row-title', { hasText: 'Spare keys' }).click()
    a.p.once('dialog', (d) => d.accept())
    await a.p.getByRole('button', { name: 'Delete this item' }).click()
    await a.p.waitForTimeout(1500)
    check(
      'deleting on one device removes it on the other',
      await eventually(async () => {
        await b.p.goto(BASE + '/#/')
        return !(await titles(b.p)).includes('Spare keys')
      }),
    )

    await b.p.goto(BASE + '/#/settings')
    b.p.once('dialog', (d) => d.accept())
    await b.p.getByRole('button', { name: 'Sign out' }).click()
    await b.p.waitForTimeout(800)
    await b.p.goto(BASE + '/#/')
    await b.p.waitForTimeout(500)
    check('sign out clears account items from that device', (await titles(b.p)).length === 0)
    await a.p.goto(BASE + '/#/')
    await a.p.waitForTimeout(500)
    check('…and keeps them on the other device', (await titles(a.p)).length === 3)

    check('no page errors', !s.devices.some((d) => d.errors.length), s.devices.flatMap((d) => d.errors).slice(0, 3).join(' | '))
  } finally {
    await s.close()
  }
  assert.deepEqual(report().map((f) => f.name), [])
})
