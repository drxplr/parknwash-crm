import { websiteServices } from './websiteCatalog'
import { assignCustomerColors } from './customerColors'
export type Region = 'Geneva' | 'Ticino'
export type Status = 'Confirmed' | 'Pending' | 'In progress' | 'Completed' | 'Cancelled'
export interface Customer {
  id: string
  name: string
  type: 'Private' | 'Business' | 'Unclassified'
  region: Region | 'Unassigned'
  email: string
  contact: string
  address: string
  notes: string
  phone?: string
  contacts?: string[]
  addresses?: string[]
  colorKey?: string
  reminderDays?: number
  whatsappOptIn?: boolean
  unsubscribed?: boolean
}
export interface Vehicle {
  id: string
  customerId: string
  model: string
  plate: string
  color: string
  size: string
  notes: string
  lastWashOn?: string
}
export interface ImportedBooking {
  id: string
  customerId: string
  vehicleId?: string
  vehicleLabel: string
  region?: Region
  date: string
  time: string
  service: string
  status: string
  noShow: boolean
  price: number | null
  currency: string | null
  paymentStatus: string | null
  amountPaid: number | null
  balanceDue: number | null
  address: string
  notes: string
  sourceId: string
}
export type TeamRole = 'manager' | 'washer'
export interface Staff {
  id: string
  name: string
  initials: string
  region: Region | 'Unassigned'
  roles?: TeamRole[] | null
  active?: boolean
  userId?: string | null
}
export interface Booking {
  id: string
  vehicleId: string
  date: string
  time: string
  duration: number
  service: string
  price: number
  staffIds: string[]
  status: Status
  paid: boolean
  address: string
  notes: string
  arrivalWindow?: number
}
export interface Activity {
  id: string
  customerId: string
  vehicleId?: string
  bookingId?: string
  at: string
  title: string
  text: string
  kind: 'note' | 'booking' | 'message' | 'payment'
  author: string
}
export interface Store {
  importedBookings?: ImportedBooking[]
  teamAccounts?: { userId: string; email: string; accessRole?: 'admin' | 'editor' | 'viewer' }[]
  customers: Customer[]
  vehicles: Vehicle[]
  bookings: Booking[]
  activities: Activity[]
  settings: Settings
  sentMessages: SentMessage[]
}
export interface Service {
  id?: string
  name: string
  duration: number
  price: number
  tariffs: Record<string, number>
}
export interface Settings {
  services: Service[]
  staff: Staff[]
  regions: Record<Region, { enabled: boolean; notes: string }>
  reminderDays: number
  appointmentHours: number
}
export interface SentMessage {
  id: string
  key: string
  customerId: string
  at: string
  text: string
}
export interface Reminder {
  key: string
  customerId: string
  vehicleId?: string
  bookingId?: string
  type: 'Wash reminder' | 'Appointment reminder' | 'Manual follow-up'
  reason: string
  text: string
}
export const DEMO_DATE = '2026-11-09'
export const staff: Staff[] = import.meta.env.PROD
  ? []
  : [
      {
        id: 's1',
        name: 'Alex Laurent',
        initials: 'AL',
        region: 'Geneva',
        roles: ['manager', 'washer'],
        active: true,
      },
      {
        id: 's2',
        name: 'Camille Roy',
        initials: 'CR',
        region: 'Geneva',
        roles: ['washer'],
        active: true,
      },
      {
        id: 's3',
        name: 'Luca Riva',
        initials: 'LR',
        region: 'Ticino',
        roles: ['manager'],
        active: true,
      },
      {
        id: 's4',
        name: 'Mia Costa',
        initials: 'MC',
        region: 'Ticino',
        roles: ['washer'],
        active: true,
      },
    ]
export const services: Service[] = import.meta.env.PROD
  ? []
  : [
      {
        name: 'Complete care',
        duration: 120,
        price: 160,
        tariffs: { Compact: 140, Sedan: 160, Estate: 170, SUV: 190 },
      },
      {
        name: 'Exterior wash',
        duration: 60,
        price: 65,
        tariffs: { Compact: 55, Sedan: 65, Estate: 70, SUV: 80 },
      },
      {
        name: 'Interior detailing',
        duration: 90,
        price: 110,
        tariffs: { Compact: 95, Sedan: 110, Estate: 120, SUV: 135 },
      },
      {
        name: 'Premium detailing',
        duration: 180,
        price: 240,
        tariffs: { Compact: 210, Sedan: 240, Estate: 260, SUV: 290 },
      },
    ]
