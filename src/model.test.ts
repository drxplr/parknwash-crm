import { assignCustomerColors, customerColors } from './customerColors'
import { describe, expect, it } from 'vitest'
import {
  addDays,
  matches,
  overlaps,
  seed,
  staff,
  reminderQueue,
  tariff,
  whatsappLink,
  swissInstant,
} from './model'
describe('search', () => {
  it('finds a plate regardless of spaces and separators', () =>
    expect(matches('ge804291', 'GE · 804 291')).toBe(true))
  it('ignores accents and case', () => expect(matches('morel', 'Sophie Morél')).toBe(true))
  it('matches model and owner together', () =>
    expect(matches('porsche sophie', 'Porsche', 'Sophie Morel')).toBe(true))
})
describe('team scheduling', () => {
  const existing = seed.bookings[0]
  it('rejects intersecting time for shared staff', () =>
    expect(overlaps({ ...existing, time: '10:00' }, existing)).toBe(true))
  it('allows a back-to-back appointment', () =>
    expect(overlaps({ ...existing, time: '11:00' }, existing)).toBe(false))
  it('allows parallel work by different staff', () =>
    expect(overlaps({ ...existing, staffIds: ['s2'] }, existing)).toBe(false))
  it('ignores cancelled bookings', () =>
    expect(overlaps(existing, { ...existing, status: 'Cancelled' })).toBe(false))
  it('allows the same staff on another day', () =>
    expect(overlaps({ ...existing, date: '2026-11-10' }, existing)).toBe(false))
})
describe('mock data integrity', () => {
  it('every booking has a valid vehicle, customer and staff in the correct region', () => {
    for (const b of seed.bookings) {
      const v = seed.vehicles.find((v) => v.id === b.vehicleId)
      expect(v).toBeDefined()
      const c = seed.customers.find((c) => c.id === v!.customerId)
      expect(c).toBeDefined()
      for (const id of b.staffIds) expect(staff.find((s) => s.id === id)?.region).toBe(c!.region)
    }
  })
  it('steps calendar dates across months', () =>
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01'))
})

describe('reminders and pricing', () => {
  it('queues a lapsed customer but suppresses a customer with an upcoming booking', () => {
    const queue = reminderQueue(seed)
    expect(queue.some((r) => r.customerId === 'c7' && r.type === 'Wash reminder')).toBe(true)
    expect(queue.some((r) => r.customerId === 'c1' && r.type === 'Wash reminder')).toBe(false)
  })
  it('does not remind about a cancelled appointment', () => {
    const store = structuredClone(seed)
    store.bookings = store.bookings.map((b) => ({ ...b, status: 'Cancelled' }))
    expect(reminderQueue(store)).toEqual([])
  })
  it('respects account interval overrides and sent message deduplication', () => {
    const store = structuredClone(seed)
    store.customers.find((c) => c.id === 'c7')!.reminderDays = 90
    expect(reminderQueue(store).some((r) => r.customerId === 'c7')).toBe(false)
    store.customers.find((c) => c.id === 'c7')!.reminderDays = 30
    const r = reminderQueue(store).find((r) => r.customerId === 'c7')!
    store.sentMessages.push({
      id: 'test',
      key: r.key,
      customerId: r.customerId,
      at: '2026-11-09',
      text: r.text,
    })
    expect(
      reminderQueue(store).some((item) => item.key === r.key && item.customerId === 'c7'),
    ).toBe(false)
  })
  it('queues only appointments in the configured time window', () => {
    const queue = reminderQueue(seed)
    expect(queue.some((r) => r.bookingId === 'PNW-1043')).toBe(true)
    expect(queue.some((r) => r.bookingId === 'PNW-1047')).toBe(false)
    expect(queue.some((r) => r.bookingId === 'PNW-1041')).toBe(false)
  })
  it('uses size tariffs without mutating historic quotes', () => {
    expect(tariff(seed.settings.services[0], 'SUV')).toBe(190)
    expect(seed.bookings[0].price).toBe(160)
  })
  it('encodes WhatsApp text and rejects missing recipients', () => {
    expect(whatsappLink('', 'Hi')).toBeNull()
    expect(whatsappLink('+41 00 000 00 00', 'Hi & hello')).toBe(
      'https://wa.me/41000000000?text=Hi%20%26%20hello',
    )
  })
  it('interprets Swiss summer and winter appointments correctly', () => {
    expect(swissInstant('2026-07-10', '09:00')).toBe(Date.parse('2026-07-10T07:00:00Z'))
    expect(swissInstant('2026-11-09', '09:00')).toBe(Date.parse('2026-11-09T08:00:00Z'))
  })
})

describe('automatic client colors', () => {
  it('assigns missing colors once and preserves them on later loads', () => {
    const clients = [{ id: 'existing', colorKey: 'blue' }, { id: 'new' }]
    const assigned = assignCustomerColors(clients)
    expect(assigned[0].colorKey).toBe('blue')
    expect(assigned[1].colorKey).toBeTruthy()
    expect(assignCustomerColors(assigned)).toEqual(assigned)
    expect(clients[1].colorKey).toBeUndefined()
  })
  it('supports a large client base with balanced reuse of valid colors', () => {
    const clients = assignCustomerColors(
      Array.from({ length: 1000 }, (_, i) => ({
        id: `client-${i}`,
        colorKey: undefined as string | undefined,
      })),
    )
    const counts = customerColors.map(
      (c) => clients.filter((client) => client.colorKey === c.key).length,
    )
    expect(counts.reduce((a, b) => a + b, 0)).toBe(1000)
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1)
  })
})
