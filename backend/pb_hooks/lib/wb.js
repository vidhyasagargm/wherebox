// Shared helpers for the Wherebox hooks.
// PocketBase runs every hook handler in its own isolated JS context, so
// handlers load this file with require() instead of sharing top-level code.

const DAY = 24 * 60 * 60 * 1000

// Version of the privacy policy and terms users agree to at sign-up.
// Bump it (and the app's copy) when the text changes in a way users must accept again.
const CONSENT_VERSION = '2026-10-17'

// PocketBase stores dates as "YYYY-MM-DD HH:MM:SS.sssZ"; filters compare them as text.
function pbDate(ms) {
  return new Date(ms === undefined ? Date.now() : ms).toISOString().replace('T', ' ')
}

function roleOf(list, userId) {
  if (!userId) return null
  if (list.getString('owner') === userId) return 'owner'
  if (list.getStringSlice('editors').includes(userId)) return 'editor'
  if (list.getStringSlice('viewers').includes(userId)) return 'viewer'
  return null
}

function setRole(list, userId, role) {
  const editors = list.getStringSlice('editors').filter((id) => id !== userId)
  const viewers = list.getStringSlice('viewers').filter((id) => id !== userId)
  if (role === 'editor' || role === 'owner') editors.push(userId)
  if (role === 'viewer') viewers.push(userId)
  list.set('editors', editors)
  list.set('viewers', viewers)
}

// "vidhya@example.com" → "vi•••@example.com": enough to recognise someone, without exposing the address.
function maskEmail(email) {
  const [local, domain] = String(email).split('@')
  return (local || '').slice(0, 2) + '•••@' + (domain || '')
}

// Loads a list the current user belongs to, or throws 404 (not 403, so ids can't be probed).
function memberList(e, listId) {
  const userId = e.auth && e.auth.id
  let list
  try {
    list = e.app.findRecordById('lists', listId)
  } catch (_) {
    throw new NotFoundError('List not found.')
  }
  const role = roleOf(list, userId)
  if (!role) throw new NotFoundError('List not found.')
  return { list, role }
}

// Deletes an account and everything that only belongs to it:
// owned lists (with their items, photos and invites) and memberships elsewhere.
// Items the user added to other people's lists stay, without the author link.
function deleteUser(app, user) {
  app.runInTransaction((tx) => {
    const id = user.id
    for (const list of tx.findRecordsByFilter('lists', 'owner = {:id}', '', 0, 0, { id })) tx.delete(list)
    for (const list of tx.findRecordsByFilter('lists', 'editors.id ?= {:id} || viewers.id ?= {:id}', '', 0, 0, { id })) {
      setRole(list, id, null)
      tx.save(list)
    }
    for (const item of tx.findRecordsByFilter('items', 'createdBy = {:id}', '', 0, 0, { id })) {
      item.set('createdBy', '')
      tx.save(item)
    }
    for (const invite of tx.findRecordsByFilter('invites', 'createdBy = {:id}', '', 0, 0, { id })) tx.delete(invite)
    tx.delete(tx.findRecordById('users', id))
  })
}

// Daily housekeeping (GDPR storage limitation):
// - accounts that never confirmed their email are removed after a day,
// - inactive accounts get a warning after 23 months and are deleted after 24,
// - expired invite links are removed.
function cleanup(app) {
  const now = Date.now()
  const result = { unverified: 0, warned: 0, deleted: 0, invites: 0 }

  for (const u of app.findRecordsByFilter('users', 'verified = false && created < {:cut}', '', 0, 0, { cut: pbDate(now - DAY) })) {
    deleteUser(app, u)
    result.unverified++
  }

  const warnBefore = pbDate(now - 700 * DAY)
  for (const u of app.findRecordsByFilter('users', 'verified = true && lastActiveAt != "" && lastActiveAt < {:cut} && inactivityWarnedAt = ""', '', 0, 0, { cut: warnBefore })) {
    sendInactivityWarning(app, u)
    u.set('inactivityWarnedAt', pbDate(now))
    app.unsafeWithoutHooks().save(u)
    result.warned++
  }

  const deleteBefore = pbDate(now - 730 * DAY)
  const warnedBefore = pbDate(now - 28 * DAY)
  for (const u of app.findRecordsByFilter('users', 'lastActiveAt != "" && lastActiveAt < {:cut} && inactivityWarnedAt != "" && inactivityWarnedAt < {:warned}', '', 0, 0, { cut: deleteBefore, warned: warnedBefore })) {
    deleteUser(app, u)
    result.deleted++
  }

  for (const inv of app.findRecordsByFilter('invites', 'expiresAt < {:now}', '', 0, 0, { now: pbDate(now) })) {
    app.delete(inv)
    result.invites++
  }
  return result
}

function sendInactivityWarning(app, user) {
  const url = app.settings().meta.appURL || ''
  const message = new MailerMessage({
    from: { address: app.settings().meta.senderAddress, name: app.settings().meta.senderName },
    to: [{ address: user.email() }],
    subject: 'Your Wherebox account will be deleted soon / Dein Wherebox-Konto wird bald gelöscht',
    html: `<p>You haven't used your Wherebox account for almost two years. To protect your data, we'll delete it in about four weeks. To keep it, just sign in once: ${url}</p>
<hr>
<p>Du hast dein Wherebox-Konto fast zwei Jahre nicht genutzt. Zum Schutz deiner Daten löschen wir es in etwa vier Wochen. Um es zu behalten, melde dich einfach einmal an: ${url}</p>`,
  })
  try {
    app.newMailClient().send(message)
  } catch (err) {
    app.logger().error('inactivity warning failed', 'error', String(err))
  }
}

module.exports = { CONSENT_VERSION, DAY, pbDate, roleOf, setRole, maskEmail, memberList, deleteUser, cleanup }