export const statuses: Status[] = ['Pending', 'Confirmed', 'In progress', 'Completed', 'Cancelled']
export const money = (value: number) => `CHF ${value.toLocaleString('en-CH')}`
export function dayLabel(
  date: string,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' },
) {
  return new Date(date + 'T12:00:00').toLocaleDateString('en-GB', options)
}
export function addDays(date: string, n: number) {
  const d = new Date(date + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
export function matches(query: string, ...values: string[]) {
  const normalize = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
  return normalize(values.join(' ')).includes(normalize(query))
}
export function overlaps(a: Pick<Booking, 'date' | 'time' | 'duration' | 'staffIds'>, b: Booking) {
  const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3))
  return (
    b.status !== 'Cancelled' &&
    a.date === b.date &&
    a.staffIds.some((id) => b.staffIds.includes(id)) &&
    mins(a.time) < mins(b.time) + b.duration &&
    mins(b.time) < mins(a.time) + a.duration
  )
}
export const defaultSettings: Settings = {
  services,
  staff,
  reminderDays: 30,
  appointmentHours: 24,
  regions: {
    Geneva: { enabled: true, notes: 'Geneva and surrounding areas' },
    Ticino: { enabled: true, notes: 'Lugano and surrounding areas' },
  },
}
export const tariff = (service: Service, size: string) => service.tariffs[size] ?? service.price
export const seed: Store = import.meta.env.PROD
  ? {
      settings: structuredClone(defaultSettings),
      sentMessages: [],
      customers: [],
      vehicles: [],
      bookings: [],
      activities: [],
    }
  : {
      settings: structuredClone(defaultSettings),
      sentMessages: [],
      customers: [
        {
          id: 'c1',
          name: 'Sophie Morel',
          type: 'Private',
          region: 'Geneva',
          email: 'sophie@example.test',
          contact: 'Sophie Morel',
          address: 'Demo residence · Eaux-Vives, Geneva',
          notes: 'Prefers morning appointments. Call 15 minutes before arrival.',
        },
        {
          id: 'c2',
          name: 'Alpine Studio',
          type: 'Business',
          region: 'Geneva',
          email: 'fleet@alpine.example.test',
          contact: 'Noah Blanc · Fleet manager',
          address: 'Demo office · Rue du Rhône, Geneva',
          notes: 'Fleet care agreement. Contact Noah at reception. Invoice monthly.',
        },
        {
          id: 'c3',
          name: 'Matteo Bellini',
          type: 'Private',
          region: 'Ticino',
          email: 'matteo@example.test',
          contact: 'Matteo Bellini',
          address: 'Demo residence · Paradiso, Lugano',
          notes: 'Underground parking, level −1. Use the visitor entrance.',
        },
        {
          id: 'c4',
          name: 'Emma Fischer',
          type: 'Private',
          region: 'Geneva',
          email: 'emma@example.test',
          contact: 'Emma Fischer',
          address: 'Demo residence · Champel, Geneva',
          notes: 'Use fragrance-free products inside the vehicle.',
        },
        {
          id: 'c5',
          name: 'Lago Collective',
          type: 'Business',
          region: 'Ticino',
          email: 'fleet@lago.example.test',
          contact: 'Elena Fontana · Office manager',
          address: 'Demo office · Centro, Lugano',
          notes: 'Two pool cars. Keys are at the front desk.',
        },
        {
          id: 'c6',
          name: 'Louis Perrin',
          type: 'Private',
          region: 'Geneva',
          email: 'louis@example.test',
          contact: 'Louis Perrin',
          address: 'Demo residence · Carouge, Geneva',
          notes: '',
        },
      ],
      vehicles: [
        {
          id: 'v1',
          customerId: 'c1',
          model: 'Porsche Cayenne',
          plate: 'GE · 804 291',
          color: 'Chalk',
          size: 'SUV',
          notes: 'Check the child seat before cleaning the rear seats.',
        },
        {
          id: 'v2',
          customerId: 'c1',
          model: 'Mini Cooper SE',
          plate: 'GE · 201 584',
          color: 'Sage green',
          size: 'Compact',
          notes: '',
        },
        {
          id: 'v3',
          customerId: 'c2',
          model: 'Mercedes EQB',
          plate: 'GE · 602 147',
          color: 'Black',
          size: 'SUV',
          notes: 'Fleet vehicle 01. Keep charging cable in the boot.',
        },
        {
          id: 'v4',
          customerId: 'c2',
          model: 'Audi A6 Avant',
          plate: 'GE · 602 148',
          color: 'Silver',
          size: 'Estate',
          notes: '',
        },
        {
          id: 'v5',
          customerId: 'c3',
          model: 'BMW i4',
          plate: 'TI · 340 762',
          color: 'Blue',
          size: 'Sedan',
          notes: 'Ceramic coating. Gentle exterior products only.',
        },
        {
          id: 'v6',
          customerId: 'c4',
          model: 'Volvo XC60',
          plate: 'GE · 713 028',
          color: 'White',
          size: 'SUV',
          notes: '',
        },
        {
          id: 'v7',
          customerId: 'c5',
          model: 'Tesla Model 3',
          plate: 'TI · 210 453',
          color: 'Pearl white',
          size: 'Sedan',
          notes: '',
        },
        {
          id: 'v8',
          customerId: 'c5',
          model: 'Volkswagen ID.4',
          plate: 'TI · 210 454',
          color: 'Grey',
          size: 'SUV',
          notes: '',
        },
        {
          id: 'v9',
          customerId: 'c6',
          model: 'Range Rover Sport',
          plate: 'GE · 091 476',
          color: 'Black',
          size: 'SUV',
          notes: 'Pay attention to the boot lining.',
        },
      ],
      bookings: [
        {
          id: 'PNW-1041',
          vehicleId: 'v1',
          date: DEMO_DATE,
          time: '09:00',
          duration: 120,
          service: 'Complete care',
          price: 160,
          staffIds: ['s1'],
          status: 'Completed',
          paid: true,
          address: 'Demo residence · Eaux-Vives, Geneva',
          notes: 'Keys with concierge.',
        },
        {
          id: 'PNW-1042',
          vehicleId: 'v3',
          date: DEMO_DATE,
          time: '10:00',
          duration: 90,
          service: 'Interior detailing',
          price: 110,
          staffIds: ['s2'],
          status: 'In progress',
          paid: false,
          address: 'Demo office · Rue du Rhône, Geneva',
          notes: 'Parking bay A12.',
        },
        {
          id: 'PNW-1043',
          vehicleId: 'v5',
          date: DEMO_DATE,
          time: '10:30',
          duration: 120,
          service: 'Complete care',
          price: 160,
          staffIds: ['s3'],
          status: 'Confirmed',
          paid: true,
          address: 'Demo residence · Paradiso, Lugano',
          notes: 'Call on arrival.',
        },
        {
          id: 'PNW-1044',
          vehicleId: 'v6',
          date: DEMO_DATE,
          time: '13:00',
          duration: 180,
          service: 'Premium detailing',
          price: 240,
          staffIds: ['s1', 's2'],
          status: 'Confirmed',
          paid: false,
          address: 'Demo residence · Champel, Geneva',
          notes: 'Fragrance-free products.',
        },
        {
          id: 'PNW-1045',
          vehicleId: 'v7',
          date: DEMO_DATE,
          time: '14:00',
          duration: 60,
          service: 'Exterior wash',
          price: 65,
          staffIds: ['s4'],
          status: 'Pending',
          paid: false,
          address: 'Demo office · Centro, Lugano',
          notes: 'Waiting for access confirmation.',
        },
        {
          id: 'PNW-1046',
          vehicleId: 'v9',
          date: DEMO_DATE,
          time: '16:00',
          duration: 120,
          service: 'Complete care',
          price: 160,
          staffIds: ['s1'],
          status: 'Pending',
          paid: false,
          address: 'Demo residence · Carouge, Geneva',
          notes: '',
        },
        {
          id: 'PNW-1047',
          vehicleId: 'v4',
          date: '2026-11-10',
          time: '09:30',
          duration: 120,
          service: 'Complete care',
          price: 160,
          staffIds: ['s2'],
          status: 'Confirmed',
          paid: false,
          address: 'Demo office · Rue du Rhône, Geneva',
          notes: '',
        },
        {
          id: 'PNW-1048',
          vehicleId: 'v8',
          date: '2026-11-11',
          time: '11:00',
          duration: 90,
          service: 'Interior detailing',
          price: 110,
          staffIds: ['s3', 's4'],
          status: 'Confirmed',
          paid: false,
          address: 'Demo office · Centro, Lugano',
          notes: '',
        },
        {
          id: 'PNW-1049',
          vehicleId: 'v2',
          date: '2026-11-12',
          time: '10:00',
          duration: 60,
          service: 'Exterior wash',
          price: 65,
          staffIds: ['s1'],
          status: 'Confirmed',
          paid: false,
          address: 'Demo residence · Eaux-Vives, Geneva',
          notes: '',
        },
        {
          id: 'PNW-1035',
          vehicleId: 'v1',
          date: '2026-10-28',
          time: '09:00',
          duration: 120,
          service: 'Complete care',
          price: 160,
          staffIds: ['s1'],
          status: 'Completed',
          paid: true,
          address: 'Demo residence · Eaux-Vives, Geneva',
          notes: '',
        },
        {
          id: 'PNW-1036',
          vehicleId: 'v3',
          date: '2026-11-04',
          time: '10:00',
          duration: 60,
          service: 'Exterior wash',
          price: 65,
          staffIds: ['s2'],
          status: 'Completed',
          paid: true,
          address: 'Demo office · Rue du Rhône, Geneva',
          notes: '',
        },
      ],
      activities: [
        {
          id: 'a1',
          customerId: 'c1',
          vehicleId: 'v1',
          at: '2026-11-09T10:55:00',
          title: 'Complete care completed',
          text: 'Porsche Cayenne · CHF 160 · Payment received',
          kind: 'booking',
          bookingId: 'PNW-1041',
          author: 'Alex Laurent',
        },
        {
          id: 'a2',
          customerId: 'c1',
          at: '2026-11-07T14:15:00',
          title: 'Internal note',
          text: 'Customer prefers morning appointments. Call 15 minutes before arrival.',
          kind: 'note',
          author: 'Camille Roy',
        },
        {
          id: 'a3',
          customerId: 'c1',
          vehicleId: 'v1',
          at: '2026-10-28T11:00:00',
          title: 'Complete care completed',
          text: 'Porsche Cayenne · CHF 160',
          kind: 'booking',
          bookingId: 'PNW-1035',
          author: 'Alex Laurent',
        },
        {
          id: 'a4',
          customerId: 'c2',
          at: '2026-11-06T09:30:00',
          title: 'Internal note',
          text: 'Monthly fleet schedule confirmed with Noah. Start with the EQB.',
          kind: 'note',
          author: 'Camille Roy',
        },
        {
          id: 'a5',
          customerId: 'c3',
          vehicleId: 'v5',
          at: '2026-11-08T12:00:00',
          title: 'Internal note',
          text: 'Ceramic coating checked. Use gentle exterior products.',
          kind: 'note',
          author: 'Luca Riva',
        },
      ],
    }
