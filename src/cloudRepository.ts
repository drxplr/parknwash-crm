import type { SupabaseClient } from '@supabase/supabase-js'
import type { Store, Region, Status } from './model'
import { swissInstant } from './model'

type Row = Record<string, unknown>
export interface Snapshot {
  workspace: Row & { id: string; revision: number }
  role: 'admin' | 'editor' | 'viewer'
  regions: Row[]
  staff: Row[]
  services: Row[]
  prices: Row[]
  customers: Row[]
  contacts: Row[]
  addresses: Row[]
  vehicles: Row[]
  bookings: Row[]
  assignments: Row[]
  messages: Row[]
  activities: Row[]
}
export interface Change {
  table: string
  mode: 'upsert' | 'insert' | 'delete'
  row: Row
}
const str = (r: Row, k: string) => String(r[k] ?? '')
const number = (r: Row, k: string) => Number(r[k] ?? 0)
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const sizes = ['Compact', 'Sedan', 'Estate', 'SUV']
const localParts = (iso: string) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Zurich',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const get = (type: string) => parts.find((p) => p.type === type)!.value
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}`,
  }
}
export function snapshotToStore(s: Snapshot): Store {
  const region = (id: unknown) => s.regions.find((r) => r.id === id)?.name as Region | undefined
  return {
    customers: s.customers.map((c) => {
      const contacts = s.contacts.filter((r) => r.customer_id === c.id)
      const addresses = s.addresses.filter((r) => r.customer_id === c.id)
      const labels = contacts.map((r) =>
        [str(r, 'name'), str(r, 'role')].filter(Boolean).join(' · '),
      )
      return {
        id: str(c, 'id'),
        name: str(c, 'name'),
        type: c.type as 'Private' | 'Business',
        region: region(c.region_id) ?? 'Unassigned',
        email: contacts[0] ? str(contacts[0], 'email') : '',
        contact: labels[0] ?? str(c, 'name'),
        contacts: labels,
        address: addresses[0] ? str(addresses[0], 'address') : '',
        addresses: addresses.map((r) => str(r, 'address')),
        phone: contacts[0] ? str(contacts[0], 'phone') : '',
        notes: str(c, 'notes'),
        colorKey: str(c, 'color_key'),
        reminderDays: c.reminder_days == null ? undefined : number(c, 'reminder_days'),
        whatsappOptIn: c.whatsapp_marketing_opt_in === true,
        unsubscribed: c.unsubscribed === true,
      }
    }),
    vehicles: s.vehicles.map((v) => ({
      id: str(v, 'id'),
      customerId: str(v, 'customer_id'),
      model:
        [str(v, 'make'), str(v, 'model')].filter(Boolean).join(' ') ||
        str(v, 'source_vehicle_name') ||
        'Vehicle',
      plate: str(v, 'registration'),
      color: str(v, 'color'),
      size: str(v, 'size'),
      notes: str(v, 'notes'),
    })),
    bookings: s.bookings.map((b) => ({
      id: str(b, 'id'),
      vehicleId: str(b, 'vehicle_id'),
      ...localParts(str(b, 'starts_at')),
      duration: Math.round(
        (Date.parse(str(b, 'ends_at')) - Date.parse(str(b, 'starts_at'))) / 60000,
      ),
      service: str(s.services.find((r) => r.id === b.service_id) ?? {}, 'name'),
      price: number(b, 'price_chf'),
      staffIds: s.assignments.filter((r) => r.booking_id === b.id).map((r) => str(r, 'staff_id')),
      status: b.status as Status,
      paid: b.paid === true,
      address: str(b, 'address'),
      notes: str(b, 'notes'),
      arrivalWindow: number(b, 'arrival_window_minutes'),
    })),
    activities: s.activities.map((a) => ({
      id: str(a, 'id'),
      customerId: str(a, 'customer_id'),
      vehicleId: a.vehicle_id ? str(a, 'vehicle_id') : undefined,
      bookingId: a.booking_id ? str(a, 'booking_id') : undefined,
      at: str(a, 'created_at'),
      title: str(a, 'title'),
      text: str(a, 'text'),
      kind: a.kind as Store['activities'][number]['kind'],
      author: 'Team',
    })),
    sentMessages: s.messages.map((m) => ({
      id: str(m, 'id'),
      key: str(m, 'reminder_key'),
      customerId: str(m, 'customer_id'),
      at: str(m, 'manually_marked_sent_at'),
      text: str(m, 'text'),
    })),
    settings: {
      reminderDays: number(s.workspace, 'reminder_days'),
      appointmentHours: number(s.workspace, 'appointment_hours'),
      regions: Object.fromEntries(
        (['Geneva', 'Ticino'] as const).map((name) => {
          const r = s.regions.find((r) => r.name === name)
          return [name, { enabled: r?.enabled === true, notes: r ? str(r, 'coverage') : '' }]
        }),
      ) as Store['settings']['regions'],
      staff: s.staff
        .filter((r) => r.active === true)
        .map((r) => ({
          id: str(r, 'id'),
          name: str(r, 'name'),
          initials: str(r, 'name')
            .split(' ')
            .map((x) => x[0])
            .slice(0, 2)
            .join(''),
          region: region(r.region_id)!,
        })),
      services: s.services
        .filter((r) => r.active === true)
        .map((r) => {
          const tariffs = Object.fromEntries(
            s.prices
              .filter((p) => p.service_id === r.id)
              .map((p) => [str(p, 'vehicle_size'), number(p, 'price_chf')]),
          )
          return {
            id: str(r, 'id'),
            name: str(r, 'name'),
            duration: number(r, 'duration_minutes'),
            price: tariffs.Sedan ?? 0,
            tariffs,
          }
        }),
    },
  }
}

// Produce only explicit changes. Never replace a workspace with a browser snapshot.
export function storeChanges(base: Snapshot, before: Store, after: Store): Change[] {
  const changes: Change[] = []
  const put = (table: string, row: Row, mode: Change['mode'] = 'upsert') =>
    changes.push({ table, row, mode })
  const regionId = (name: string) => base.regions.find((r) => r.name === name)?.id ?? null
  for (const c of after.customers) {
    const old = before.customers.find((x) => x.id === c.id)
    if (same(c, old)) continue
    put('crm_customers', {
      id: c.id,
      name: c.name,
      type: c.type,
      region_id: regionId(c.region),
      notes: c.notes,
      ...(c.colorKey ? { color_key: c.colorKey } : {}),
      reminder_days: c.reminderDays ?? null,
      whatsapp_marketing_opt_in: c.whatsappOptIn ?? false,
    })
    // Stable IDs retain per-contact emails/phones when a different field changes.
    if (
      !old ||
      !same(
        [c.contacts, c.contact, c.email, c.phone],
        [old.contacts, old.contact, old.email, old.phone],
      )
    ) {
      const existing = base.contacts.filter((r) => r.customer_id === c.id)
      const people = c.contacts?.length ? c.contacts : [c.contact || c.name]
      for (let i = 0; i < existing.length; i++)
        if (i >= people.length) put('crm_contacts', { id: existing[i].id }, 'delete')
      // Clear primary flags before reordering to respect the unique partial index.
      for (const r of existing)
        if (r.is_primary)
          put('crm_contacts', {
            id: r.id,
            customer_id: c.id,
            name: r.name,
            role: r.role,
            email: r.email,
            phone: r.phone,
            is_primary: false,
          })
      people.forEach((label, i) => {
        const [name, ...role] = label.split(' · '),
          r = existing[i]
        put('crm_contacts', {
          id: r?.id ?? crypto.randomUUID(),
          customer_id: c.id,
          name,
          role: role.join(' · '),
          email: i === 0 ? c.email || null : (r?.email ?? null),
          phone: i === 0 ? c.phone || null : (r?.phone ?? null),
          is_primary: i === 0,
        })
      })
    }
    if (!old || !same([c.addresses, c.address], [old.addresses, old.address])) {
      const existing = base.addresses.filter((r) => r.customer_id === c.id),
        addresses = (c.addresses?.length ? c.addresses : [c.address]).filter(Boolean)
      for (let i = 0; i < existing.length; i++)
        if (i >= addresses.length) put('crm_addresses', { id: existing[i].id }, 'delete')
      for (const r of existing.slice(0, addresses.length))
        if (r.is_primary)
          put('crm_addresses', {
            id: r.id,
            customer_id: c.id,
            label: r.label,
            address: r.address,
            is_primary: false,
          })
      addresses.forEach((address, i) =>
        put('crm_addresses', {
          id: existing[i]?.id ?? crypto.randomUUID(),
          customer_id: c.id,
          label: existing[i]?.label ?? '',
          address,
          is_primary: i === 0,
        }),
      )
    }
  }
  for (const v of after.vehicles) {
    const old = before.vehicles.find((x) => x.id === v.id)
    if (same(v, old)) continue
    // Preserve imported make/model if only notes/size were edited.
    const raw = base.vehicles.find((r) => r.id === v.id)
    put('crm_vehicles', {
      id: v.id,
      customer_id: v.customerId,
      make: raw && v.model === old?.model ? raw.make : '',
      model: raw && v.model === old?.model ? raw.model : v.model,
      registration: v.plate || null,
      size: v.size || null,
      color: v.color,
      notes: v.notes,
    })
  }
  if (!same(before.settings, after.settings)) {
    if (base.role !== 'admin') throw new Error('Only administrators can change settings.')
    put('crm_workspaces', {
      id: base.workspace.id,
      reminder_days: after.settings.reminderDays,
      appointment_hours: after.settings.appointmentHours,
    })
    for (const name of ['Geneva', 'Ticino'] as const) {
      const r = base.regions.find((x) => x.name === name)
      if (!r) throw new Error('Region setup is incomplete.')
      const value = after.settings.regions[name]
      put('crm_regions', { id: r.id, name, enabled: value.enabled, coverage: value.notes })
    }
    for (const staff of after.settings.staff)
      put('crm_staff', {
        id: staff.id,
        name: staff.name,
        region_id: regionId(staff.region),
        active: true,
      })
    for (const svc of after.settings.services) {
      const id = svc.id ?? base.services.find((r) => r.name === svc.name)?.id
      if (!id) throw new Error('Service ID is missing.')
      put('crm_services', { id, name: svc.name, duration_minutes: svc.duration, active: true })
      for (const size of sizes)
        if (svc.tariffs[size] != null)
          put('crm_service_prices', {
            service_id: id,
            vehicle_size: size,
            price_chf: svc.tariffs[size],
          })
    }
  }
  for (const b of after.bookings) {
    const old = before.bookings.find((x) => x.id === b.id)
    if (same(b, old)) continue
    const v = after.vehicles.find((v) => v.id === b.vehicleId)!,
      c = after.customers.find((c) => c.id === v.customerId)!
    const svc = after.settings.services.find((s) => s.name === b.service)
    const serviceId = svc?.id ?? base.services.find((s) => s.name === b.service)?.id
    if (!serviceId || !regionId(c.region))
      throw new Error('Set a valid region and service before booking.')
    const start = swissInstant(b.date, b.time)
    // Remove old assignments first: a region change must not retain the old team.
    for (const id of old?.staffIds ?? [])
      put('crm_booking_staff', { booking_id: b.id, staff_id: id }, 'delete')
    put('crm_bookings', {
      id: b.id,
      vehicle_id: b.vehicleId,
      service_id: serviceId,
      region_id: regionId(c.region),
      starts_at: new Date(start).toISOString(),
      ends_at: new Date(start + b.duration * 60000).toISOString(),
      arrival_window_minutes: b.arrivalWindow ?? 30,
      status: b.status,
      price_chf: b.price,
      paid: b.paid,
      address: b.address,
      notes: b.notes,
    })
    for (const id of b.staffIds) put('crm_booking_staff', { booking_id: b.id, staff_id: id })
  }
  for (const m of after.sentMessages)
    if (!before.sentMessages.some((x) => x.id === m.id))
      put(
        'crm_messages',
        { id: m.id, customer_id: m.customerId, reminder_key: m.key, text: m.text },
        'insert',
      )
  for (const a of after.activities)
    if (!before.activities.some((x) => x.id === a.id))
      put(
        'crm_activities',
        {
          id: a.id,
          customer_id: a.customerId,
          vehicle_id: a.vehicleId ?? null,
          booking_id: a.bookingId ?? null,
          kind: a.kind,
          title: a.title,
          text: a.text,
        },
        'insert',
      )
  return changes
}
export async function loadSnapshot(client: SupabaseClient, ws: string): Promise<Snapshot> {
  const { data, error } = await client.rpc('crm_snapshot', { ws })
  if (error) throw error
  if (!data?.workspace || !data?.role)
    throw new Error('Your access to this workspace is unavailable.')
  return data as Snapshot
}
