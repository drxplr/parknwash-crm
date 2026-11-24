import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown, Info } from 'lucide-react'
import { completed, previousRange, revenuePrice, trend } from './reportModel'
import type { Breakdown, ReportFact, ReportFilter } from './reportModel'
export const ReportComparison = createContext(false)
export const chf = (c: number | null) =>
  c === null ? '—' : `CHF ${(c / 100).toLocaleString('en-CH', { maximumFractionDigits: 2 })}`
export const number = (n: number | null) =>
  n === null ? '—' : n.toLocaleString('en-CH', { maximumFractionDigits: 1 })
export const rate = (n: number | null) => (n === null ? '—' : `${number(n)}%`)
export function Hint({ text }: { text: string }) {
  return (
    <span className="report-hint" tabIndex={0} aria-label={text}>
      <Info size={14} />
      <span role="tooltip">{text}</span>
    </span>
  )
}
export function Change({
  now,
  before,
  unit = '',
}: {
  now: number | null
  before: number | null
  unit?: string
}) {
  const compare = useContext(ReportComparison)
  if (!compare) return null
  if (now === null || before === null) return <small>Comparison unavailable</small>
  const diff = now - before
  return (
    <small className="report-change">
      {diff === 0
        ? 'No change'
        : unit === 'pp'
          ? `${diff > 0 ? '+' : ''}${number(diff)} pp`
          : before === 0
            ? 'No previous baseline'
            : `${diff > 0 ? '+' : ''}${number((diff / Math.abs(before)) * 100)}%`}{' '}
      <span>vs previous</span>
    </small>
  )
}
export function Kpi({
  label,
  value,
  now,
  before,
  hint,
  unit,
}: {
  label: string
  value: string
  now: number | null
  before: number | null
  hint: string
  unit?: string
}) {
  return (
    <div className="report-kpi">
      <span>
        {label}
        <Hint text={hint} />
      </span>
      <strong>{value}</strong>
      <Change now={now} before={before} unit={unit} />
    </div>
  )
}
export function Panel({
  title,
  children,
  note,
}: {
  title: string
  children: ReactNode
  note?: string
}) {
  return (
    <section className="report-panel">
      <h2>
        {title}
        {note && <Hint text={note} />}
      </h2>
      {children}
    </section>
  )
}
export function ReportDetails({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="report-details">
      <summary>
        {title}
        <ChevronDown size={16} />
      </summary>
      <div className="report-details-body">{children}</div>
    </details>
  )
}
export function Empty({ text = 'No matching data in this period.' }: { text?: string }) {
  return <p className="report-empty">{text}</p>
}
export function Bars({
  rows,
  previous = [],
  money = false,
  limit,
}: {
  rows: Breakdown[]
  previous?: Breakdown[]
  money?: boolean
  limit?: number
}) {
  const compare = useContext(ReportComparison)
  const items = [
    ...rows,
    ...(compare ? previous : [])
      .filter((p) => !rows.some((r) => r.label === p.label))
      .map((p) => ({ label: p.label, count: 0, revenue: 0, priced: 0 })),
  ]
    .sort((a, b) => (money ? b.revenue - a.revenue : b.count - a.count))
    .slice(0, limit)
  const value = (r: Breakdown) => (money ? r.revenue : r.count)
  const max = Math.max(1, ...items.map(value))
  return !items.length ? (
    <Empty />
  ) : (
    <ul className="report-bars">
      {items.map((r) => {
        const prev = previous.find((p) => p.label === r.label)
        return (
          <li key={r.label}>
            <div>
              <span>{r.label}</span>
              <strong>
                {money ? chf(r.count > 0 && r.priced === 0 ? null : r.revenue) : number(r.count)}
              </strong>
            </div>
            <div className="report-bar-track">
              <span style={{ width: `${Math.max(0, (value(r) / max) * 100)}%` }} />
            </div>
            {compare && (
              <small>
                Previous:{' '}
                {money
                  ? chf(prev && prev.count > 0 && prev.priced === 0 ? null : (prev?.revenue ?? 0))
                  : number(prev?.count ?? 0)}
              </small>
            )}
          </li>
        )
      })}
    </ul>
  )
}
export function DataTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  const compare = useContext(ReportComparison)
  const visible = headers
    .map((h, i) => (compare || !h.startsWith('Previous') ? i : -1))
    .filter((i) => i >= 0)
  rows = rows.map((row) => visible.map((i) => row[i]))
  headers = visible.map((i) => headers[i])
  return !rows.length ? (
    <Empty />
  ) : (
    <div
      className="report-table-scroll"
      tabIndex={0}
      role="region"
      aria-label={`${headers[0]} breakdown`}
    >
      <table className="report-table">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((c, j) =>
                j === 0 ? (
                  <th key={j} scope="row">
                    {c}
                  </th>
                ) : (
                  <td key={j}>{c}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
export function TrendChart({
  facts,
  prevFacts,
  filter,
  money = false,
}: {
  facts: ReportFact[]
  prevFacts: ReportFact[]
  filter: ReportFilter
  money?: boolean
}) {
  const compare = useContext(ReportComparison)
  const comparisonFacts = compare ? prevFacts : []
  const current = trend(facts, filter),
    prev = compare ? trend(prevFacts, previousRange(filter)) : []
  // Equal-width bins relative to each period start preserve equivalent-day comparisons.
  const value = (r: (typeof current)[number]) => (money ? r.revenue : r.bookings)
  const max = Math.max(money ? 100 : 1, ...current.map(value), ...prev.map(value))
  const points = (rows: typeof current) =>
    rows
      .map(
        (r, i) =>
          `${36 + (i * 628) / Math.max(1, rows.length - 1)},${152 - (value(r) / max) * 130}`,
      )
      .join(' ')
  if (
    money &&
    ![...facts, ...comparisonFacts].some((f) => completed(f) && revenuePrice(f) !== null)
  )
    return <Empty text="No completed services with known CHF prices." />
  return !facts.length && !comparisonFacts.length ? (
    <Empty />
  ) : (
    <>
      {compare && (
        <div className="report-chart-legend">
          <span>● This period</span>
          <span>┄ Previous period</span>
        </div>
      )}
      <svg
        className="report-trend"
        viewBox="0 0 700 180"
        role="img"
        aria-label={`${money ? 'Revenue in CHF' : 'Booking count'} over time. Full values in table below.`}
      >
        {[0, 0.5, 1].map((k) => (
          <g key={k}>
            <line x1="36" x2="674" y1={152 - k * 130} y2={152 - k * 130} stroke="#E5E5E5" />
            <text x="1" y={156 - k * 130}>
              {new Intl.NumberFormat('en-CH', {
                notation: 'compact',
                maximumFractionDigits: 1,
              }).format(money ? (max * k) / 100 : max * k)}
            </text>
          </g>
        ))}
        {compare && (
          <polyline
            points={points(prev)}
            fill="none"
            stroke="#737373"
            strokeDasharray="4 5"
            strokeWidth="2"
          />
        )}
        {money ? (
          <>
            <polyline points={points(current)} fill="none" stroke="#0066FF" strokeWidth="2.5" />
            {current.length === 1 && (
              <circle cx="36" cy={152 - (value(current[0]) / max) * 130} r="4" fill="#0066FF" />
            )}
          </>
        ) : (
          current.map((r, i) => (
            <rect
              key={r.date}
              x={32 + (i * 628) / Math.max(1, current.length - 1)}
              y={152 - (value(r) / max) * 130}
              width={Math.min(18, 480 / current.length)}
              height={(value(r) / max) * 130}
              rx="2"
              fill="#0066FF"
            >
              <title>
                {r.date}: {r.bookings} bookings
              </title>
            </rect>
          ))
        )}
        <text x="36" y="176">
          {new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(
            new Date(filter.start + 'T12:00Z'),
          )}
        </text>
        <text x="674" y="176" textAnchor="end">
          {new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(
            new Date(filter.end + 'T12:00Z'),
          )}
        </text>
      </svg>
      <details className="report-chart-data">
        <summary>View chart data</summary>
        <DataTable
          headers={['Period', money ? 'Revenue' : 'Bookings', 'Previous period', 'Previous value']}
          rows={current.map((r, i) => [
            r.date,
            money ? chf(r.revenue) : r.bookings,
            prev[i]?.date ?? '—',
            prev[i] ? (money ? chf(prev[i].revenue) : prev[i].bookings) : '—',
          ])}
        />
      </details>
    </>
  )
}
export function Matrix({
  facts,
  previousFacts,
  rows,
  cols,
  rowKey,
  colKey,
}: {
  facts: ReportFact[]
  previousFacts: ReportFact[]
  rows: string[]
  cols: string[]
  rowKey: (f: ReportFact) => string
  colKey: (f: ReportFact) => string
}) {
  const compare = useContext(ReportComparison)
  return (
    <DataTable
      headers={['Completed washes', ...cols]}
      rows={rows.map((r) => [
        r,
        ...cols.map((c) => (
          <span className="report-matrix-value">
            {facts.filter((f) => rowKey(f) === r && colKey(f) === c).length}
            {compare && (
              <small>
                prev {previousFacts.filter((f) => rowKey(f) === r && colKey(f) === c).length}
              </small>
            )}
          </span>
        )),
      ])}
    />
  )
}
