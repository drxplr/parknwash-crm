import { describe, expect, it } from 'vitest'
import { startOfWeek, calendarRangeLabel, layoutBookings } from './calendarModel'
import { seed } from './model'

describe('calendar navigation', () => {
  it('starts weeks on Monday, including Sunday and year boundaries', () => {
    expect(startOfWeek('2026-11-09')).toBe('2026-11-09')
    expect(startOfWeek('2026-11-15')).toBe('2026-11-09')
    expect(startOfWeek('2027-01-01')).toBe('2026-12-28')
  })
  it('keeps both years visible when a week spans New Year', () => {
    expect(calendarRangeLabel('2026-12-28', '2027-01-03')).toBe('28 Dec 2026 – 3 Jan 2027')
  })
})
describe('parallel calendar events', () => {
  const event = seed.bookings[0]
  it('places simultaneous appointments beside each other', () => {
    const items = layoutBookings([
      { ...event, id: 'a', time: '09:00' },
      { ...event, id: 'b', time: '09:30' },
    ])
    expect(items.map((i) => i.column)).toEqual([0, 1])
    expect(items.every((i) => i.columns === 2)).toBe(true)
  })
  it('gives back-to-back events the full column', () => {
    const items = layoutBookings([
      { ...event, id: 'a', time: '09:00' },
      { ...event, id: 'b', time: '11:00' },
    ])
    expect(items.every((i) => i.column === 0 && i.columns === 1)).toBe(true)
  })
  it('reuses a free lane within a connected group and restores full width afterwards', () => {
    const items = layoutBookings([
      { ...event, id: 'a', time: '09:00', duration: 60 },
      { ...event, id: 'b', time: '09:30', duration: 120 },
      { ...event, id: 'c', time: '10:00', duration: 60 },
      { ...event, id: 'd', time: '13:00', duration: 60 },
    ])
    expect(items.find((i) => i.booking.id === 'c')?.column).toBe(0)
    expect(items.find((i) => i.booking.id === 'd')?.columns).toBe(1)
  })
})
