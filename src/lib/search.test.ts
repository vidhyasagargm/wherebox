import { describe, expect, it } from 'vitest'
import { resolve, suggest } from './search'

const now = Date.now()
const items = [
  { id: '1', name: 'Passport', where: 'Bedroom drawer', updatedAt: now - 1000 },
  { id: '2', name: 'Laptop charger', where: 'Living room sofa table', updatedAt: now - 2000 },
  { id: '3', name: 'Phone charger', where: 'Bedroom nightstand', updatedAt: now - 3000 },
  { id: '4', name: 'Camera charger', where: 'Study desk drawer', updatedAt: now - 4000 },
  { id: '5', name: 'Christmas lights', where: 'Attic red box', updatedAt: now - 5000 },
  { id: '6', name: 'Winterjacken', where: 'Kleiderschrank', updatedAt: now - 6000 },
  { id: '7', name: 'Photo albums', where: 'Living room bookshelf', updatedAt: now - 7000 },
  { id: '8', name: 'Spare keys', where: 'Hallway key bowl', note: 'The blue keyring', updatedAt: now - 8000 },
]

describe('resolve', () => {
  it('answers an exact name', () => {
    expect(resolve('passport', items)).toMatchObject({ kind: 'one', item: { id: '1' } })
  })
  it('lists several chargers', () => {
    const r = resolve('charger', items)
    expect(r.kind).toBe('many')
    if (r.kind === 'many') expect(r.matches.map((m) => m.item.id)).toEqual(['2', '3', '4'])
  })
  it('picks the specific charger', () => {
    expect(resolve('laptop charger', items)).toMatchObject({ kind: 'one', item: { id: '2' } })
  })
  it('handles plurals and typos', () => {
    expect(resolve('christmas light', items)).toMatchObject({ kind: 'one', item: { id: '5' } })
    expect(resolve('pasport', items)).toMatchObject({ kind: 'one', item: { id: '1' } })
    expect(resolve('spare key', items)).toMatchObject({ kind: 'one', item: { id: '8' } })
  })
  it('handles German singular and umlaut-free input', () => {
    expect(resolve('Winterjacke', items)).toMatchObject({ kind: 'one', item: { id: '6' } })
  })
  it('suggests close names when nothing matches', () => {
    const r = resolve('passport photos', items)
    expect(r.kind).not.toBe('one')
    expect(suggest('passport photos', items).map((i) => i.id)).toEqual(expect.arrayContaining(['1', '7']))
  })
  it('finds nothing for unrelated words', () => {
    expect(resolve('umbrella', items).kind).toBe('none')
  })
})