// Enrich fixtures without changing existing relationships or historic prices.
if (import.meta.env.DEV) {
  for (const c of seed.customers) {
    c.addresses = [c.address, `Demo secondary address · ${c.region}`]
    c.contacts = [c.contact, ...(c.type === 'Business' ? ['Demo accounts team · Billing'] : [])]
  }
  seed.customers.push({
    id: 'c7',
    name: 'Clara Dubois',
    type: 'Private',
    region: 'Geneva',
    email: 'clara@example.test',
    contact: 'Clara Dubois',
    address: 'Demo residence · Plainpalais, Geneva',
    notes: 'Prefers a short WhatsApp message.',
    contacts: ['Clara Dubois'],
    addresses: ['Demo residence · Plainpalais, Geneva'],
  })
  seed.vehicles.push({
    id: 'v10',
    customerId: 'c7',
    model: 'Fiat 500e',
    plate: 'GE · DEMO 010',
    color: 'White',
    size: 'Compact',
    notes: '',
  })
  seed.bookings.push({
    ...seed.bookings[0],
    id: 'PNW-1009',
    vehicleId: 'v10',
    date: '2026-09-30',
    service: 'Exterior wash',
    duration: 60,
    price: 55,
    address: seed.customers[6].address,
  })
  seed.bookings.push({
    ...seed.bookings[0],
    id: 'PNW-1010',
    vehicleId: 'v2',
    date: '2026-09-25',
    price: 55,
    service: 'Exterior wash',
    duration: 60,
  })
  // Give every seeded booking a corresponding timeline event.
  for (const b of seed.bookings) {
    if (!seed.activities.some((a) => a.bookingId === b.id)) {
      const v = seed.vehicles.find((v) => v.id === b.vehicleId)!
      seed.activities.push({
        id: `seed-${b.id}`,
        customerId: v.customerId,
        vehicleId: v.id,
        bookingId: b.id,
        at: `${b.status === 'Completed' ? b.date : addDays(b.date, -2)}T14:00:00+01:00`,
        title: b.status === 'Completed' ? 'Wash completed' : 'Booking created',
        text: `${b.service} · ${v.model} · ${dayLabel(b.date)} at ${b.time}`,
        kind: 'booking',
        author: 'Demo manager',
      })
    }
  }
}
export const STORAGE_KEY = 'parknwash-crm-demo-v3'
export function loadStore(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const data = JSON.parse(raw)
      if (
        ['customers', 'vehicles', 'bookings', 'activities'].every((k) => Array.isArray(data[k])) &&
        data.customers.every(
          (c: Customer) => typeof c.id === 'string' && typeof c.name === 'string',
        ) &&
        data.bookings.every((b: Booking) => Array.isArray(b.staffIds))
      )
        return {
          ...data,
          customers: assignCustomerColors(data.customers as Customer[]),
          settings: data.settings
            ? {
                ...data.settings,
                staff: data.settings.staff.map((s: Staff) => ({
                  ...s,
                  roles: s.roles ?? ['manager', 'washer'],
                  active: s.active ?? true,
                })),
              }
            : structuredClone(defaultSettings),
          sentMessages: data.sentMessages ?? [],
        }
    }
  } catch {
    /* A fresh demo remains usable when browser storage is unavailable. */
  }
  return createDemoStore()
}
export function createDemoStore(): Store {
  const store = structuredClone(seed)
  if (import.meta.env.PROD) return store
  store.settings.services = websiteServices()
  store.vehicles = store.vehicles.map((v) =>
    /EQB|XC60|ID\.4/.test(v.model) ? { ...v, size: 'Sedan' } : v,
  )
  store.bookings = store.bookings.filter((b) => b.date < DEMO_DATE)
  const starts = ['09:00', '10:30', '13:00', '15:30']
  for (let day = 0; day < 6; day++) {
    for (let slot = 0; slot < (day === 5 ? 2 : 4); slot++) {
      const v = store.vehicles[(day * 3 + slot) % store.vehicles.length]
      const c = store.customers.find((c) => c.id === v.customerId)!
      const size = v.size === 'Compact' ? 'S' : v.size === 'SUV' ? 'L+' : 'M'
      const pkg = slot % 3 === 0 ? 'Complete Care' : 'Essential Care'
      const svc = store.settings.services.find((s) => s.name === `${pkg} · ${c.region} · ${size}`)!
      const members = store.settings.staff.filter(
        (s) => s.region === c.region && s.active !== false && s.roles?.includes('washer'),
      )
      const id = `PNW-${1100 + day * 4 + slot}`
      store.bookings.push({
        id,
        vehicleId: v.id,
        date: addDays(DEMO_DATE, day),
        time: starts[slot],
        duration: svc.duration,
        service: svc.name,
        price: tariff(svc, v.size),
        staffIds: [members[slot % members.length].id],
        status: day === 0 && slot === 0 ? 'In progress' : slot === 3 ? 'Pending' : 'Confirmed',
        paid: slot === 1,
        address: c.address,
        notes: slot === 3 ? 'Confirm access before arrival.' : '',
        arrivalWindow: 15,
      })
    }
  }
  store.activities = store.activities.filter(
    (a) => !a.bookingId || store.bookings.some((b) => b.id === a.bookingId),
  )
  for (const b of store.bookings.filter((b) => b.date >= DEMO_DATE)) {
    const v = store.vehicles.find((v) => v.id === b.vehicleId)!
    store.activities.push({
      id: `demo-${b.id}`,
      bookingId: b.id,
      customerId: v.customerId,
      vehicleId: v.id,
      at: `2026-11-08T12:00:00+01:00`,
      title: 'Booking created',
      text: `${b.service} · ${b.date} at ${b.time}`,
      kind: 'booking',
      author: 'Demo manager',
    })
  }
  return { ...store, customers: assignCustomerColors(store.customers) }
}

