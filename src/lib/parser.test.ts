import { describe, expect, it } from 'vitest'
import { guessSplit, parse, splitPlace } from './parser'

describe('parse (English)', () => {
  const cases: [string, ReturnType<typeof parse>['kind'], string, string?][] = [
    ['I put the passport in the bedroom drawer', 'save', 'Passport', 'Bedroom drawer'],
    ['Moved the drill to the garage shelf', 'save', 'Drill', 'Garage shelf'],
    ['I put the spare keys in the hallway key bowl', 'save', 'Spare keys', 'Hallway key bowl'],
    ['The winter jackets are in the bedroom wardrobe', 'save', 'Winter jackets', 'Bedroom wardrobe'],
    ['christmas lights in the attic red box', 'save', 'Christmas lights', 'Attic red box'],
    ['drill on the garage top shelf', 'save', 'Drill', 'Garage top shelf'],
    ['keys on the kitchen table', 'save', 'Keys', 'Kitchen table'],
    ['I left my laptop charger on the sofa table', 'save', 'Laptop charger', 'Sofa table'],
    ['I hid the birth certificate under the mattress', 'save', 'Birth certificate', 'Under the mattress'],
    ['Passport -> study desk', 'save', 'Passport', 'Study desk'],
    ['Where is my passport?', 'ask', 'Passport'],
    ["Where's the charger", 'ask', 'Charger'],
    ['Where are the Christmas lights?', 'ask', 'Christmas lights'],
    ['where did i put the drill', 'ask', 'Drill'],
    ['passport', 'ask', 'Passport'],
  ]
  it.each(cases)('%s', (text, kind, what, where) => {
    const r = parse(text, 'en')
    expect(r.kind).toBe(kind)
    expect(r.what).toBe(what)
    if (where) expect('where' in r && r.where).toBe(where)
  })
})

describe('parse (German)', () => {
  const cases: [string, ReturnType<typeof parse>['kind'], string, string?][] = [
    ['Ich habe den Reisepass in die Schublade im Schlafzimmer gelegt', 'save', 'Reisepass', 'Schublade im Schlafzimmer'],
    ['Der Bohrer liegt jetzt im Garagenregal', 'save', 'Bohrer', 'Garagenregal'],
    ['Ich habe die Ersatzschlüssel in die Schale im Flur getan', 'save', 'Ersatzschlüssel', 'Schale im Flur'],
    ['Die Weihnachtsbeleuchtung ist auf dem Dachboden', 'save', 'Weihnachtsbeleuchtung', 'Dachboden'],
    ['Ich habe den Bohrer in die Garage verschoben', 'save', 'Bohrer', 'Garage'],
    ['Wo ist mein Reisepass?', 'ask', 'Reisepass'],
    ['Wo sind die Winterjacken', 'ask', 'Winterjacken'],
    ['Wo habe ich das Ladekabel hingelegt?', 'ask', 'Ladekabel'],
  ]
  it.each(cases)('%s', (text, kind, what, where) => {
    const r = parse(text, 'de')
    expect(r.kind).toBe(kind)
    expect(r.what).toBe(what)
    if (where) expect('where' in r && r.where).toBe(where)
  })
})

describe('unclear sentences', () => {
  it('guesses item and place from loose words', () => {
    const r = parse('garage shelf drill blue box', 'en')
    expect(r.kind).toBe('unclear')
    expect(r.what).toBe('Drill')
    expect('where' in r && r.where).toBe('Garage shelf, blue box')
  })
  it('splits loose words', () => {
    expect(guessSplit('kitchen drawer batteries', 'en')).toEqual({ what: 'Batteries', where: 'Kitchen drawer' })
  })
})

describe('splitPlace', () => {
  it.each([
    ['Bedroom drawer', 'Bedroom', 'Drawer'],
    ['Garage top shelf', 'Garage', 'Top shelf'],
    ['Drawer in the bedroom', 'Bedroom', 'Drawer'],
    ['Attic red box', 'Attic', 'Red box'],
    ['Living room sofa table', 'Living room', 'Sofa table'],
    ['Schublade im Schlafzimmer', 'Schlafzimmer', 'Schublade'],
    ['Under the bed', '', 'Under the bed'],
    ['Bedroom', 'Bedroom', ''],
  ])('%s', (where, room, spot) => {
    expect(splitPlace(where)).toEqual({ room, spot })
  })
  it('knows rooms the user named', () => {
    expect(splitPlace("Mum's room shelf", ["Mum's room"])).toEqual({ room: "Mum's room", spot: 'Shelf' })
  })
})
