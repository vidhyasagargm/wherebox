/// <reference path="../pb_data/types.d.ts" />

// Nightly consistent snapshots of the database and files (pb_data/backups).
// The backup container encrypts them and copies them offsite; see docs/deploy.md.
migrate(
  (app) => {
    const s = app.settings()
    s.backups.cron = '30 2 * * *'
    s.backups.cronMaxKeep = 3
    app.save(s)
  },
  (app) => {
    const s = app.settings()
    s.backups.cron = ''
    app.save(s)
  },
)
