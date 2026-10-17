// An owner and an invited person: invite links, signing up through an invite,
// view-only rules, promotion to editor, several lists, revoking, leaving, deleting.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checks, eventually, startStack } from './harness.mjs'

test('lists and sharing', { timeout: 300_000 }, async () => {
  const s = await startStack()
  const { check, report } = checks()
  try {
    const { BASE, say, titles, signIn } = s
    const local = (link) => link.replace(/^https?:\/\/[^/]+/, BASE)
    const ownHome = (p) => p.getByRole('listitem').filter({ hasText: 'Yours' }).filter({ hasText: 'Home' }).getByRole('link')

    const a = await s.device()
    await signIn(a.p, 'sagar@test.local', 'Sagar')
    await say(a.p, 'I put the passport in the bedroom drawer')
    await say(a.p, 'spare keys in the hallway key bowl')
    await a.p.waitForTimeout(1200)
    check('home shows the list switcher', (await a.p.locator('.list-switch').innerText()).includes('Home'))

    await a.p.goto(BASE + '/#/lists')
    await ownHome(a.p).click()
    await a.p.waitForTimeout(500)
    await a.p.getByRole('button', { name: 'Only look' }).click()
    await a.p.getByRole('button', { name: 'Create invite link' }).click()
    await a.p.waitForTimeout(500)
    const link = await a.p.locator('code').innerText()
    check('invite token sits after the #', /\/#\/join\/[A-Za-z0-9]{32}$/.test(link))

    const g = await s.device()
    await g.p.goto(local(link))
    await g.p.waitForTimeout(800)
    check('invite preview names the inviter and list', (await g.p.locator('main').innerText()).includes('Sagar invited you to the list “Home”'))
    await g.p.getByRole('button', { name: 'Sign in to join' }).click()
    await g.p.waitForTimeout(300)
    await signIn(g.p, 'grandma@test.local', 'Grandma')
    await g.p.waitForTimeout(800)
    check('returns to the invite after signing in', g.p.url().includes('#/join/'))
    await g.p.getByRole('button', { name: 'Join list' }).click()
    await g.p.waitForTimeout(1500)
    await g.p.goto(BASE + '/#/')
    await g.p.waitForTimeout(800)
    check('joined list is shown with its items', JSON.stringify((await titles(g.p)).sort()) === '["Passport","Spare keys"]')
    check('viewer sees the view-only note', (await g.p.getByText('You can view this list, but not change it.').count()) > 0)
    await say(g.p, 'I put the drill in the garage')
    check('viewer cannot save', !(await titles(g.p)).includes('Drill') && (await g.p.getByText('This list is view-only').count()) > 0)
    await say(g.p, 'Where is my passport?')
    check('viewer can ask', (await g.p.locator('h1').first().innerText()) === 'Bedroom drawer')
    check('viewer gets no edit buttons', (await g.p.getByRole('button', { name: /found it/i }).count()) === 0)

    await a.p.goto(BASE + '/#/lists')
    await ownHome(a.p).click()
    await a.p.waitForTimeout(800)
    const people = await a.p.locator('.person').allInnerTexts()
    check('owner sees members with roles', people.some((x) => x.includes('Sagar (You)')) && people.some((x) => x.includes('Grandma') && x.includes('Can view')))
    await a.p.getByRole('button', { name: 'Allow editing' }).click()
    await a.p.waitForTimeout(800)
    check(
      'promotion reaches the other device',
      await eventually(async () => {
        await g.p.goto(BASE + '/#/')
        return (await g.p.getByText('You can view this list').count()) === 0
      }),
    )
    await say(g.p, 'I put the drill in the garage')
    check(
      "editor's change reaches the owner",
      await eventually(async () => {
        await a.p.goto(BASE + '/#/')
        return (await titles(a.p)).includes('Drill')
      }),
    )

    await a.p.goto(BASE + '/#/lists')
    await a.p.getByRole('button', { name: 'New list' }).click()
    await a.p.fill('#list-name', 'Mum’s flat')
    await a.p.getByRole('button', { name: 'Create' }).click()
    await a.p.waitForTimeout(1000)
    check('new list becomes active and is empty', (await a.p.locator('.list-switch').innerText()).includes('Mum’s flat') && (await titles(a.p)).length === 0)
    await say(a.p, 'Mum’s reading glasses are in the kitchen drawer')
    await a.p.waitForTimeout(800)
    await a.p.goto(BASE + '/#/lists')
    await a.p.getByRole('button', { name: /^Home/ }).click()
    await a.p.waitForTimeout(500)
    check('switching lists shows the right items', !(await titles(a.p)).includes('Mum’s reading glasses') && (await titles(a.p)).includes('Passport'))

    await a.p.goto(BASE + '/#/lists')
    await ownHome(a.p).click()
    await a.p.waitForTimeout(500)
    await a.p.getByRole('button', { name: 'Create invite link' }).click()
    await a.p.waitForTimeout(400)
    const link2 = await a.p.locator('code').innerText()
    await a.p.getByRole('button', { name: 'Turn off all invite links' }).click()
    await a.p.waitForTimeout(500)
    const h = await s.device({ ignore: [/404 \(Not Found\)/] })
    await h.p.goto(local(link2))
    await h.p.waitForTimeout(800)
    check('revoked link shows a clear message', (await h.p.getByText('This invite link doesn’t work any more.').count()) > 0)

    await g.p.goto(BASE + '/#/lists')
    await g.p.waitForTimeout(400)
    check('shared list says whose it is', (await g.p.locator('.row-sub').allInnerTexts()).some((x) => x.includes('From Sagar')))
    await g.p.getByRole('listitem').filter({ hasText: 'From Sagar' }).getByRole('link').click()
    await g.p.waitForTimeout(500)
    g.p.once('dialog', (d) => d.accept())
    await g.p.getByRole('button', { name: 'Leave this list' }).click()
    await g.p.waitForTimeout(1200)
    await g.p.goto(BASE + '/#/')
    await g.p.waitForTimeout(600)
    check('after leaving, the shared items are gone', !(await titles(g.p)).includes('Passport'))
    await a.p.goto(BASE + '/#/lists')
    await ownHome(a.p).click()
    await a.p.waitForTimeout(800)
    check('owner no longer sees her as member', !(await a.p.locator('.person').allInnerTexts()).some((x) => x.includes('Grandma')))

    await a.p.goto(BASE + '/#/lists')
    await a.p.getByRole('link', { name: /Manage: Mum/ }).click()
    await a.p.waitForTimeout(500)
    a.p.once('dialog', (d) => d.accept())
    await a.p.getByRole('button', { name: 'Delete this list' }).click()
    await a.p.waitForTimeout(1000)
    check('deleted list disappears', (await a.p.getByText('Mum’s flat').count()) === 0)

    check('no page errors', !s.devices.some((d) => d.errors.length), s.devices.flatMap((d) => d.errors).slice(0, 3).join(' | '))
  } finally {
    await s.close()
  }
  assert.deepEqual(report().map((f) => f.name), [])
})