// Swiss operational clock. Demo controls pass an explicit instant for repeatable queues.
export function reminderQueue(store: Store, now = `${DEMO_DATE}T08:00:00+01:00`): Reminder[] {
  const instant = new Date(now).getTime()
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Zurich',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(now))
  const queue: Reminder[] = []
  for (const c of store.customers) {
    if (c.unsubscribed) continue
    const vehicles = store.vehicles.filter((v) => v.customerId === c.id)
    const bookings = store.bookings.filter((b) => vehicles.some((v) => v.id === b.vehicleId))
    const upcoming = bookings.filter(
      (b) =>
        !['Cancelled', 'Completed'].includes(b.status) && swissInstant(b.date, b.time) >= instant,
    )
    for (const b of upcoming) {
      const hours = (swissInstant(b.date, b.time) - instant) / 3600000
      if (hours <= store.settings.appointmentHours)
        queue.push({
          key: `appointment-${b.id}-${b.date}-${b.time}`,
          customerId: c.id,
          vehicleId: b.vehicleId,
          bookingId: b.id,
          type: 'Appointment reminder',
          reason: `${dayLabel(b.date)} · ${b.time}`,
          text: `Hi ${c.contact.split(' · ')[0]}! Your Park n Wash appointment is on ${dayLabel(b.date)} at ${b.time}, at ${b.address}. Please let us know if anything changes.`,
        })
    }
    // Suppress across the account: a fleet or private customer already has a next visit.
    if (upcoming.length) continue
    const last = bookings
      .filter((b) => b.status === 'Completed' && b.date <= today)
      .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))[0]
    const importedLast = vehicles
      .filter((v) => v.lastWashOn && v.lastWashOn <= today)
      .sort((a, b) => b.lastWashOn!.localeCompare(a.lastWashOn!))[0]
    const lastDate = [last?.date, importedLast?.lastWashOn].filter(Boolean).sort().at(-1)
    if (!lastDate) continue
    const days = Math.floor(
      (Date.parse(today + 'T12:00:00Z') - Date.parse(lastDate + 'T12:00:00Z')) / 86400000,
    )
    if (days >= (c.reminderDays ?? store.settings.reminderDays))
      queue.push({
        key: `wash-${c.id}-${last?.date === lastDate ? last.id : 'vcita-' + lastDate}`,
        customerId: c.id,
        vehicleId: last?.date === lastDate ? last.vehicleId : importedLast?.id,
        type: 'Wash reminder',
        reason: `${days} days since last wash`,
        text: `Hi ${c.contact.split(' · ')[0]}! Is it time for your next Park n Wash? We'd be happy to arrange a clean at your preferred address.`,
      })
  }
  return queue.filter((r) => !store.sentMessages.some((m) => m.key === r.key))
}
export function whatsappLink(phone: string, text: string) {
  const digits = phone.replace(/[^0-9]/g, '')
  return digits.length >= 8 && digits.length <= 15
    ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
    : null
}

export function swissInstant(date: string, time: string) {
  const noon = new Date(`${date}T12:00:00Z`)
  const offset = new Intl.DateTimeFormat('en', {
    timeZone: 'Europe/Zurich',
    timeZoneName: 'longOffset',
  })
    .formatToParts(noon)
    .find((p) => p.type === 'timeZoneName')!
    .value.replace('GMT', '')
  return Date.parse(`${date}T${time}:00${offset}`)
}

export function swissToday(now = new Date()) {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Zurich',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const get = (t: string) => p.find((x) => x.type === t)!.value
  return `${get('year')}-${get('month')}-${get('day')}`
}

export const customerTypeLabel = (type: Customer['type']) =>
  type === 'Unclassified' ? 'Not set' : type
