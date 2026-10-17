/// <reference path="../pb_data/types.d.ts" />

// Wherebox server logic on top of PocketBase:
// sign-up with consent, list membership, invite links, members, and GDPR endpoints.
// Each handler require()s ./lib/wb.js because handlers can't share top-level code.

// --- Configuration from the environment (SMTP, public URL) ---
onBootstrap((e) => {
  e.next()
  const env = (k, d) => $os.getenv(k) || d
  const s = e.app.settings()
  s.meta.appURL = env('WB_APP_URL', s.meta.appURL || 'http://localhost:5173')
  s.meta.senderName = env('SMTP_FROM_NAME', 'Wherebox')
  s.meta.senderAddress = env('SMTP_FROM', s.meta.senderAddress || 'noreply@example.com')
  if (env('SMTP_HOST', '')) {
    s.smtp.enabled = true
    s.smtp.host = env('SMTP_HOST', '')
    s.smtp.port = parseInt(env('SMTP_PORT', '587'), 10)
    s.smtp.username = env('SMTP_USER', '')
    s.smtp.password = env('SMTP_PASS', '')
    s.smtp.tls = env('SMTP_TLS', 'false') === 'true'
  }
  e.app.save(s)
})

// --- Local mode without email: print sign-in codes in the server log ---
// For a home network or testing only (WB_LOG_SIGNIN_CODES=true). Anyone who can read the
// server log can sign in as anyone, so never enable it on a public server.
onMailerRecordOTPSend((e) => {
  if ($os.getenv('WB_LOG_SIGNIN_CODES') !== 'true') return e.next()
  console.log(`[wherebox] sign-in code for ${e.record.email()}: ${e.meta.password}`)
})

onBootstrap((e) => {
  e.next()
  if ($os.getenv('WB_LOG_SIGNIN_CODES') === 'true')
    console.log('[wherebox] WB_LOG_SIGNIN_CODES is on: sign-in codes are printed here instead of emailed. Use only on a private network.')
})

// --- Sign-up: an emailed code for an unknown address creates the account, but only with consent ---
onRecordRequestOTPRequest((e) => {
  if (!e.record) {
    const body = e.requestInfo().body || {}
    const email = String(body.email || '').trim().toLowerCase()
    // Without explicit consent nothing is created and no email is sent.
    // PocketBase still answers with an otpId, so the response doesn't reveal whether an account exists.
    if (body.consent === true && email) {
      const user = new Record(e.collection)
      user.setEmail(email)
      user.setRandomPassword()
      user.setEmailVisibility(false)
      user.setVerified(false)
      user.set('name', String(body.name || '').trim().slice(0, 50))
      user.set('consentAt', new Date().toISOString())
      user.set('consentVersion', String(body.consentVersion || ''))
      e.app.save(user)
      e.record = user
    }
  }
  e.next()
}, 'users')

// Remember the last sign-in, for deleting long-inactive accounts.
onRecordAuthRequest((e) => {
  const wb = require(`${__hooks}/lib/wb.js`)
  e.record.set('lastActiveAt', wb.pbDate())
  e.record.set('inactivityWarnedAt', '')
  e.app.unsafeWithoutHooks().save(e.record)
  e.next()
}, 'users')

// --- Lists: the creator becomes owner; membership can't be set by clients ---
onRecordCreateRequest((e) => {
  e.record.set('owner', e.auth.id)
  e.record.set('editors', [e.auth.id])
  e.record.set('viewers', [])
  e.next()
}, 'lists')

// --- Items: the author is always the signed-in user ---
onRecordCreateRequest((e) => {
  if (e.auth) e.record.set('createdBy', e.auth.id)
  e.next()
}, 'items')

// --- Invite links ---

// Create a link. Only the owner can invite. Returns the token once; only its hash is stored.
routerAdd(
  'POST',
  '/api/wb/lists/{id}/invites',
  (e) => {
    const wb = require(`${__hooks}/lib/wb.js`)
    const { list, role } = wb.memberList(e, e.request.pathValue('id'))
    if (role !== 'owner') throw new ForbiddenError('Only the owner can invite people.')
    const body = e.requestInfo().body || {}
    const inviteRole = body.role === 'viewer' ? 'viewer' : 'editor'
    const token = $security.randomString(32)
    const expiresMs = Date.now() + 7 * wb.DAY
    const invite = new Record(e.app.findCollectionByNameOrId('invites'))
    invite.set('list', list.id)
    invite.set('role', inviteRole)
    invite.set('tokenHash', $security.sha256(token))
    invite.set('expiresAt', wb.pbDate(expiresMs))
    invite.set('createdBy', e.auth.id)
    e.app.save(invite)
    return e.json(200, { token, role: inviteRole, expiresAt: new Date(expiresMs).toISOString() })
  },
  $apis.requireAuth('users'),
)

