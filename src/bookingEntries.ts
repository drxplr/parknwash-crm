import type { Booking, Customer, ImportedBooking, Region, Store } from './model'
export interface BookingEntry {
  id: string
  date: string
  time: string
  duration: number
  durationKnown: boolean
  service: string
  status: string
  staffIds: string[]
  customer: Customer
  vehicleLabel: string
  plate: string
  region?: Region | 'Unassigned'
  price: number | null
  currency: string | null
  payment: string
  live?: Booking
  imported?: ImportedBooking
}
export function buildBookingEntries(store: Store): BookingEntry[] {
  const customer = (id: string): Customer =>
    store.customers.find((c) => c.id === id) ?? {
      id,
      name: 'Customer unavailable',
      type: 'Unclassified',
      region: 'Unassigned',
      email: '',
      contact: '',
      address: '',
      notes: '',
    }
  const live: BookingEntry[] = store.bookings.map((b) => {
    const v = store.vehicles.find((v) => v.id === b.vehicleId)
    const c = customer(v?.customerId ?? '')
    return {
      id: `live:${b.id}`,
      date: b.date,
      time: b.time,
      duration: b.duration,
      durationKnown: true,
      service: b.service,
      status: b.status,
      staffIds: b.staffIds,
      customer: c,
      vehicleLabel: v?.model ?? 'Vehicle unavailable',
      plate: v?.plate ?? '',
      region: c.region,
      price: b.price,
      currency: 'CHF',
      payment: b.paid ? 'Paid' : 'Unpaid',
      live: b,
    }
  })
  // Source references are unique within this workspace. Never merge distinct visits by date/name.
  const seen = new Set<string>()
  const imported: BookingEntry[] = (store.importedBookings ?? [])
    .filter((b) => {
      const key = b.sourceId || b.id
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .map((b) => ({
      id: `vcita:${b.id}`,
      date: b.date,
      time: b.time,
      duration: Number.isFinite(b.duration) && b.duration! > 0 ? b.duration! : 30,
      durationKnown: !!Number.isFinite(b.duration) && b.duration! > 0,
      service: b.service,
      status: b.noShow
        ? 'No-show'
        : ({
            completed: 'Completed',
            cancelled: 'Cancelled',
            rejected: 'Rejected',
            confirmed: 'Confirmed',
            pending: 'Pending',
          }[b.status.toLowerCase()] ?? b.status),
      staffIds: [],
      customer: customer(b.customerId),
      vehicleLabel: b.vehicleLabel || 'Vehicle not recorded',
      plate: store.vehicles.find((v) => v.id === b.vehicleId)?.plate ?? '',
      region: b.region,
      price: b.price,
      currency: b.currency,
      payment: b.paymentStatus ?? 'Not recorded',
      imported: b,
    }))
  return [...live, ...imported]
}
export function entryStatusMatches(entry: BookingEntry, status: string) {
  return (
    status === 'All statuses' ||
    (status === 'All active'
      ? !['Cancelled', 'Rejected', 'No-show'].includes(entry.status)
      : entry.status === status)
  )
}
export function entryMoney(b: BookingEntry) {
  return b.price == null
    ? 'Not recorded'
    : `${b.currency ?? 'Currency unknown'} ${b.price.toLocaleString('en-CH')}`
}
