// Finds saved things for a "where is…?" question. Tolerant of plurals,
// umlauts, small typos and partial names ("charger" → "Laptop charger").

export type Searchable = { id: string; name: string; where: string; note?: string; updatedAt: number }

export type Match<T> = { item: T; score: number }

const STOP = new Set(['the', 'my', 'a', 'an', 'our', 'of', 'der', 'die', 'das', 'den', 'dem', 'mein', 'meine', 'meinen', 'ein', 'eine', 'unser', 'unsere'])

export function normalize(s: string): string {
  return s
    .toLocaleLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Rough stemming that covers common English and German plurals.
export function stem(word: string): string {
  if (word.length <= 3) return word
  for (const suffix of ['ies', 'es', 'en', 'er', 'e', 'n', 's']) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 3) return suffix === 'ies' ? word.slice(0, -3) + 'y' : word.slice(0, -suffix.length)
  }
  return word
}

export function tokens(s: string): string[] {
  return normalize(s)
    .split(/[\s-]+/)
    .filter((w) => w && !STOP.has(w))
    .map(stem)
}

export function distance(a: string, b: string): number {
  if (a === b) return 0
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let last = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1))
      last = tmp
    }
  }
  return prev[b.length]
}

function tokenScore(q: string, t: string): number {
  if (q === t) return 1
  if (t.startsWith(q) && q.length >= 3) return 0.85
  // German compounds: "Ladekabel" contains "kabel".
  if (q.length >= 4 && t.includes(q)) return 0.75
  if (t.length >= 4 && q.includes(t)) return 0.6
  const allowed = q.length >= 7 ? 2 : q.length >= 4 ? 1 : 0
  if (allowed && distance(q, t) <= allowed) return 0.7
  return 0
}

export function score(query: string, item: Searchable): number {
  const q = tokens(query)
  if (!q.length) return 0
  const name = tokens(item.name)
  if (normalize(query) === normalize(item.name) || q.join(' ') === name.join(' ')) return 100

  let total = 0
  for (const qt of q) total += Math.max(0, ...name.map((t) => tokenScore(qt, t)))
  let s = (total / q.length) * 85
  // Prefer names that are not much longer than the query.
  if (s > 0) s -= Math.min(10, Math.max(0, name.length - q.length) * 3)

  // Notes count a little: "Where are the insurance papers?" → note mentions them.
  if (s < 40 && item.note) {
    const note = tokens(item.note)
    const hits = q.filter((qt) => note.some((t) => tokenScore(qt, t) >= 0.85)).length
    if (hits === q.length) s = Math.max(s, 40)
  }
  return Math.max(0, Math.round(s))
}

export function search<T extends Searchable>(query: string, items: T[]): Match<T>[] {
  return items
    .map((item) => ({ item, score: score(query, item) }))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score || b.item.updatedAt - a.item.updatedAt)
}

export type Outcome<T> =
  | { kind: 'one'; item: T }
  | { kind: 'many'; matches: Match<T>[] }
  | { kind: 'none'; suggestions: T[] }

export const STRONG = 55

export function resolve<T extends Searchable>(query: string, items: T[]): Outcome<T> {
  const matches = search(query, items)
  const strong = matches.filter((m) => m.score >= STRONG)
  if (strong.length === 1) return { kind: 'one', item: strong[0].item }
  if (strong.length > 1) {
    // A clear winner (exact name) answers directly; otherwise let the user pick.
    if (strong[0].score === 100 && strong[1].score < 100) return { kind: 'one', item: strong[0].item }
    return { kind: 'many', matches: strong }
  }
  return { kind: 'none', suggestions: suggest(query, items) }
}

// "Did you mean…?" for when nothing matched well: shares a token prefix or is a near-typo.
export function suggest<T extends Searchable>(query: string, items: T[], limit = 3): T[] {
  const q = tokens(query)
  return items
    .map((item) => {
      const name = tokens(item.name)
      let best = 0
      for (const qt of q)
        for (const t of name) {
          const common = commonPrefix(qt, t)
          if (common >= 4) best = Math.max(best, common / Math.max(qt.length, t.length) + 0.3)
          const d = distance(qt, t)
          if (d <= 3 && Math.min(qt.length, t.length) >= 4) best = Math.max(best, 1 - d / Math.max(qt.length, t.length))
        }
      return { item, best }
    })
    .filter((x) => x.best >= 0.45)
    .sort((a, b) => b.best - a.best)
    .slice(0, limit)
    .map((x) => x.item)
}

function commonPrefix(a: string, b: string) {
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  return i
}