// Revoke all open links for a list.
routerAdd(
  'DELETE',
  '/api/wb/lists/{id}/invites',
  (e) => {
    const wb = require(`${__hooks}/lib/wb.js`)
    const { list, role } = wb.memberList(e, e.request.pathValue('id'))
    if (role !== 'owner') throw new ForbiddenError('Only the owner can revoke invites.')
    const open = e.app.findRecordsByFilter('invites', 'list = {:list}', '', 0, 0, { list: list.id })
    for (const inv of open) e.app.delete(inv)
    return e.json(200, { revoked: open.length })
  },
  $apis.requireAuth('users'),
)

// Preview a link before accepting: list name, who invited, and the role. No account needed.
routerAdd('GET', '/api/wb/invites/{token}', (e) => {
  const wb = require(`${__hooks}/lib/wb.js`)
  let invite
  try {
    invite = e.app.findFirstRecordByFilter('invites', 'tokenHash = {:h} && expiresAt > {:now}', {
      h: $security.sha256(e.request.pathValue('token')),
      now: wb.pbDate(),
    })
  } catch (_) {
    throw new NotFoundError('This invite link is invalid or has expired.')
  }
  const list = e.app.findRecordById('lists', invite.getString('list'))
  let inviter = ''
  try {
    inviter = e.app.findRecordById('users', invite.getString('createdBy')).getString('name')
  } catch (_) {}
  return e.json(200, { list: list.getString('name'), inviter, role: invite.getString('role'), expiresAt: invite.getString('expiresAt') })
})

// Accept a link: join the list with the link's role (never downgrades an existing member).
routerAdd(
  'POST',
  '/api/wb/invites/{token}/accept',
  (e) => {
    const wb = require(`${__hooks}/lib/wb.js`)
    let invite
    try {
      invite = e.app.findFirstRecordByFilter('invites', 'tokenHash = {:h} && expiresAt > {:now}', {
        h: $security.sha256(e.request.pathValue('token')),
        now: wb.pbDate(),
      })
    } catch (_) {
      throw new NotFoundError('This invite link is invalid or has expired.')
    }
    const list = e.app.findRecordById('lists', invite.getString('list'))
    const current = wb.roleOf(list, e.auth.id)
    const offered = invite.getString('role')
    if (!current || (current === 'viewer' && offered === 'editor')) {
      wb.setRole(list, e.auth.id, offered)
      e.app.save(list)
    }
    return e.json(200, { list: list.id, role: wb.roleOf(list, e.auth.id) })
  },
  $apis.requireAuth('users'),
)

// --- Members ---

// Who is in a list. Shows names (or a masked email), never full email addresses.
routerAdd(
  'GET',
  '/api/wb/lists/{id}/members',
  (e) => {
    const wb = require(`${__hooks}/lib/wb.js`)
    const { list } = wb.memberList(e, e.request.pathValue('id'))
    const ids = [list.getString('owner'), ...list.getStringSlice('editors'), ...list.getStringSlice('viewers')]
    const seen = {}
    const members = []
    for (const id of ids) {
      if (seen[id]) continue
      seen[id] = true
      try {
        const u = e.app.findRecordById('users', id)
        members.push({ id, name: u.getString('name') || wb.maskEmail(u.email()), role: wb.roleOf(list, id), you: id === e.auth.id })
      } catch (_) {}
    }
    return e.json(200, members)
  },
  $apis.requireAuth('users'),
)

// Change someone's role (owner only).
routerAdd(
  'PATCH',
  '/api/wb/lists/{id}/members/{user}',
  (e) => {
    const wb = require(`${__hooks}/lib/wb.js`)
    const { list, role } = wb.memberList(e, e.request.pathValue('id'))
    const target = e.request.pathValue('user')
    if (role !== 'owner') throw new ForbiddenError('Only the owner can change roles.')
    if (target === e.auth.id) throw new BadRequestError("You can't change your own role.")
    if (!wb.roleOf(list, target)) throw new NotFoundError('Member not found.')
    const newRole = (e.requestInfo().body || {}).role
    if (newRole !== 'editor' && newRole !== 'viewer') throw new BadRequestError('Role must be editor or viewer.')
    wb.setRole(list, target, newRole)
    e.app.save(list)
    return e.json(200, { id: target, role: newRole })
  },
  $apis.requireAuth('users'),
)

