import { addDays, swissToday } from './model'
export type ReportTab = 'Overview' | 'Revenue' | 'Bookings' | 'Customers' | 'Services' | 'Vehicles'
export const reportTabs: ReportTab[] = [
  'Overview',
  'Revenue',
  'Bookings',
  'Customers',
  'Services',
  'Vehicles',
]
export interface ReportFact {
  id: string
  customerId: string | null
  vehicleId: string | null
  date: string
  region: string | null
  type: string | null
  service: string | null
  status: string
  make: string | null
  model: string | null
  size: string | null
  price: number | null
  currency: string | null
  paid: boolean | null
  amountPaid: number | null
  balanceDue: number | null
  paidOn: string | null
  paymentStatus: string | null
  minutes: number | null
  imported: boolean
}
export interface ReportCustomer {
  id: string
  type: string | null
  region: string | null
  createdOn: string | null
}
export interface ReportData {
  facts: ReportFact[]
  customers: ReportCustomer[]
}
export type ReportsApi = () => Promise<ReportData>
export interface ReportFilter {
  start: string
  end: string
  region: string
  type: string
}
export interface Breakdown {
  label: string
  count: number
  revenue: number
  priced: number
}
export const percent = (n: number, d: number) => (d ? (n / d) * 100 : null)
export const average = (n: number, d: number) => (d ? n / d : null)
export function presetRange(
  preset: string,
  today = swissToday(),
): Pick<ReportFilter, 'start' | 'end'> {
  if (preset === 'Today') return { start: today, end: today }
  if (preset === 'This week') {
    const day = new Date(today + 'T12:00:00Z').getUTCDay()
    const start = addDays(today, -((day + 6) % 7))
    return { start, end: addDays(start, 6) }
  }
  if (preset === 'This year')
    return { start: today.slice(0, 4) + '-01-01', end: today.slice(0, 4) + '-12-31' }
  const start = today.slice(0, 7) + '-01'
  const d = new Date(start + 'T12:00:00Z')
  d.setUTCMonth(d.getUTCMonth() + 1)
  return { start, end: addDays(d.toISOString().slice(0, 10), -1) }
}
export function previousRange(f: ReportFilter): ReportFilter {
  const days = Math.round((Date.parse(f.end) - Date.parse(f.start)) / 86400000) + 1
  return { ...f, start: addDays(f.start, -days), end: addDays(f.start, -1) }
}
export function validRange(start: string, end: string) {
  const valid = (d: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(d) &&
    Number.isFinite(Date.parse(d)) &&
    new Date(d).toISOString().slice(0, 10) === d
  return (
    valid(start) &&
    valid(end) &&
    start <= end &&
    Number(end.slice(0, 4)) - Number(start.slice(0, 4)) <= 10
  )
}
export const completed = (f: ReportFact) => f.status.toLowerCase() === 'completed'
export const cancelled = (f: ReportFact) =>
  ['cancelled', 'canceled'].includes(f.status.toLowerCase())
export const revenuePrice = (f: ReportFact) =>
  f.currency?.toUpperCase() === 'CHF' &&
  f.price !== null &&
  Number.isFinite(f.price) &&
  f.price >= 0
    ? Math.round(f.price * 100)
    : null
export const amount = (v: number | null) =>
  v !== null && Number.isFinite(v) && v >= 0 ? Math.round(v * 100) : null
export function packageName(service: string | null) {
  for (const p of ['Essential', 'Complete', 'Signature'])
    if (new RegExp(`^${p}(?:\\s|$)`, 'i').test(service?.trim() ?? '')) return p
  return 'Other / unclassified'
}
export function vehicleSize(size: string | null) {
  const s = size?.trim().toLowerCase()
  if (s && ['s', 'compact'].includes(s)) return 'S'
  if (s && ['m', 'sedan', 'estate'].includes(s)) return 'M'
  if (s && ['l+', 'xl', 'suv'].includes(s)) return 'L+'
  return 'Unknown'
}
const aliases: [RegExp, string][] = [
  [/^(mercedes(?:[\s-]*benz)?)(?=\s|$)/i, 'Mercedes-Benz'],
  [/^(land[\s-]*rover|range[\s-]*rover)(?=\s|$)/i, 'Land Rover'],
  [/^(vw|volkswagen)(?=\s|$)/i, 'Volkswagen'],
  [/^(bmw)(?=\s|$)/i, 'BMW'],
  [/^(mini)(?=\s|$)/i, 'MINI'],
  [/^(alfa[\s-]*romeo)(?=\s|$)/i, 'Alfa Romeo'],
  [/^(aston[\s-]*martin)(?=\s|$)/i, 'Aston Martin'],
  [
    /^(audi|porsche|tesla|toyota|lexus|volvo|peugeot|renault|citro[eë]n|fiat|ford|ferrari|bentley|maserati|lamborghini|honda|hyundai|kia|nissan|skoda|škoda|seat|cupra|opel|jeep|dacia|suzuki|mazda|subaru|mitsubishi|polestar|smart|jaguar|bugatti|mclaren|rolls[\s-]*royce)(?=\s|$)/i,
    '',
  ],
]
export function brandName(make: string | null, model: string | null = null) {
  const raw = (make?.trim() || model?.trim() || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
  for (const [re, name] of aliases) {
    const m = raw.match(re)
    if (m) return name || m[1].toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
  }
  // Unknown model labels must never become invented manufacturers.
  return make?.trim()
    ? make
        .trim()
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Unknown'
}
export function modelName(f: ReportFact) {
  const brand = brandName(f.make, f.model)
  if (brand === 'Unknown') return 'Model unknown'
  let model = (f.model?.trim() || '').replace(/\s+/g, ' ')
  for (const [re] of aliases)
    if (model.match(re)) {
      model = model.replace(re, '').trim()
      break
    }
  if (brand === 'Land Rover' && /^range[\s-]*rover/i.test(f.model ?? '')) model = f.model!.trim()
  if (!model || model.toLowerCase() === (f.make ?? '').toLowerCase())
    return brand === 'Unknown' ? 'Model unknown' : `${brand} · model unknown`
  return brand === 'Unknown' ? model : `${brand} ${model}`
}
export function dimensions(f: ReportFact, filter: ReportFilter) {
  return (
    (filter.region === 'All' || f.region === filter.region) &&
    (filter.type === 'All' || f.type === filter.type)
  )
}
export function breakdown(facts: ReportFact[], key: (f: ReportFact) => string): Breakdown[] {
  const groups = new Map<string, Breakdown>()
  for (const f of facts) {
    const label = key(f),
      row = groups.get(label) ?? { label, count: 0, revenue: 0, priced: 0 }
    row.count++
    const price = completed(f) ? revenuePrice(f) : null
    if (price !== null) {
      row.revenue += price
      row.priced++
    }
    groups.set(label, row)
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}
export function reportMetrics(data: ReportData, filter: ReportFilter) {
  const all = [...new Map(data.facts.map((f) => [f.id, f])).values()]
  const scoped = all.filter((f) => dimensions(f, filter))
  const facts = scoped.filter((f) => f.date >= filter.start && f.date <= filter.end)
  const done = facts.filter(completed),
    priced = done.filter((f) => revenuePrice(f) !== null)
  const revenue = priced.reduce((s, f) => s + revenuePrice(f)!, 0)
  const lifetime = new Map<string, number>()
  // Returning means 2+ completed bookings as of period end in the selected region/type.
  for (const f of scoped)
    if (completed(f) && f.date <= filter.end && f.customerId)
      lifetime.set(f.customerId, (lifetime.get(f.customerId) ?? 0) + 1)
  const served = new Set(done.flatMap((f) => (f.customerId ? [f.customerId] : [])))
  const returning = [...served].filter((id) => (lifetime.get(id) ?? 0) >= 2).length
  const customers = data.customers.filter(
    (c) =>
      (!c.createdOn || c.createdOn <= filter.end) &&
      (filter.region === 'All' || c.region === filter.region) &&
      (filter.type === 'All' || c.type === filter.type),
  )
  let collected = 0,
    outstanding = 0,
    paymentKnown = 0,
    outstandingKnown = 0
  for (const f of done) {
    if (f.currency?.toUpperCase() !== 'CHF') continue
    const price = revenuePrice(f)
    // Never infer an imported payment from a paid label without a numerical amount.
    const paid = f.imported
      ? amount(f.amountPaid)
      : f.paid === true
        ? price
        : f.paid === false
          ? 0
          : null
    const balance = f.imported
      ? amount(f.balanceDue)
      : f.paid === false
        ? price
        : f.paid === true
          ? 0
          : null
    if (paid !== null) {
      collected += paid
      paymentKnown++
    }
    if (balance !== null) {
      outstanding += balance
      outstandingKnown++
    }
  }
  // Cash dates are a separate series, never substituted with service dates.
  const cashFacts = scoped.filter(
    (f) =>
      f.paidOn &&
      f.paidOn >= filter.start &&
      f.paidOn <= filter.end &&
      f.currency?.toUpperCase() === 'CHF' &&
      amount(f.amountPaid) !== null,
  )
  return {
    facts,
    done,
    priced,
    revenue,
    aov: average(revenue, priced.length),
    returning,
    served: served.size,
    repeatRate: percent(returning, served.size),
    customers,
    newCustomers: customers.filter((c) => c.createdOn && c.createdOn >= filter.start).length,
    unknownCustomerDates: customers.filter((c) => !c.createdOn).length,
    cancelled: facts.filter(cancelled).length,
    cancelRate: percent(facts.filter(cancelled).length, facts.length),
    collected,
    outstanding,
    paymentKnown,
    outstandingKnown,
    datedCash: cashFacts.reduce((sum, f) => sum + amount(f.amountPaid)!, 0),
    cashFacts,
    uniqueVehicles: new Set(done.flatMap((f) => (f.vehicleId ? [f.vehicleId] : []))).size,
    missingVehicles: done.filter((f) => !f.vehicleId).length,
    plannedMinutes: facts
      .filter((f) => !cancelled(f) && !['rejected', 'no-show'].includes(f.status.toLowerCase()))
      .reduce((s, f) => s + (f.minutes && f.minutes > 0 ? f.minutes : 0), 0),
  }
}
export function trend(facts: ReportFact[], filter: ReportFilter) {
  const days = (Date.parse(filter.end) - Date.parse(filter.start)) / 86400000 + 1
  const step = days > 100 ? 30 : days > 35 ? 7 : 1
  const bucket = (d: string) =>
    addDays(
      filter.start,
      Math.floor((Date.parse(d) - Date.parse(filter.start)) / 86400000 / step) * step,
    )
  const result = new Map<string, { date: string; bookings: number; revenue: number }>()
  for (let date = filter.start; date <= filter.end; date = addDays(date, 1)) {
    const k = bucket(date)
    if (!result.has(k)) result.set(k, { date: k, bookings: 0, revenue: 0 })
  }
  for (const f of facts) {
    const row = result.get(bucket(f.date))
    if (row) {
      row.bookings++
      if (completed(f)) row.revenue += revenuePrice(f) ?? 0
    }
  }
  return [...result.values()]
}
