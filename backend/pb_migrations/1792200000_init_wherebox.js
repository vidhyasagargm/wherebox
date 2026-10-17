/// <reference path="../pb_data/types.d.ts" />

// Wherebox schema: users sign in with an emailed code, own and share lists,
// and lists hold items. Access is enforced by the rules below: a list and its
// items are visible only to its editors and viewers, and only editors can write.

const MEMBER = '(editors.id ?= @request.auth.id || viewers.id ?= @request.auth.id)'
const ITEM_MEMBER = '(list.editors.id ?= @request.auth.id || list.viewers.id ?= @request.auth.id)'
const ITEM_EDITOR = 'list.editors.id ?= @request.auth.id'

const OTP_BODY = `<p>Your Wherebox sign-in code is:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:4px">{OTP}</p>
<p>It is valid for 10 minutes. If you didn't ask for it, you can ignore this email.</p>
<hr>
<p>Dein Wherebox-Anmeldecode lautet:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:4px">{OTP}</p>
<p>Er ist 10 Minuten gültig. Wenn du ihn nicht angefordert hast, ignoriere diese E-Mail einfach.</p>`

migrate(
  (app) => {
    // --- Users: email code only, no passwords ---
    const users = app.findCollectionByNameOrId('users')
    users.passwordAuth.enabled = false
    users.otp.enabled = true
    users.otp.length = 6
    users.otp.duration = 600
    users.otp.emailTemplate.subject = 'Your Wherebox code: {OTP} / Dein Wherebox-Code: {OTP}'
    users.otp.emailTemplate.body = OTP_BODY
    users.mfa.enabled = false
    // A new-device alert makes little sense when every sign-in is by email code.
    users.authAlert.enabled = false
    users.oauth2.enabled = false

    users.listRule = 'id = @request.auth.id'
    users.viewRule = 'id = @request.auth.id'
    // Accounts are created only by the sign-in flow (with consent), never directly.
    users.createRule = null
    users.updateRule =
      'id = @request.auth.id && @request.body.consentAt:isset = false && @request.body.consentVersion:isset = false && @request.body.lastActiveAt:isset = false && @request.body.inactivityWarnedAt:isset = false'
    // Deleting an account goes through /api/wb/me, which also cleans up shared lists.
    users.deleteRule = null

    users.fields.add(new DateField({ name: 'consentAt' }))
    users.fields.add(new TextField({ name: 'consentVersion', max: 20 }))
    users.fields.add(new DateField({ name: 'lastActiveAt' }))
    users.fields.add(new DateField({ name: 'inactivityWarnedAt' }))
    // The default avatar field is personal data we don't need.
    users.fields.removeByName('avatar')
    app.save(users)

    // --- Lists ---
    const lists = new Collection({
      type: 'base',
      name: 'lists',
      listRule: `@request.auth.id != "" && ${MEMBER}`,
      viewRule: `@request.auth.id != "" && ${MEMBER}`,
      // Owner and membership are set by the server (see main.pb.js).
      createRule: '@request.auth.id != ""',
      updateRule:
        'owner = @request.auth.id && @request.body.owner:isset = false && @request.body.editors:isset = false && @request.body.viewers:isset = false',
      deleteRule: 'owner = @request.auth.id',
      fields: [
        { type: 'text', name: 'name', required: true, max: 80 },
        { type: 'relation', name: 'owner', collectionId: users.id, maxSelect: 1, required: true, cascadeDelete: true },
        { type: 'relation', name: 'editors', collectionId: users.id, maxSelect: 999 },
        { type: 'relation', name: 'viewers', collectionId: users.id, maxSelect: 999 },
        { type: 'autodate', name: 'created', onCreate: true },
        { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
      ],
    })
    app.save(lists)

    // --- Items ---
    const items = new Collection({
      type: 'base',
      name: 'items',
      listRule: `@request.auth.id != "" && ${ITEM_MEMBER}`,
      viewRule: `@request.auth.id != "" && ${ITEM_MEMBER}`,
      createRule: `@request.auth.id != "" && ${ITEM_EDITOR}`,
      // Items can't be moved to another list or have their author changed.
      updateRule: `@request.auth.id != "" && ${ITEM_EDITOR} && @request.body.list:isset = false && @request.body.createdBy:isset = false`,
      deleteRule: `@request.auth.id != "" && ${ITEM_EDITOR}`,
      fields: [
        { type: 'relation', name: 'list', collectionId: lists.id, maxSelect: 1, required: true, cascadeDelete: true },
        { type: 'text', name: 'name', required: true, max: 200 },
        { type: 'text', name: 'where', required: true, max: 300 },
        { type: 'date', name: 'since', required: true },
        { type: 'text', name: 'note', max: 2000 },
        {
          type: 'file',
          name: 'photo',
          maxSelect: 1,
          maxSize: 5 * 1024 * 1024,
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
          // Photos show the inside of people's homes: only members with a file token can load them.
          protected: true,
        },
        { type: 'json', name: 'history', maxSize: 100000 },
        { type: 'relation', name: 'createdBy', collectionId: users.id, maxSelect: 1 },
        { type: 'date', name: 'foundAt' },
        { type: 'autodate', name: 'created', onCreate: true },
        { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_items_list_updated ON items (list, updated)'],
    })
    app.save(items)

    // --- Invite links (server-only; managed through /api/wb/…) ---
    const invites = new Collection({
      type: 'base',
      name: 'invites',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { type: 'relation', name: 'list', collectionId: lists.id, maxSelect: 1, required: true, cascadeDelete: true },
        { type: 'select', name: 'role', values: ['editor', 'viewer'], maxSelect: 1, required: true },
        // Only a hash is stored, so a database leak doesn't leak working invite links.
        { type: 'text', name: 'tokenHash', required: true, hidden: true },
        { type: 'date', name: 'expiresAt', required: true },
        { type: 'relation', name: 'createdBy', collectionId: users.id, maxSelect: 1 },
        { type: 'autodate', name: 'created', onCreate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_invites_token ON invites (tokenHash)'],
    })
    app.save(invites)

    // --- Settings: privacy-friendly logging and abuse limits ---
    const s = app.settings()
    s.meta.appName = 'Wherebox'
    s.meta.hideControls = false
    s.logs.maxDays = 7
    s.logs.logIP = false
    s.logs.logAuthId = false
    // Behind Cloudflare the visitor's address arrives in this header (used only for rate limits).
    s.trustedProxy.headers = ['CF-Connecting-IP']
    s.rateLimits.enabled = true
    s.rateLimits.rules = [
      { label: '*:requestOTP', audience: '', duration: 60, maxRequests: 3 },
      { label: '*:authWithOTP', audience: '', duration: 60, maxRequests: 10 },
      { label: 'GET /api/wb/invites/', audience: '', duration: 60, maxRequests: 20 },
      { label: '/api/wb/', audience: '', duration: 60, maxRequests: 60 },
      { label: '*:create', audience: '', duration: 10, maxRequests: 40 },
      { label: '/api/', audience: '', duration: 10, maxRequests: 300 },
    ]
    app.save(s)
  },
  (app) => {
    for (const name of ['invites', 'items', 'lists']) {
      try {
        app.delete(app.findCollectionByNameOrId(name))
      } catch (_) {}
    }
  },
)
