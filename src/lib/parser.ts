// Turns a plain-language sentence into "save X at Y" or "where is X?".
// Rule based on purpose: it runs instantly, offline, and is easy for
// contributors to extend with new phrasings or languages.

export type Lang = 'en' | 'de'

export type Parsed =
  | { kind: 'save'; what: string; where: string }
  | { kind: 'ask'; what: string }
  | { kind: 'unclear'; what: string; where: string; text: string }

type Rules = {
  ask: RegExp[]
  // Each rule captures (what, where) or (where, what) as named groups.
  save: RegExp[]
  // Words stripped from the edges of a captured item or place.
  fillers: string[]
  // Prepositions that carry meaning and stay in the place text ("under the bed").
  keepPreps: string[]
  // Words that suggest a phrase names a place, for the unclear-sentence guess.
  placeWords: string[]
}

const EN: Rules = {
  ask: [
    /^(?:where(?:'s| is| are| did i (?:put|leave|keep)| do i keep| have i (?:put|left))|where)\s+(?<what>.+?)(?:\s+(?:again|now))?\s*\??$/i,
    /^(?:find|look for|search(?: for)?|have you seen|do you know where)\s+(?<what>.+?)(?:\s+(?:is|are))?\s*\??$/i,
  ],
  save: [
    /^(?:i\s+)?(?:have\s+|just\s+)?(?:moved|move|took|take|brought|bring)\s+(?<what>.+?)\s+(?:to|into|in|onto|over to)\s+(?<where>.+)$/i,
    /^(?:i\s+)?(?:have\s+|just\s+|'ve\s+)?(?:put|placed|place|left|leave|stored|store|keep|kept|hid|hide|stashed|stash|packed|pack|dropped|hung|hang|filed|set)\s+(?<what>.+?)\s+(?<where>(?:in|inside|into|on|onto|on top of|under|underneath|beneath|behind|next to|beside|by|at|near|between|in front of|above|below)\s+.+)$/i,
    /^(?<what>.+?)\s+(?:is|are|'s|is now|are now|now)\s+(?<where>(?:in|inside|on|on top of|under|underneath|behind|next to|beside|by|at|near|between|in front of|above|below)\s+.+)$/i,
    /^(?<what>.+?)\s+(?:goes|go|belongs|belong|lives|live)\s+(?<where>(?:in|inside|on|under|behind|next to|at)\s+.+)$/i,
    /^(?<what>.+?)\s*(?:->|→|=>|:)\s*(?<where>.+)$/,
    /^(?<what>.+?)\s+(?<where>(?:in|inside|on top of|under|underneath|behind|next to)\s+.+)$/i,
  ],
  fillers: ['i', 'the', 'my', 'our', 'a', 'an', 'some', 'his', 'her', 'their', 'your', 'in', 'into', 'inside', 'on', 'onto', 'to', 'at', 'of', 'away', 'there', 'now', 'just', 'please', 'again'],
  keepPreps: ['under', 'underneath', 'beneath', 'behind', 'next to', 'beside', 'by', 'near', 'between', 'in front of', 'above', 'below', 'on top of'],
  placeWords: [],
}

const DE: Rules = {
  ask: [
    /^(?:wo\s+(?:ist|sind|liegt|liegen|steht|stehen|hängt|hängen|habe ich|hab ich|hatte ich|sind denn|ist denn|ist eigentlich|sind eigentlich))\s+(?<what>.+?)(?:\s+(?:hin(?:gelegt|getan|gestellt|gepackt)?|gelegt|getan|gestellt|gepackt|versteckt|nochmal|jetzt))?\s*\??$/i,
    /^wo\s+(?<what>.+?)\s*\?$/i,
    /^(?:finde|suche|such)\s+(?<what>.+?)\s*\??$/i,
  ],
  save: [
    /^(?:ich\s+)?(?:habe\s+|hab\s+)?(?<what>.+?)\s+(?:nach|in|ins|in die|in den|auf|zu|zum|zur)\s+(?<where>.+?)\s+(?:verschoben|verlegt|gebracht|geräumt|umgeräumt)$/i,
    /^(?:ich\s+)?(?:habe|hab)\s+(?<what>.+?)\s+(?<where>(?:in|im|ins|auf|aufs|unter|unterm|hinter|hinterm|neben|an|am|ans|bei|beim|zwischen|vor|über|oben auf)\s+.+?)\s+(?:gelegt|getan|gestellt|verstaut|gepackt|versteckt|gehängt|gesteckt|abgelegt|aufbewahrt|hingelegt|hingestellt|reingelegt|reingetan|eingeräumt)$/i,
    /^(?:ich\s+)?(?:lege|leg|stelle|stell|tue|tu|packe|pack|räume|räum|hänge|häng|stecke|steck|verstaue)\s+(?<what>.+?)\s+(?<where>(?:in|im|ins|auf|aufs|unter|hinter|neben|an|am|ans|bei|zwischen|vor|über)\s+.+?)(?:\s+(?:hin|rein|ab|weg|ein))?$/i,
    /^(?<what>.+?)\s+(?:ist|sind|liegt|liegen|steht|stehen|hängt|hängen|bleibt|bleiben)\s+(?:jetzt\s+|nun\s+|ab jetzt\s+)?(?<where>(?:in|im|auf|unter|unterm|hinter|neben|an|am|bei|beim|zwischen|vor|über)\s+.+)$/i,
    /^(?<what>.+?)\s*(?:->|→|=>|:)\s*(?<where>.+)$/,
    /^(?<what>.+?)\s+(?<where>(?:im|in der|in dem|auf dem|auf der|unter dem|unter der|unterm|hinter dem|hinter der|neben dem|neben der)\s+.+)$/i,
  ],
  fillers: ['ich', 'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem', 'einer', 'mein', 'meine', 'meinen', 'meinem', 'meiner', 'meines', 'unser', 'unsere', 'unseren', 'unserem', 'unserer', 'dein', 'deine', 'in', 'im', 'ins', 'auf', 'aufs', 'an', 'am', 'ans', 'zu', 'zum', 'zur', 'nach', 'jetzt', 'nun', 'mal', 'bitte', 'hin', 'denn', 'eigentlich', 'nochmal'],
  keepPreps: ['unter', 'unterm', 'hinter', 'hinterm', 'neben', 'bei', 'beim', 'zwischen', 'vor', 'über', 'oben auf'],
  placeWords: [],
}

const RULES: Record<Lang, Rules> = { en: EN, de: DE }

// Rooms and furniture help two things: guessing the place when a sentence has
// no clear structure, and grouping places into rooms.
export const ROOMS: Record<Lang, string[]> = {
  en: ['living room', 'dining room', 'bedroom', 'kids room', "kids' room", 'guest room', 'spare room', 'bathroom', 'kitchen', 'hallway', 'hall', 'garage', 'attic', 'loft', 'basement', 'cellar', 'study', 'office', 'utility room', 'laundry room', 'pantry', 'shed', 'garden', 'balcony', 'car', 'nursery', 'toilet', 'storage room', 'porch', 'conservatory', 'closet'],
  de: ['wohnzimmer', 'esszimmer', 'schlafzimmer', 'kinderzimmer', 'gästezimmer', 'badezimmer', 'bad', 'küche', 'flur', 'diele', 'garage', 'dachboden', 'speicher', 'keller', 'arbeitszimmer', 'büro', 'hauswirtschaftsraum', 'waschküche', 'abstellraum', 'abstellkammer', 'vorratskammer', 'speisekammer', 'gartenhaus', 'schuppen', 'garten', 'balkon', 'auto', 'toilette', 'gäste-wc', 'wc', 'terrasse', 'treppenhaus'],
}

const FURNITURE: Record<Lang, string[]> = {
  en: ['drawer', 'shelf', 'shelves', 'cupboard', 'cabinet', 'wardrobe', 'box', 'bin', 'basket', 'bag', 'bowl', 'desk', 'table', 'nightstand', 'dresser', 'chest', 'suitcase', 'bookshelf', 'bookcase', 'sofa', 'couch', 'bed', 'folder', 'safe', 'rack', 'hook', 'tray', 'case', 'crate', 'locker', 'counter', 'sideboard', 'top', 'bottom', 'left', 'right', 'back', 'front', 'upper', 'lower', 'middle'],
  de: ['schublade', 'regal', 'schrank', 'kleiderschrank', 'kiste', 'karton', 'box', 'korb', 'tasche', 'schale', 'schreibtisch', 'tisch', 'nachttisch', 'kommode', 'truhe', 'koffer', 'bücherregal', 'sofa', 'couch', 'bett', 'ordner', 'tresor', 'haken', 'ablage', 'fach', 'kasten', 'spind', 'sideboard', 'oben', 'unten', 'links', 'rechts', 'hinten', 'vorne', 'oberste', 'unterste', 'mittlere'],
}

const COLORS: Record<Lang, string[]> = {
  en: ['red', 'blue', 'green', 'yellow', 'black', 'white', 'grey', 'gray', 'brown', 'orange', 'pink', 'purple', 'big', 'small', 'large', 'little', 'old', 'new', 'wooden', 'plastic', 'metal'],
  de: ['rot', 'rote', 'roten', 'blau', 'blaue', 'blauen', 'grün', 'grüne', 'grünen', 'gelb', 'gelbe', 'gelben', 'schwarz', 'schwarze', 'schwarzen', 'weiß', 'weiße', 'weißen', 'grau', 'graue', 'grauen', 'braun', 'braune', 'braunen', 'große', 'großen', 'kleine', 'kleinen', 'alte', 'alten'],
}

const clean = (s: string) => s.replace(/\s+/g, ' ').replace(/^[\s,.;!?"“”„']+|[\s,.;!?"“”„']+$/g, '').trim()

const capitalize = (s: string) => (s ? s.charAt(0).toLocaleUpperCase() + s.slice(1) : s)

function stripEdges(text: string, fillers: string[]): string {
  const words = clean(text).split(' ')
  const isFiller = (w: string | undefined) => w !== undefined && fillers.includes(w.toLocaleLowerCase())
  while (words.length > 1 && isFiller(words[0])) words.shift()
  while (words.length > 1 && isFiller(words[words.length - 1])) words.pop()
  return words.join(' ')
}

export function cleanWhat(text: string, lang: Lang): string {
  return capitalize(stripEdges(text, RULES[lang].fillers))
}

export function cleanWhere(text: string, lang: Lang): string {
  const rules = RULES[lang]
  const t = clean(text)
  const lower = t.toLocaleLowerCase()
  // Keep meaningful prepositions: "Under the bed" is not the same as "Bed".
  const kept = rules.keepPreps.find((p) => lower.startsWith(p + ' '))
  if (kept) {
    const rest = t.slice(kept.length + 1)
    return capitalize(kept + ' ' + stripLeadingFillers(rest, rules.fillers))
  }
  return capitalize(stripEdges(t, rules.fillers))
}

function stripLeadingFillers(text: string, fillers: string[]) {
  const words = text.split(' ')
  // After a kept preposition only drop possessives, keep the article ("under the bed").
  const possessive = fillers.filter((w) => /^(my|our|his|her|their|your|mein|meine|meinen|meinem|meiner|unser|unsere|unserem|unserer)$/.test(w))
  while (words.length > 1 && possessive.includes(words[0].toLocaleLowerCase())) words.shift()
  return words.join(' ')
}

export function parse(input: string, lang: Lang): Parsed {
  const text = clean(input)
  if (!text) return { kind: 'unclear', what: '', where: '', text }

  // Try both languages, preferring the app's language.
  const order: Lang[] = lang === 'de' ? ['de', 'en'] : ['en', 'de']
  for (const l of order) {
    for (const re of RULES[l].ask) {
      const m = text.match(re)
      if (m?.groups?.what) {
        const what = cleanWhat(m.groups.what, l)
        if (what) return { kind: 'ask', what }
      }
    }
  }
  for (const l of order) {
    for (const re of RULES[l].save) {
      const m = text.match(re)
      if (m?.groups?.what && m.groups.where) {
        const what = cleanWhat(m.groups.what, l)
        const where = cleanWhere(m.groups.where, l)
        if (what && where && what.toLocaleLowerCase() !== where.toLocaleLowerCase()) return { kind: 'save', what, where }
      }
    }
  }

  // A short phrase with no place words is almost always a search: "passport".
  const guess = guessSplit(text, lang)
  if (!guess.where && text.split(' ').length <= 4) return { kind: 'ask', what: cleanWhat(text, lang) }
  return { kind: 'unclear', what: guess.what, where: guess.where, text }
}

// "garage shelf drill blue box" → what: "Drill", where: "Garage shelf, blue box"
export function guessSplit(text: string, lang: Lang): { what: string; where: string } {
  const places = new Set([...ROOMS[lang], ...FURNITURE[lang], ...ROOMS.en, ...FURNITURE.en])
  const colors = new Set([...COLORS[lang], ...COLORS.en])
  const fillers = new Set(RULES[lang].fillers)
  const words = clean(text).split(' ').filter((w) => !fillers.has(w.toLocaleLowerCase()))
  const lower = words.map((w) => w.toLocaleLowerCase())
  const isPlace = lower.map((w, i) => places.has(w) || (i < lower.length - 1 && places.has(`${w} ${lower[i + 1]}`)) || (i > 0 && places.has(`${lower[i - 1]} ${w}`)))
  // Adjectives belong to the place word that follows them ("blue box").
  for (let i = lower.length - 2; i >= 0; i--) if (colors.has(lower[i]) && isPlace[i + 1]) isPlace[i] = true

  const what: string[] = []
  const whereParts: string[][] = [[]]
  isPlace.forEach((p, i) => {
    if (p) whereParts[whereParts.length - 1].push(words[i])
    else {
      what.push(words[i])
      if (whereParts[whereParts.length - 1].length) whereParts.push([])
    }
  })
  const where = whereParts.filter((p) => p.length).map((p) => p.join(' ')).join(', ')
  return { what: capitalize(what.join(' ')), where: capitalize(where.toLocaleLowerCase()) }
}

// Splits a place into its room and the spot inside it, for the Places screen.
// "Bedroom drawer" → { room: "Bedroom", spot: "Drawer" }
export function splitPlace(where: string, extraRooms: string[] = []): { room: string; spot: string } {
  const lower = where.toLocaleLowerCase()
  const rooms = [...extraRooms.map((r) => r.toLocaleLowerCase()), ...ROOMS.en, ...ROOMS.de].sort((a, b) => b.length - a.length)
  for (const room of rooms) {
    const re = new RegExp(`(^|[\\s,(])${escapeRe(room)}(?=$|[\\s,.)])`, 'i')
    const m = lower.match(re)
    if (!m || m.index === undefined) continue
    const start = m.index + m[1].length
    const roomText = where.slice(start, start + room.length)
    let spot = (where.slice(0, start) + ' ' + where.slice(start + room.length)).replace(/\s*,\s*/g, ', ')
    spot = spot.replace(/\b(in|in the|im|in der|in dem|of the|of|at|at the)\s*$/i, '')
    spot = clean(spot.replace(/^\s*(,|the|der|die|das|im)\s+/i, ''))
    return { room: capitalize(roomText), spot: capitalize(spot) }
  }
  return { room: '', spot: capitalize(clean(where)) }
}

export function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
