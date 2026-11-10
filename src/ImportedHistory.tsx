import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { Select } from './Select'
import { RegionBadge } from './RegionBadge'
import type { Customer, ImportedBooking, Region } from './model'
import './ImportedHistory.css'

export const importedMoney = (price: number | null, currency: string | null) =>
  price == null
    ? 'Not recorded'
    : `${currency ?? 'Currency unknown'} ${price.toLocaleString('en-CH')}`
const dateLabel = (date: string) =>
  new Date(date + 'T12:00:00Z').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
export function ImportedHistory({
  records,
  customers,
  region = 'All regions',
  compact = false,
  onCustomer,
}: {
  records: ImportedBooking[]
  customers: Customer[]
  region?: Region | 'All regions'
  compact?: boolean
  onCustomer?: (id: string) => void
}) {
  const [query, setQuery] = useState(''),
    [status, setStatus] = useState('All statuses')
  const [page, setPage] = useState(0),
    [selected, setSelected] = useState<ImportedBooking | null>(null)
  const filtered = useMemo(
    () =>
      records
        .filter(
          (b) =>
            (region === 'All regions' || b.region === region) &&
            (status === 'All statuses' || b.status === status) &&
            [
              customers.find((c) => c.id === b.customerId)?.name,
              b.vehicleLabel,
              b.service,
              b.sourceId,
              b.date,
              b.notes,
            ]
              .join(' ')
              .toLowerCase()
              .includes(query.toLowerCase()),
        )
        .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)),
    [records, customers, region, status, query],
  )
  const pages = Math.max(1, Math.ceil(filtered.length / 25)),
    current = Math.min(page, pages - 1)
  const rows = filtered.slice(current * 25, current * 25 + 25)
  return (
    <section
      className={`imported-history ${compact ? 'compact' : ''}`}
      aria-label="vcita appointment history"
    >
      <header className="imported-heading">
        <div>
          <h3>
            vcita history <span>{records.length}</span>
          </h3>
          <p>Original visits, prices and payment statuses · Read only</p>
        </div>
      </header>
      <div className="imported-toolbar">
        <label className="imported-search">
          <Search size={15} />
          <input
            aria-label="Search vcita history"
            placeholder="Search visits…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(0)
            }}
          />
        </label>
        <Select
          aria-label="vcita status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(0)
          }}
        >
          <option>All statuses</option>
          {[...new Set(records.map((b) => b.status))].sort().map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
      </div>
      {selected && (
        <section className="imported-detail" aria-label="Original vcita booking">
          <header>
            <strong>{selected.service}</strong>
            <button
              type="button"
              className="icon-btn"
              aria-label="Close vcita details"
              onClick={() => setSelected(null)}
            >
              <X size={16} />
            </button>
          </header>
          <p>
            {dateLabel(selected.date)} · {selected.time} · {selected.vehicleLabel}
          </p>
          <p>
            <RegionBadge region={selected.region ?? 'Unassigned'} /> {selected.status}
            {selected.noShow ? ' · No-show' : ''}
          </p>
          <dl>
            <div>
              <dt>Price</dt>
              <dd>{importedMoney(selected.price, selected.currency)}</dd>
            </div>
            <div>
              <dt>Payment in vcita</dt>
              <dd>{selected.paymentStatus ?? 'Not recorded'}</dd>
            </div>
            <div>
              <dt>Amount paid</dt>
              <dd>{importedMoney(selected.amountPaid, selected.currency)}</dd>
            </div>
            <div>
              <dt>Balance in vcita</dt>
              <dd>{importedMoney(selected.balanceDue, selected.currency)}</dd>
            </div>
          </dl>
          {selected.address && <p>{selected.address}</p>}
          {selected.notes && <p className="imported-notes">{selected.notes}</p>}
          <small>vcita reference: {selected.sourceId}</small>
        </section>
      )}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              {!compact && <th>Customer</th>}
              <th>Visit</th>
              <th>Status</th>
              <th>Price</th>
              <th>Payment in vcita</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id}>
                <td>
                  {dateLabel(b.date)}
                  <span className="sub">
                    {b.time} · {b.region ?? 'Unknown region'}
                  </span>
                </td>
                {!compact && (
                  <td>
                    <button className="cell-link" onClick={() => onCustomer?.(b.customerId)}>
                      {customers.find((c) => c.id === b.customerId)?.name ?? 'Customer'}
                    </button>
                  </td>
                )}
                <td>
                  <button className="cell-link" onClick={() => setSelected(b)}>
                    {b.service}
                  </button>
                  <span className="sub">{b.vehicleLabel}</span>
                </td>
                <td>
                  <span className={`imported-status ${b.status}`}>{b.status}</span>
                  {b.noShow && <span className="sub">No-show</span>}
                </td>
                <td>{importedMoney(b.price, b.currency)}</td>
                <td>{b.paymentStatus ?? 'Not recorded'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <p className="imported-empty">No matching visits.</p>}
      <footer>
        <span>{filtered.length} visits · Europe/Zurich</span>
        <div>
          <button
            className="icon-btn"
            aria-label="Previous vcita page"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            <ChevronLeft size={16} />
          </button>
          <span>
            {current + 1} / {pages}
          </span>
          <button
            className="icon-btn"
            aria-label="Next vcita page"
            disabled={current >= pages - 1}
            onClick={() => setPage(current + 1)}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </footer>
    </section>
  )
}
