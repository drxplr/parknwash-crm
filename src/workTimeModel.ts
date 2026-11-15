import type { Store } from './model'

export type WorkTimeSave = (
  bookingId: string,
  staffId: string,
  minutes: number | null,
) => Promise<void>
export function formatWorkTime(minutes: number): string {
  const rounded = Math.max(0, Math.round(minutes))
  const h = Math.floor(rounded / 60),
    m = rounded % 60
  return h ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`
}
export function bookingWorkTime(store: Store, bookingId: string, assigned: string[]) {
  const entries = (store.workTime ?? []).filter((t) => t.bookingId === bookingId)
  return {
    minutes: entries.reduce((n, t) => n + t.minutes, 0),
    entered: entries.length,
    missing: assigned.filter((id) => !entries.some((t) => t.staffId === id)).length,
  }
}