// Remove someone (owner), or leave a list yourself (anyone but the owner).
routerAdd(
  'DELETE',
  '/api/wb/lists/{id}/members/{user}',
  (e) => {
    const wb = require(`${__hooks}/lib/wb.js`)
    const { list, role } = wb.memberList(e, e.request.pathValue('id'))
    const target = e.request.pathValue('user')
    const self = target === e.auth.id
    if (self && role === 'owner') throw new BadRequestError('The owner can delete the list, but not leave it.')
    if (!self && role !== 'owner') throw new ForbiddenError('Only the owner can remove people.')
    if (!wb.roleOf(list, target)) throw new NotFoundError('Member not found.')
    wb.setRole(list, target, null)
    e.app.save(list)
    return e.noContent(204)
  },
  $apis.requireAuth('users'),
)

// --- GDPR: your data ---

// Everything stored about the signed-in user (Art. 15 and 20). The app adds items and photos
// from the normal API to build a complete download.
routerAdd(
  'GET',
  '/api/wb/me/export',
  (e) => {
    const wb = require(`${__hooks}/lib/wb.js`)
    const u = e.app.findRecordById('users', e.auth.id)
    const lists = e.app.findRecordsByFilter('lists', 'owner = {:id} || editors.id ?= {:id} || viewers.id ?= {:id}', 'created', 0, 0, { id: u.id })
    return e.json(200, {
      exportedAt: new Date().toISOString(),
      account: {
        id: u.id,
        email: u.email(),
        name: u.getString('name'),
        created: u.getString('created'),
        consentAt: u.getString('consentAt'),
        consentVersion: u.getString('consentVersion'),
        lastActiveAt: u.getString('lastActiveAt'),
      },
      lists: lists.map((l) => ({ id: l.id, name: l.getString('name'), role: wb.roleOf(l, u.id), created: l.getString('created') })),
    })
  },
  $apis.requireAuth('users'),
)

// Delete the account now (Art. 17). Owned lists are deleted for everyone in them.
routerAdd(
  'DELETE',
  '/api/wb/me',
  (e) => {
    const wb = require(`${__hooks}/lib/wb.js`)
    if ((e.requestInfo().body || {}).confirm !== true) throw new BadRequestError('Send {"confirm": true} to delete your account.')
    wb.deleteUser(e.app, e.app.findRecordById('users', e.auth.id))
    return e.noContent(204)
  },
  $apis.requireAuth('users'),
)

// The consent version the app should ask for at sign-up.
routerAdd('GET', '/api/wb/consent', (e) => {
  const wb = require(`${__hooks}/lib/wb.js`)
  return e.json(200, { version: wb.CONSENT_VERSION })
})

// Agree to the current privacy notice and terms (after they changed).
routerAdd(
  'POST',
  '/api/wb/me/consent',
  (e) => {
    const wb = require(`${__hooks}/lib/wb.js`)
    if ((e.requestInfo().body || {}).version !== wb.CONSENT_VERSION) throw new BadRequestError('Please agree to the current version.')
    const u = e.app.findRecordById('users', e.auth.id)
    u.set('consentAt', new Date().toISOString())
    u.set('consentVersion', wb.CONSENT_VERSION)
    e.app.unsafeWithoutHooks().save(u)
    return e.json(200, { consentVersion: wb.CONSENT_VERSION, consentAt: u.getString('consentAt') })
  },
  $apis.requireAuth('users'),
)

// --- Housekeeping ---

cronAdd('wherebox-cleanup', '17 3 * * *', () => {
  const wb = require(`${__hooks}/lib/wb.js`)
  const r = wb.cleanup($app)
  $app.logger().info('wherebox cleanup', 'unverified', r.unverified, 'warned', r.warned, 'deleted', r.deleted, 'invites', r.invites)
})

// Delete an account on request (superusers only, e.g. for a deletion request by email).
// Same clean-up as the user's own "Delete my account". Not reachable through nginx.
routerAdd(
  'DELETE',
  '/api/wb/admin/users/{id}',
  (e) => {
    const wb = require(`${__hooks}/lib/wb.js`)
    let user
    try {
      user = e.app.findRecordById('users', e.request.pathValue('id'))
    } catch (_) {
      throw new NotFoundError('User not found.')
    }
    wb.deleteUser(e.app, user)
    return e.noContent(204)
  },
  $apis.requireSuperuserAuth(),
)

// Run the housekeeping now (superusers only), e.g. for testing.
routerAdd(
  'POST',
  '/api/wb/admin/cleanup',
  (e) => {
    const wb = require(`${__hooks}/lib/wb.js`)
    return e.json(200, wb.cleanup(e.app))
  },
  $apis.requireSuperuserAuth(),
)
