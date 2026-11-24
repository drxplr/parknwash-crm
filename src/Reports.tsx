import {
  ReportComparison,
  ReportDetails,
  Hint,
  Kpi,
  Panel,
  Bars,
  DataTable,
  TrendChart,
  Matrix,
  chf,
  number,
  rate,
} from './ReportComponents'
import { useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { PageHeader } from './PageHeader'
import { Select } from './Select'
import { buildBookingEntries } from './bookingEntries'
import { dayLabel } from './model'
import type { Store } from './model'
import {
  average,
  brandName,
  breakdown,
  modelName,
  packageName,
  percent,
  presetRange,
  previousRange,
  reportMetrics,
  reportTabs,
  validRange,
  vehicleSize,
} from './reportModel'
import type { ReportData, ReportFact, ReportFilter, ReportsApi, ReportTab } from './reportModel'
import './Reports.css'
const typeLabel = (s: string | null) =>
  s === 'Business' ? 'B2B' : s === 'Private' ? 'Private' : 'Unclassified'
const regionLabel = (f: ReportFact) => f.region || 'Unassigned'
const packageLabel = (f: ReportFact) => packageName(f.service)
const brandLabel = (f: ReportFact) => brandName(f.make, f.model)
function demoData(store: Store): ReportData {
  return {
    customers: store.customers.map((c) => ({
      id: c.id,
      type: c.type,
      region: c.region,
      createdOn: null,
    })),
    facts: buildBookingEntries(store).map((b) => {
      const v = store.vehicles.find((v) => v.id === (b.live?.vehicleId ?? b.imported?.vehicleId))
      return {
        id: b.id,
        customerId: b.customer.id || null,
        vehicleId: v?.id ?? (b.imported?.vehicleId || null),
        date: b.date,
        region: b.region ?? null,
        type: b.customer.type,
        service: b.service,
        status: b.status,
        make: null,
        model: v?.model ?? b.vehicleLabel,
        size: v?.size ?? null,
        price: b.price,
        currency: b.currency,
        paid: b.live?.paid ?? null,
        amountPaid: b.imported?.amountPaid ?? null,
        balanceDue: b.imported?.balanceDue ?? null,
        paidOn: null,
        paymentStatus: b.payment,
        minutes: b.durationKnown ? b.duration : null,
        imported: !!b.imported,
      }
    }),
  }
}
export function Reports({ api, store }: { api?: ReportsApi; store: Store }) {
  const [tab, setTab] = useState<ReportTab>('Overview'),
    [preset, setPreset] = useState('This month')
  const [compare, setCompare] = useState(false)
  const [allCustomers, setAllCustomers] = useState(false),
    [allBrands, setAllBrands] = useState(false)
  const [overviewChart, setOverviewChart] = useState('Revenue')
  const [filter, setFilter] = useState<ReportFilter>({
    ...presetRange('This month'),
    region: 'All',
    type: 'All',
  })
  const [result, setResult] = useState<ReportData | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(!!api),
    [refresh, setRefresh] = useState(0)
  useEffect(() => {
    if (!api) return
    let active = true
    setLoading(true)
    setError('')
    setResult(null)
    void api()
      .then((data) => {
        if (active) setResult(data)
      })
      .catch(() => {
        if (active)
          setError('Reports could not load. Check your connection and access, then retry.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [api, refresh])
  const data = useMemo(() => (api ? result : demoData(store)), [api, result, store])
  const rangeValid = validRange(filter.start, filter.end)
  const report = useMemo(
    () => (data && rangeValid ? reportMetrics(data, filter) : null),
    [data, filter, rangeValid],
  )
  const previous = useMemo(
    () => (data && rangeValid ? reportMetrics(data, previousRange(filter)) : null),
    [data, filter, rangeValid],
  )
  const set = (field: keyof ReportFilter, value: string) =>
    setFilter((f) => ({ ...f, [field]: value }))
  const groups = (key: (f: ReportFact) => string, all = false) =>
    breakdown((all ? report?.facts : report?.done) ?? [], key)
  const prevGroups = (key: (f: ReportFact) => string, all = false) =>
    breakdown((all ? previous?.facts : previous?.done) ?? [], key)
  const bars = (
    key: (f: ReportFact) => string,
    options: { money?: boolean; limit?: number; all?: boolean } = {},
  ) => <Bars rows={groups(key, options.all)} previous={prevGroups(key, options.all)} {...options} />
  const packageRows = [
    'Essential',
    'Complete',
    'Signature',
    ...([...(report?.done ?? []), ...(previous?.done ?? [])].some(
      (f) => packageLabel(f) === 'Other / unclassified',
    )
      ? ['Other / unclassified']
      : []),
  ]
  const brands = groups(brandLabel)
    .slice(0, 10)
    .map((r) => r.label)
  return (
    <ReportComparison.Provider value={compare}>
      <div className="reports-workspace">
        <PageHeader
          title="Reports"
          meta="CHF"
          actions={
            <button
              className="icon-btn"
              aria-label="Refresh reports"
              title="Refresh"
              onClick={() => setRefresh((n) => n + 1)}
              disabled={loading}
            >
              <RefreshCw size={15} />
            </button>
          }
          filters={
            <>
              <label className="report-filter">
                <Select
                  aria-label="Report date range"
                  value={preset}
                  onChange={(e) => {
                    setPreset(e.target.value)
                    if (e.target.value !== 'Custom')
                      setFilter((f) => ({ ...f, ...presetRange(e.target.value) }))
                  }}
                >
                  {['Today', 'This week', 'This month', 'This year', 'Custom'].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
              </label>
              <label className="report-filter">
                <Select
                  aria-label="Report region"
                  value={filter.region}
                  onChange={(e) => set('region', e.target.value)}
                >
                  {['All', 'Geneva', 'Ticino'].map((s) => (
                    <option key={s} value={s}>
                      {s === 'All' ? 'All regions' : s}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="report-filter">
                <Select
                  aria-label="Report customer type"
                  value={filter.type}
                  onChange={(e) => set('type', e.target.value)}
                >
                  <option value="All">All types</option>
                  <option value="Private">Private</option>
                  <option value="Business">B2B</option>
                </Select>
              </label>
            </>
          }
        />
        <div className="report-period-row">
          {preset === 'Custom' ? (
            <>
              <label>
                From{' '}
                <input
                  type="date"
                  value={filter.start}
                  onChange={(e) => set('start', e.target.value)}
                />
              </label>
              <label>
                To{' '}
                <input
                  type="date"
                  value={filter.end}
                  onChange={(e) => set('end', e.target.value)}
                />
              </label>
            </>
          ) : (
            <span>
              {dayLabel(filter.start)} —{' '}
              {dayLabel(filter.end, { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          )}
          <label className="report-compare-toggle">
            <input
              type="checkbox"
              aria-label="Compare"
              checked={compare}
              onChange={(e) => setCompare(e.target.checked)}
            />
            Compare
            {compare && rangeValid && (
              <Hint
                text={`Previous period: ${dayLabel(previousRange(filter).start)} – ${dayLabel(previousRange(filter).end)}. Same filters and number of days.`}
              />
            )}
          </label>
        </div>
        <nav className="selection-tabs" aria-label="Report sections">
          {reportTabs.map((t) => (
            <button key={t} aria-pressed={t === tab} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </nav>
        {!rangeValid && (
          <p role="alert" className="report-error">
            Choose a valid date range, up to 10 years.
          </p>
        )}
        {loading && (
          <p role="status" className="report-empty">
            Loading reports…
          </p>
        )}
        {error && (
          <div role="alert" className="report-error">
            {error}{' '}
            <button className="btn" onClick={() => setRefresh((n) => n + 1)}>
              Retry
            </button>
          </div>
        )}
        {!loading && !error && report && previous && (
          <>
            {report.facts.length === 0 && (
              <div className="report-notice">
                No bookings in this period. Try a different date range.
              </div>
            )}
            {((tab !== 'Bookings' && report.done.length > report.priced.length) ||
              (tab === 'Revenue' && report.done.length > report.paymentKnown)) && (
              <div className="report-coverage">
                <span>Incomplete financial data</span>
                <Hint
                  text={`${report.priced.length}/${report.done.length} completed washes have valid CHF prices. Payment amounts are known for ${report.paymentKnown}/${report.done.length}. Figures include known amounts only.`}
                />
              </div>
            )}
            <div className="report-kpis">
              {(tab === 'Overview' || tab === 'Revenue') && (
                <>
                  <Kpi
                    label="Revenue"
                    value={chf(report.revenue)}
                    now={report.revenue}
                    before={previous.revenue}
                    hint="Sum of known non-negative historical CHF booking prices for Completed services on their Zurich service date. Includes complimentary services; cancelled, no-show, rejected and non-CHF records excluded. This is not cash received."
                  />
                  {tab === 'Overview' ? (
                    <Kpi
                      label="Completed washes"
                      value={number(report.done.length)}
                      now={report.done.length}
                      before={previous.done.length}
                      hint="Completed bookings, including imported visits. One booking counts once regardless of contacts or assigned staff."
                    />
                  ) : (
                    <>
                      <Kpi
                        label="Recorded payments"
                        value={report.paymentKnown ? chf(report.collected) : '—'}
                        now={report.paymentKnown ? report.collected : null}
                        before={previous.paymentKnown ? previous.collected : null}
                        hint={`Payments attributed to completed services in this period, not cash flow. Known for ${report.paymentKnown} of ${report.done.length} washes. Imported numeric amounts include partial payments; live Paid means full booking price.`}
                      />
                      <Kpi
                        label="Outstanding"
                        value={report.outstandingKnown ? chf(report.outstanding) : '—'}
                        now={report.outstandingKnown ? report.outstanding : null}
                        before={previous.outstandingKnown ? previous.outstanding : null}
                        hint={`Known balance due on completed services in this period. Coverage: ${report.outstandingKnown}/${report.done.length}. Unknown balances are excluded, not assumed zero.`}
                      />
                    </>
                  )}
                  <Kpi
                    label="Avg. booking"
                    value={chf(report.aov)}
                    now={report.aov}
                    before={previous.aov}
                    hint={`Earned revenue divided by ${report.priced.length} completed bookings with valid CHF prices. Missing or foreign-currency prices are excluded from both numerator and denominator.`}
                  />
                  {tab === 'Overview' && (
                    <Kpi
                      label="Repeat customers"
                      value={rate(report.repeatRate)}
                      now={report.repeatRate}
                      before={previous.repeatRate}
                      unit="pp"
                      hint="Share of customers served in this period with at least 2 completed bookings up to period end under the selected region/type filters. B2B company counts once."
                    />
                  )}
                </>
              )}
              {tab === 'Bookings' && (
                <>
                  <Kpi
                    label="Total bookings"
                    value={number(report.facts.length)}
                    now={report.facts.length}
                    before={previous.facts.length}
                    hint="All statuses, by scheduled service date. Rescheduling moves the same booking to its new date; no new booking is counted."
                  />
                  <Kpi
                    label="Completed"
                    value={number(report.done.length)}
                    now={report.done.length}
                    before={previous.done.length}
                    hint="Only Completed status; a past date alone does not imply completion."
                  />
                  <Kpi
                    label="Cancelled"
                    value={number(report.cancelled)}
                    now={report.cancelled}
                    before={previous.cancelled}
                    hint="Cancelled bookings only. Rejected and No-show remain separate statuses."
                  />
                  <Kpi
                    label="Cancellation rate"
                    value={rate(report.cancelRate)}
                    now={report.cancelRate}
                    before={previous.cancelRate}
                    unit="pp"
                    hint="Cancelled bookings / all bookings in the selected service-date period."
                  />
                </>
              )}
              {tab === 'Customers' && (
                <>
                  <Kpi
                    label="Total customers"
                    value={number(report.customers.length)}
                    now={report.customers.length}
                    before={previous.customers.length}
                    hint="Customer/company records as of period end, filtered by current customer region/type. Contacts and fleet vehicles do not add customers. Includes records with unknown creation dates in both periods."
                  />
                  <Kpi
                    label="New customers"
                    value={
                      report.unknownCustomerDates
                        ? report.newCustomers
                          ? `${number(report.newCustomers)}+`
                          : '—'
                        : number(report.newCustomers)
                    }
                    now={report.unknownCustomerDates ? null : report.newCustomers}
                    before={previous.unknownCustomerDates ? null : previous.newCustomers}
                    hint={`Original vcita creation calendar dates or CRM creation dates. ${report.unknownCustomerDates} imported customer creation dates are unknown and excluded; this is a lower bound, not all new customers.`}
                  />
                  <Kpi
                    label="Returning customers"
                    value={number(report.returning)}
                    now={report.returning}
                    before={previous.returning}
                    hint="Customers with a completed service in this period and at least 2 completed bookings through period end under selected filters."
                  />
                  <Kpi
                    label="Repeat customers"
                    value={rate(report.repeatRate)}
                    now={report.repeatRate}
                    before={previous.repeatRate}
                    unit="pp"
                    hint="Returning customers / unique customers served in this period. Not defined when no customers were served."
                  />
                </>
              )}
              {(tab === 'Vehicles' || tab === 'Services') && (
                <>
                  <Kpi
                    label="Completed washes"
                    value={number(report.done.length)}
                    now={report.done.length}
                    before={previous.done.length}
                    hint="Completed service records; includes imported bookings once."
                  />
                  <Kpi
                    label="Revenue"
                    value={chf(report.revenue)}
                    now={report.revenue}
                    before={previous.revenue}
                    hint="Known historical CHF booking prices for completed services, never today's catalogue tariff."
                  />
                  {tab === 'Vehicles' && (
                    <Kpi
                      label="Unique vehicles"
                      value={number(report.uniqueVehicles)}
                      now={report.uniqueVehicles}
                      before={previous.uniqueVehicles}
                      hint={`Distinct confirmed linked vehicle IDs. One vehicle washed ten times counts once. ${report.missingVehicles} washes have no usable vehicle ID and are excluded.`}
                    />
                  )}
                  <Kpi
                    label="Avg. booking"
                    value={chf(report.aov)}
                    now={report.aov}
                    before={previous.aov}
                    hint="Earned revenue / completed bookings with known CHF prices; complimentary services included."
                  />
                </>
              )}
            </div>
            {tab === 'Overview' && (
              <>
                <section className="report-panel report-primary-chart">
                  <div className="report-panel-heading">
                    <h2>{overviewChart === 'Revenue' ? 'Revenue' : 'Bookings'} over time</h2>
                    <div className="selection-tabs" aria-label="Overview chart">
                      {['Revenue', 'Bookings'].map((t) => (
                        <button
                          key={t}
                          aria-pressed={overviewChart === t}
                          onClick={() => setOverviewChart(t)}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <TrendChart
                    money={overviewChart === 'Revenue'}
                    facts={report.facts}
                    prevFacts={previous.facts}
                    filter={filter}
                  />
                </section>
                <ReportDetails title="More insights">
                  <div className="report-operations">
                    <span>{number(report.plannedMinutes / 60)} scheduled hours</span>
                    <span>{report.cancelled} cancelled</span>
                    <Hint text="Scheduled service hours are elapsed booking duration, not staff person-hours or actual work time." />
                  </div>
                  <div className="report-grid">
                    <Panel title="Revenue by region">{bars(regionLabel, { money: true })}</Panel>
                    <Panel title="Top services">
                      {bars((f) => f.service || 'Unknown', { limit: 5 })}
                    </Panel>
                    <Panel title="Top car brands">{bars(brandLabel, { limit: 5 })}</Panel>
                  </div>
                </ReportDetails>
              </>
            )}
            {tab === 'Revenue' && (
              <>
                <Panel title="Revenue trend">
                  <TrendChart
                    money
                    facts={report.facts}
                    prevFacts={previous.facts}
                    filter={filter}
                  />
                </Panel>
                <ReportDetails title="Payments & breakdowns">
                  <div className="report-grid">
                    <Panel
                      title="Payments by actual recorded date"
                      note="Only numeric imported payments with a recorded payment date. Current CRM Paid/Unpaid flags have no payment date. This is incomplete, not a full cash ledger."
                    >
                      <strong className="report-standalone-number">
                        {report.cashFacts.length ? chf(report.datedCash) : '—'}
                      </strong>
                      <DataTable
                        headers={['Payment date', 'Recorded amount']}
                        rows={report.cashFacts.map((f) => [
                          f.paidOn,
                          chf(Math.round(f.amountPaid! * 100)),
                        ])}
                      />
                    </Panel>
                    <Panel title="Revenue by region">{bars(regionLabel, { money: true })}</Panel>
                    <Panel title="Revenue by customer type">
                      {bars((f) => typeLabel(f.type), { money: true })}
                    </Panel>
                    <Panel title="Revenue by package">{bars(packageLabel, { money: true })}</Panel>
                  </div>
                </ReportDetails>
              </>
            )}
            {tab === 'Bookings' && (
              <>
                <Panel title="Bookings over time">
                  <TrendChart facts={report.facts} prevFacts={previous.facts} filter={filter} />
                </Panel>
                <ReportDetails title="Booking breakdowns">
                  <div className="report-grid">
                    <Panel title="Booking statuses">{bars((f) => f.status, { all: true })}</Panel>
                    <Panel title="Bookings by region">{bars(regionLabel, { all: true })}</Panel>
                    <Panel title="Bookings by service">
                      {bars((f) => f.service || 'Unknown', { all: true })}
                    </Panel>
                    <Panel title="Bookings by vehicle size">
                      {bars((f) => vehicleSize(f.size), { all: true })}
                    </Panel>
                  </div>
                </ReportDetails>
              </>
            )}
            {tab === 'Customers' && (
              <>
                <Panel
                  title="Top customers by revenue"
                  note="One row per customer/company, independent of contacts and fleet size."
                >
                  <DataTable
                    headers={['Customer', 'Washes', 'Revenue', 'Previous revenue']}
                    rows={groups((f) => f.customerId || 'Unknown')
                      .sort((a, b) => b.revenue - a.revenue)
                      .slice(0, allCustomers ? 20 : 5)
                      .map((r) => [
                        store.customers.find((c) => c.id === r.label)?.name ??
                          'Customer unavailable',
                        r.count,
                        chf(r.revenue),
                        chf(
                          prevGroups((f) => f.customerId || 'Unknown').find(
                            (p) => p.label === r.label,
                          )?.revenue ?? 0,
                        ),
                      ])}
                  />
                  {groups((f) => f.customerId || 'Unknown').length > 5 && (
                    <button
                      className="btn report-show-more"
                      onClick={() => setAllCustomers((v) => !v)}
                    >
                      {allCustomers ? 'Show top 5' : 'Show top 20'}
                    </button>
                  )}
                </Panel>
                <ReportDetails title="Customer breakdowns">
                  <div className="report-grid">
                    <Panel
                      title="Customer distribution"
                      note="Customer records as of period end. Unclassified records are kept separate."
                    >
                      <DataTable
                        headers={['Customer type', 'Customers', 'Previous']}
                        rows={['Private', 'Business', 'Unclassified'].map((type) => [
                          typeLabel(type),
                          report.customers.filter((c) => (c.type || 'Unclassified') === type)
                            .length,
                          previous.customers.filter((c) => (c.type || 'Unclassified') === type)
                            .length,
                        ])}
                      />
                    </Panel>
                    <Panel title="Revenue by customer type">
                      {bars((f) => typeLabel(f.type), { money: true })}
                    </Panel>
                  </div>
                </ReportDetails>
              </>
            )}
            {tab === 'Services' && (
              <>
                <Panel
                  title="Package comparison"
                  note="Share uses all completed bookings, including other/unclassified services. AOV excludes records without valid CHF prices."
                >
                  <DataTable
                    headers={[
                      'Package',
                      'Bookings',
                      'Revenue',
                      'Share',
                      'Average order value',
                      'Previous revenue',
                    ]}
                    rows={packageRows.map((pkg) => {
                      const r = groups(packageLabel).find((g) => g.label === pkg)
                      return [
                        pkg,
                        r?.count ?? 0,
                        chf(r?.revenue ?? 0),
                        rate(percent(r?.count ?? 0, report.done.length)),
                        chf(average(r?.revenue ?? 0, r?.priced ?? 0)),
                        chf(prevGroups(packageLabel).find((g) => g.label === pkg)?.revenue ?? 0),
                      ]
                    })}
                  />
                </Panel>
                <ReportDetails title="Package breakdowns">
                  <div className="report-grid">
                    <Panel title="Package × vehicle size">
                      <Matrix
                        facts={report.done}
                        previousFacts={previous.done}
                        rows={packageRows}
                        cols={['S', 'M', 'L+', 'Unknown']}
                        rowKey={packageLabel}
                        colKey={(f) => vehicleSize(f.size)}
                      />
                    </Panel>
                    <Panel title="Package × region">
                      <Matrix
                        facts={report.done}
                        previousFacts={previous.done}
                        rows={packageRows}
                        cols={['Geneva', 'Ticino', 'Unassigned']}
                        rowKey={packageLabel}
                        colKey={regionLabel}
                      />
                    </Panel>
                  </div>
                </ReportDetails>
              </>
            )}
            {tab === 'Vehicles' && (
              <>
                <Panel title="Top brands" note="Completed washes per brand.">
                  {bars(brandLabel, { limit: allBrands ? 10 : 5 })}
                  {groups(brandLabel).length > 5 && (
                    <button
                      className="btn report-show-more"
                      onClick={() => setAllBrands((v) => !v)}
                    >
                      {allBrands ? 'Show top 5' : 'Show top 10'}
                    </button>
                  )}
                </Panel>
                <ReportDetails title="Vehicle breakdowns">
                  <div className="report-grid">
                    <Panel title="Revenue & average order value by brand">
                      <DataTable
                        headers={['Brand', 'Revenue', 'Average order value', 'Previous revenue']}
                        rows={groups(brandLabel)
                          .sort((a, b) => b.revenue - a.revenue)
                          .map((r) => [
                            r.label,
                            chf(r.revenue),
                            chf(average(r.revenue, r.priced)),
                            chf(
                              prevGroups(brandLabel).find((p) => p.label === r.label)?.revenue ?? 0,
                            ),
                          ])}
                      />
                    </Panel>
                    <Panel title="Top 10 models">
                      <DataTable
                        headers={['Model', 'Washes', 'Revenue', 'Previous washes']}
                        rows={groups(modelName)
                          .slice(0, 10)
                          .map((r) => [
                            r.label,
                            r.count,
                            chf(r.revenue),
                            prevGroups(modelName).find((p) => p.label === r.label)?.count ?? 0,
                          ])}
                      />
                    </Panel>
                    <Panel title="Completed washes by size">
                      {bars((f) => vehicleSize(f.size))}
                    </Panel>
                    <Panel title="Brand × package preferences">
                      <Matrix
                        facts={report.done}
                        previousFacts={previous.done}
                        rows={brands}
                        cols={packageRows}
                        rowKey={brandLabel}
                        colKey={packageLabel}
                      />
                    </Panel>
                    <Panel title="Region × brand" note="Top 10 brands by completed washes.">
                      <Matrix
                        facts={report.done}
                        previousFacts={previous.done}
                        rows={brands}
                        cols={['Geneva', 'Ticino', 'Unassigned']}
                        rowKey={brandLabel}
                        colKey={regionLabel}
                      />
                    </Panel>
                  </div>
                </ReportDetails>
              </>
            )}
            <details className="report-quality">
              <summary>About these numbers</summary>
              <ul>
                <li>
                  {report.done.length - report.priced.length} completed washes excluded from CHF
                  revenue/AOV because price is missing, negative or currency is not CHF.{' '}
                  {report.done.filter((f) => f.currency && f.currency !== 'CHF').length} non-CHF
                  records are not converted.
                </li>
                <li>
                  Payment amounts known for {report.paymentKnown}/{report.done.length} completed
                  washes; balances known for {report.outstandingKnown}/{report.done.length}. Unknown
                  amounts are not zero. No refund ledger or separate discount fields exist; booking
                  price is used as recorded, with no inferred discounts or refunds.
                </li>
                <li>
                  {report.unknownCustomerDates} customers have no reliable original creation date.
                  Import timestamps are not counted as new customers; original vcita creation
                  calendar dates are used when available (source timezone is not recorded).
                </li>
                <li>
                  {report.done.filter((f) => brandLabel(f) === 'Unknown').length} washes have
                  unknown brand;{' '}
                  {report.done.filter((f) => vehicleSize(f.size) === 'Unknown').length} have unknown
                  size; {report.missingVehicles} have no vehicle ID. Vehicle characteristics and
                  customer type use current linked records; historical changes are not stored.
                </li>
                <li>
                  Periods use inclusive Zurich service dates, compared with the immediately
                  preceding equal number of calendar days. Repeat customers are evaluated as of each
                  period end. Future scheduled services remain bookings; only Completed status earns
                  revenue.
                </li>
                <li>
                  Imported and CRM bookings have separate source IDs. No fuzzy merging by
                  customer/date is performed. Paid receipts are not a transaction ledger; multiple
                  payments, refund dates and reversals need Analytics v2.
                </li>
              </ul>
            </details>
          </>
        )}
      </div>
    </ReportComparison.Provider>
  )
}
