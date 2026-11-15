import type { Store } from './model'
export type WorkTimeSave = (bookingId: string, minutes: number | null) => Promise<void>
export function formatWorkTime(minutes: number): string {
  const rounded = Math.max(0, Math.round(minutes)),
    h = Math.floor(rounded / 60),
    m = rounded % 60
  return h ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`
}
export function bookingWorkTime(store: Store, bookingId: string, _assigned: string[] = []) {
  const entry = store.bookingWorkTime?.find((t) => t.bookingId === bookingId)
  return { minutes: entry?.minutes ?? 0, entered: entry ? 1 : 0, missing: 0, source: entry?.source }
}
// Duration is NOT divided: two people on a 2h wash each have 2h (4 person-hours).
export function bookingPersonMinutes(store: Store, bookingId: string, assigned: string[]) {
  const entry = store.bookingWorkTime?.find((t) => t.bookingId === bookingId)
  return entry ? entry.minutes * assigned.length : null
}
