import { describe, expect, it } from 'vitest'
import {
  average,
  brandName,
  modelName,
  packageName,
  percent,
  presetRange,
  previousRange,
  reportMetrics,
  trend,
  validRange,
  vehicleSize,
} from './reportModel'
import type { ReportData, ReportFact, ReportFilter } from './reportModel'
const filter: ReportFilter = { start: '2026-11-01', end: '2026-11-30', region: 'All', type: 'All' }
const fact = (overrides: Partial<ReportFact> = {}): ReportFact => ({
  id: crypto.randomUUID(),
  customerId: 'c1',
  vehicleId: 'v1',
  date: '2026-11-12',
  region: 'Geneva',
  type: 'Business',
  service: 'Complete Care · Geneva · M',
  status: 'Completed',
  make: 'Mercedes',
  model: 'Mercedes-Benz GLC',
  size: 'SUV',
  price: 100,
  currency: 'CHF',
  paid: false,
  amountPaid: null,
  balanceDue: null,
  paidOn: null,
  paymentStatus: 'unpaid',
  minutes: 60,
  imported: false,
  ...overrides,
})
const data = (facts: ReportFact[], customers: ReportData['customers'] = []): ReportData => ({
  facts,
  customers,
})
describe('report boundaries and comparisons', () => {
  it('uses inclusive calendar dates and equal previous calendar day ranges across DST/leap year', () => {
    expect(presetRange('This week', '2026-11-01')).toEqual({
      start: '2026-10-26',
      end: '2026-11-01',
    })
    expect(presetRange('This month', '2024-02-15')).toEqual({
      start: '2024-02-01',
      end: '2024-02-29',
    })
    expect(previousRange({ ...filter, start: '2026-03-29', end: '2026-03-29' })).toMatchObject({
      start: '2026-03-28',
      end: '2026-03-28',
    })
    expect(
      reportMetrics(
        data([
          fact({ date: '2026-11-01' }),
          fact({ date: '2026-11-30' }),
          fact({ date: '2026-12-01' }),
        ]),
        filter,
      ).facts,
    ).toHaveLength(2)
  })
  it('rejects reversed, invalid and excessive ranges', () => {
    expect(validRange('2026-02-30', '2026-03-02')).toBe(false)
    expect(validRange('2026-12-01', '2026-11-01')).toBe(false)
    expect(validRange('', '')).toBe(false)
    expect(validRange('2000-01-01', '2026-01-01')).toBe(false)
  })
  it('uses identical filters for bookings, cash and customers without mixing regions or customer types', () => {
    const r = reportMetrics(
      data(
        [fact(), fact({ region: 'Ticino' }), fact({ type: 'Private' })],
        [
          { id: 'c1', region: 'Geneva', type: 'Business', createdOn: '2026-11-01' },
          { id: 'c2', region: 'Ticino', type: 'Private', createdOn: '2026-11-01' },
        ],
      ),
      { ...filter, region: 'Geneva', type: 'Business' },
    )
    expect(r.facts).toHaveLength(1)
    expect(r.customers).toHaveLength(1)
    expect(r.revenue).toBe(10000)
  })
})
describe('financial facts, never current catalogue prices', () => {
  it('excludes cancelled/rejected/no-show/pending while retaining complimentary services and integer cents', () => {
    const r = reportMetrics(
      data([
        fact({ price: 10.01 }),
        fact({ price: 0 }),
        ...['Cancelled', 'Rejected', 'No-show', 'Pending'].map((status) =>
          fact({ status, price: 900 }),
        ),
      ]),
      filter,
    )
    expect(r.revenue).toBe(1001)
    expect(r.done.length).toBe(2)
    expect(r.aov).toBe(500.5)
    expect(r.cancelled).toBe(1)
    expect(r.cancelRate).toBeCloseTo(100 / 6)
  })
  it('keeps foreign currency, missing and negative/refund values out of CHF sums and AOV denominators', () => {
    const r = reportMetrics(
      data([
        fact(),
        fact({ currency: 'EUR' }),
        fact({ price: null }),
        fact({ price: -25 }),
        fact({ price: NaN }),
      ]),
      filter,
    )
    expect(r.revenue).toBe(10000)
    expect(r.priced.length).toBe(1)
    expect(r.aov).toBe(10000)
    expect(r.done.length).toBe(5)
  })
  it('preserves partial payments, overpayments and balances without replacing them with booking price', () => {
    const r = reportMetrics(
      data([
        fact({ imported: true, amountPaid: 40, balanceDue: 60 }),
        fact({ imported: true, amountPaid: 120, balanceDue: 0 }),
        fact({ paid: true }),
        fact({ imported: true, paymentStatus: 'paid' }),
      ]),
      filter,
    )
    expect(r.collected).toBe(26000)
    expect(r.outstanding).toBe(6000)
    expect(r.paymentKnown).toBe(3)
    expect(r.outstandingKnown).toBe(3)
  })
  it('does not treat negative/refunded amounts as positive receipts or unknown balances as zero', () => {
    const r = reportMetrics(
      data([
        fact({ imported: true, amountPaid: -30, balanceDue: null, paymentStatus: 'refunded' }),
      ]),
      filter,
    )
    expect(r.collected).toBe(0)
    expect(r.paymentKnown).toBe(0)
    expect(r.outstandingKnown).toBe(0)
  })
  it('keeps payment dates separate from service dates', () => {
    const r = reportMetrics(
      data([
        fact({ date: '2026-10-05', paidOn: '2026-11-10', imported: true, amountPaid: 75 }),
        fact({ paid: true }),
        fact({ paidOn: '2026-12-01', imported: true, amountPaid: 20 }),
      ]),
      filter,
    )
    expect(r.datedCash).toBe(7500)
    expect(r.revenue).toBe(20000)
    expect(r.collected).toBe(12000)
  })
})
describe('customer/vehicle identities and historical imports', () => {
  it('counts B2B once across multiple vehicles and repeating fact IDs once', () => {
    const a = fact(),
      b = fact({ vehicleId: 'v2' })
    const r = reportMetrics(data([a, a, b]), filter)
    expect(r.done.length).toBe(2)
    expect(r.served).toBe(1)
    expect(r.returning).toBe(1)
    expect(r.repeatRate).toBe(100)
    expect(r.uniqueVehicles).toBe(2)
  })
  it('counts one vehicle serviced ten times as one unique vehicle and ten washes', () => {
    const r = reportMetrics(data(Array.from({ length: 10 }, () => fact())), filter)
    expect(r.done.length).toBe(10)
    expect(r.uniqueVehicles).toBe(1)
  })
  it('does not use future completions to label a customer returning or import creation as acquisition', () => {
    const r = reportMetrics(
      data(
        [fact(), fact({ date: '2026-12-01' })],
        [{ id: 'c1', type: 'Business', region: 'Geneva', createdOn: null }],
      ),
      filter,
    )
    expect(r.returning).toBe(0)
    expect(r.newCustomers).toBe(0)
    expect(r.unknownCustomerDates).toBe(1)
  })
  it('includes a prior completed service in repeat classification but not period revenue', () => {
    const r = reportMetrics(data([fact({ date: '2026-10-01' }), fact()]), filter)
    expect(r.repeatRate).toBe(100)
    expect(r.revenue).toBe(10000)
  })
  it('normalizes brand aliases without changing source facts or inventing manufacturers', () => {
    for (const make of ['Mercedes', 'Mercedes-Benz', 'MERCEDES BENZ'])
      expect(brandName(make)).toBe('Mercedes-Benz')
    expect(brandName('VW')).toBe('Volkswagen')
    expect(brandName(null, 'Audi RS7')).toBe('Audi')
    expect(brandName(null, 'Custom upholstery')).toBe('Unknown')
    const f = fact()
    expect(modelName(f)).toBe('Mercedes-Benz GLC')
    expect(f.make).toBe('Mercedes')
    expect(vehicleSize('Estate')).toBe('M')
    expect(vehicleSize('XL')).toBe('L+')
    expect(vehicleSize('rocket')).toBe('Unknown')
    expect(packageName('Signature Care · Ticino · L+')).toBe('Signature')
    expect(packageName('Exterior wash')).toBe('Other / unclassified')
  })
  it('does not fabricate zero-denominator percentages or AOV', () => {
    const r = reportMetrics(data([]), filter)
    expect(r.repeatRate).toBeNull()
    expect(r.aov).toBeNull()
    expect(r.cancelRate).toBeNull()
    expect(percent(0, 0)).toBeNull()
    expect(average(0, 0)).toBeNull()
  })
  it('fills empty trend bins and uses equivalent interval counts across comparison periods', () => {
    const f = { ...filter, start: '2026-01-01', end: '2026-12-31' }
    const rows = trend([fact({ date: '2026-01-01', price: 20 })], f),
      prev = trend([], previousRange(f))
    expect(rows.length).toBe(prev.length)
    expect(rows[0].revenue).toBe(2000)
    expect(rows.at(-1)!.bookings).toBe(0)
  })
})
