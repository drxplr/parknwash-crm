import { describe, expect, it } from 'vitest'
import { snapshotToStore, storeChanges } from './cloudRepository'
import type { Snapshot } from './cloudRepository'
const fixture = (): Snapshot => ({
  workspace: { id: 'workspace', revision: 1, reminder_days: 30, appointment_hours: 24 },
  role: 'admin',
  regions: [{ id: 'region', name: 'Geneva', enabled: true }],
  staff: [{ id: 'staff', name: 'Test Team', region_id: 'region', active: true }],
  services: [{ id: 'service', name: 'Wash', duration_minutes: 60, active: true }],
  prices: [{ service_id: 'service', vehicle_size: 'SUV', price_chf: 80 }],
  customers: [
    {
      id: 'customer',
      name: 'Example Customer',
      type: 'Private',
      region_id: 'region',
      notes: '',
      color_key: 'blue',
    },
  ],
  contacts: [
    {
      id: 'contact',
      customer_id: 'customer',
      name: 'Primary',
      role: '',
      email: 'primary@example.test',
      phone: '+41000000000',
      is_primary: true,
    },
    {
      id: 'contact2',
      customer_id: 'customer',
      name: 'Accounts',
      role: 'Billing',
      email: 'accounts@example.test',
      phone: '+41000000001',
      is_primary: false,
    },
  ],
  addresses: [
    {
      id: 'address',
      customer_id: 'customer',
      address: 'Example address',
      label: 'Home',
      is_primary: true,
    },
  ],
  vehicles: [
    {
      id: 'vehicle',
      customer_id: 'customer',
      make: 'Example',
      model: 'Car',
      registration: 'TEST1',
      size: 'SUV',
      notes: '',
      source_vehicle_name: 'Original source',
      year: 2020,
    },
  ],
  bookings: [
    {
      id: 'booking',
      vehicle_id: 'vehicle',
      service_id: 'service',
      starts_at: '2026-03-29T08:00:00Z',
      ends_at: '2026-03-29T09:00:00Z',
      status: 'Confirmed',
      price_chf: 80,
      address: 'Example address',
      notes: '',
      arrival_window_minutes: 30,
    },
  ],
  assignments: [{ booking_id: 'booking', staff_id: 'staff' }],
  activities: [],
  messages: [],
})
describe('cloud repository preserves operational data', () => {
  it('maps Swiss DST dates without shifting appointments', () => {
    const s = fixture()
    expect(snapshotToStore(s).bookings[0]).toMatchObject({
      date: '2026-03-29',
      time: '10:00',
      duration: 60,
    })
    s.bookings[0].starts_at = '2026-10-25T08:00:00Z'
    s.bookings[0].ends_at = '2026-10-25T09:00:00Z'
    expect(snapshotToStore(s).bookings[0]).toMatchObject({
      date: '2026-10-25',
      time: '09:00',
      duration: 60,
    })
  })
  it('editing notes leaves every contact, address and imported vehicle field alone', () => {
    const s = fixture(),
      before = snapshotToStore(s),
      after = structuredClone(before)
    after.customers[0].notes = 'New note'
    const changes = storeChanges(s, before, after)
    expect(changes.map((c) => c.table)).toEqual(['crm_customers'])
    after.vehicles[0].notes = 'Vehicle note'
    const car = storeChanges(s, before, after).find((c) => c.table === 'crm_vehicles')!.row
    expect(car).toMatchObject({ make: 'Example', model: 'Car', notes: 'Vehicle note' })
    expect(car).not.toHaveProperty('year')
    expect(car).not.toHaveProperty('source_vehicle_name')
  })
  it('retains secondary-contact email and phone when updating the primary phone', () => {
    const s = fixture(),
      before = snapshotToStore(s),
      after = structuredClone(before)
    after.customers[0].phone = '+41000000002'
    const contacts = storeChanges(s, before, after).filter((c) => c.table === 'crm_contacts')
    expect(contacts.find((c) => c.row.id === 'contact2')?.row).toMatchObject({
      email: 'accounts@example.test',
      phone: '+41000000001',
    })
  })
  it('does not resurrect an address when the final address is removed', () => {
    const s = fixture(),
      before = snapshotToStore(s),
      after = structuredClone(before)
    after.customers[0].address = ''
    after.customers[0].addresses = []
    expect(storeChanges(s, before, after).filter((c) => c.table === 'crm_addresses')).toEqual([
      { table: 'crm_addresses', mode: 'delete', row: { id: 'address' } },
    ])
  })
  it('builds one booking/assignment/history batch and keeps the quote fixed', () => {
    const s = fixture(),
      before = snapshotToStore(s),
      after = structuredClone(before)
    after.bookings[0].time = '11:00'
    after.activities.push({
      id: 'event',
      customerId: 'customer',
      vehicleId: 'vehicle',
      bookingId: 'booking',
      at: new Date().toISOString(),
      title: 'Rescheduled',
      text: 'New time',
      kind: 'booking',
      author: 'Untrusted author',
    })
    const batch = storeChanges(s, before, after)
    expect(batch.map((c) => c.table)).toEqual([
      'crm_booking_staff',
      'crm_bookings',
      'crm_booking_staff',
      'crm_activities',
    ])
    expect(batch[1].row).toMatchObject({
      starts_at: '2026-03-29T09:00:00.000Z',
      ends_at: '2026-03-29T10:00:00.000Z',
      price_chf: 80,
    })
    expect(batch[3].row).not.toHaveProperty('actor_id')
  })
  it('keeps incomplete imported fields unknown and requires admin for settings', () => {
    const s = fixture()
    s.customers[0].region_id = null
    s.vehicles[0].size = null
    const before = snapshotToStore(s)
    expect(before.customers[0].region).toBe('Unassigned')
    expect(before.vehicles[0].size).toBe('')
    const after = structuredClone(before)
    after.settings.reminderDays = 45
    s.role = 'editor'
    expect(() => storeChanges(s, before, after)).toThrow('Only administrators')
  })
})
