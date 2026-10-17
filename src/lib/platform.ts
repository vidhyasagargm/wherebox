// Where the app is running: a browser (website or installed PWA), or the Android/iOS
// app, which is the same code wrapped by Capacitor.
//
// In the browser, the server is whoever served the page. The phone apps load the page
// from the device itself, so they talk to a fixed server instead (VITE_API_URL at build
// time, wherebox.sagar.fyi by default). Capacitor's own runtime is only loaded by the apps.

const cap = typeof window !== 'undefined' ? (window as any).Capacitor : undefined

export const isNative: boolean = !!cap?.isNativePlatform?.()
export const nativePlatform: 'android' | 'ios' | null = isNative ? cap.getPlatform() : null

export const SERVER = (isNative ? import.meta.env.VITE_API_URL || 'https://wherebox.sagar.fyi' : typeof location !== 'undefined' ? location.origin : '').replace(/\/$/, '')

// Full address of an API path: "/api/health" → "https://…/api/health".
export const api = (path: string) => SERVER + path

// Links meant for other people (invites) and other apps (quick start).
export const webLink = (hash: string) => `${SERVER}/#/${hash}`
export const quickStartLink = isNative ? 'wherebox://listen' : `${typeof location !== 'undefined' ? location.origin + location.pathname : ''}#/listen`

// Opens Wherebox links that arrive from outside: an invite tapped in a chat
// (https://wherebox.sagar.fyi/#/join/…) or a shortcut (wherebox://listen).
export async function handleAppLinks(open: (route: string) => void) {
  if (!isNative) return
  const { App } = await import('@capacitor/app')
  const route = (url: string) => {
    try {
      const u = new URL(url)
      if (u.protocol === 'wherebox:') return (u.host + u.pathname).replace(/^\/+|\/+$/g, '') + u.search
      if (u.origin === SERVER && u.hash.startsWith('#/')) return u.hash.slice(2)
    } catch {}
    return null
  }
  App.addListener('appUrlOpen', ({ url }) => {
    const r = route(url)
    if (r !== null) open(r)
  })
  const launch = await App.getLaunchUrl()
  if (launch?.url) {
    const r = route(launch.url)
    if (r !== null) open(r)
  }
}
