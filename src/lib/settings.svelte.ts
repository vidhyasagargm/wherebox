import type { Lang } from './parser'

export type Theme = 'light' | 'dark' | 'system'

// When answers are read aloud: never, after a spoken question, or every time.
export type ReadAloud = 'off' | 'voice' | 'always'

type Settings = {
  lang: Lang
  theme: Theme
  readAloud: ReadAloud
  // Which list the app shows: 'local' (this device only) or an account list id.
  activeList: string
  onboarded: boolean
  voiceNoticeSeen: boolean
  lastBackup: number | null
  backupSnoozedUntil: number
  installDismissedUntil: number
}

const KEY = 'wherebox.settings'

const browserLang: Lang = typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('de') ? 'de' : 'en'

const defaults: Settings = {
  lang: browserLang,
  theme: 'system',
  readAloud: 'voice',
  activeList: 'local',
  onboarded: false,
  voiceNoticeSeen: false,
  lastBackup: null,
  backupSnoozedUntil: 0,
  installDismissedUntil: 0,
}

function load(): Settings {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return { ...defaults }
  }
}

export const settings = $state<Settings>(load())

export function saveSettings() {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
  } catch {
    // Private mode or blocked storage: settings just won't survive a reload.
  }
}

export function applyTheme() {
  const dark = settings.theme === 'dark' || (settings.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  document.documentElement.lang = settings.lang
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0D1813' : '#F4F5F1')
}

export const DAY = 86_400_000
