// The words for answers, shared by the screen and by read-aloud.
import type { Item } from './db'
import { date, speechLang, t } from './i18n'
import { settings } from './settings.svelte'
import { say } from './talk'

const prepositional = (where: string) => /^(under|underneath|beneath|behind|next to|beside|by|near|between|in front of|above|below|on top of)\b/i.test(where)

// "Your passport is in the" / "Your spare keys are" (+ "Under the bed")
export function answerLead(item: Item): string {
  if (settings.lang === 'de') return t('answer.isIn', { name: item.name })
  const plural = /s$/i.test(item.name) && !/ss$/i.test(item.name)
  return `Your ${item.name.toLocaleLowerCase()} ${plural ? 'are' : 'is'}${prepositional(item.where) ? '' : ' in the'}`
}

// Whether to read this answer aloud: after a spoken question, or always if the user chose that.
export function shouldTalk(spoken: boolean) {
  return settings.readAloud === 'always' || (settings.readAloud === 'voice' && spoken)
}

const list = (items: Item[]) => items.map((i) => `${i.name}: ${i.where}`).join('; ')

export const spoken = {
  answer: (item: Item) => `${answerLead(item)} ${item.where}. ${t('answer.since', { date: date(item.since) })}.`,
  many: (items: Item[]) => t('say.many', { n: items.length, list: list(items.slice(0, 3)) }),
  none: (q: string, suggestions: Item[]) =>
    t('say.none', { q }) + (suggestions.length ? ' ' + t('say.didYouMean', { names: suggestions.map((s) => s.name).join(', ') }) : ''),
  saved: (moved: boolean, item: Item) => t(moved ? 'say.moved' : 'say.saved', { what: item.name, where: item.where }),
  unclear: () => t('say.unclear'),
}

export function talk(text: string) {
  say(text, speechLang())
}
