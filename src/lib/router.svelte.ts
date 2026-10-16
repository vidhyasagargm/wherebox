// Tiny hash router: #/item/abc?x=1 → { name: 'item', param: 'abc', query }.
// Hash routes keep the app a plain static site that any server can host.

export type Route = { name: string; param: string; query: URLSearchParams }

function read(): Route {
  const raw = location.hash.replace(/^#\/?/, '')
  const [path, qs = ''] = raw.split('?')
  const [name = '', ...rest] = path.split('/')
  return { name: name || 'home', param: decodeURIComponent(rest.join('/')), query: new URLSearchParams(qs) }
}

export const route = $state<{ current: Route }>({ current: read() })

// Each entry remembers how deep it is inside the app, so Back never leaves it.
const depth = () => (history.state?.depth as number | undefined) ?? 0

function changed() {
  route.current = read()
  window.scrollTo(0, 0)
  // Move focus to the new screen's heading for screen reader users.
  queueMicrotask(() => document.querySelector<HTMLElement>('main h1')?.focus({ preventScroll: true }))
}

if (typeof window !== 'undefined') window.addEventListener('popstate', changed)

export function go(path: string, params: Record<string, string> = {}, replace = false) {
  const qs = new URLSearchParams(params).toString()
  const hash = '#/' + path + (qs ? '?' + qs : '')
  if (replace) history.replaceState({ depth: depth() }, '', hash)
  else history.pushState({ depth: depth() + 1 }, '', hash)
  changed()
}

export function back(fallback = '') {
  if (depth() > 0) history.back()
  else go(fallback, {}, true)
}
