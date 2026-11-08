import { addDays, dayLabel } from './model'
import type { Booking } from './model'
export const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
export function startOfWeek(date: string) {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay()
  return addDays(date, -((weekday + 6) % 7))
}
export function calendarRangeLabel(start: string, end: string) {
  const label = (date: string, year: boolean) =>
    dayLabel(date, { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}) })
  if (start === end)
    return dayLabel(start, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  return `${label(start, start.slice(0, 4) !== end.slice(0, 4))} – ${label(end, true)}`
}
export function layoutBookings(bookings: Booking[]) {
  const result: { booking: Booking; column: number; columns: number }[] = []
  let group: { booking: Booking; column: number; columns: number }[] = [],
    ends: number[] = [],
    groupEnd = -1
  const flush = () => {
    for (const item of group) result.push({ ...item, columns: ends.length })
    group = []
    ends = []
    groupEnd = -1
  }
  for (const booking of [...bookings].sort(
    (a, b) =>
      minutes(a.time) - minutes(b.time) || b.duration - a.duration || a.id.localeCompare(b.id),
  )) {
    const start = minutes(booking.time)
    if (start >= groupEnd) flush()
    let column = ends.findIndex((end) => end <= start)
    if (column < 0) column = ends.length
    ends[column] = start + booking.duration
    groupEnd = Math.max(groupEnd, start + booking.duration)
    group.push({ booking, column, columns: 0 })
  }
  flush()
  return result
}
