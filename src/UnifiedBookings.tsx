import { StatusBadge, PaymentBadge } from './StatusBadge'
import { ActualTimeLabel } from './WorkTime'
import { formatWorkTime } from './workTimeModel'
import { useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { RegionBadge } from './RegionBadge'
import { Select } from './Select'
import { dayLabel, swissToday } from './model'
import type { ImportedBooking, Store } from './model'
import { entryMoney, bookingBucket, sortBookingEntries } from './bookingEntries'
import type { BookingEntry } from './bookingEntries'
import { customerColorStyle } from './customerColors'
import './UnifiedBookings.css'

export function ImportedVisitDetails({
  booking: b,
  onClose,
}: {
  booking: ImportedBooking
  onClose?: () => void
}) {
  const price = (n: number | null) =>
    n == null ? 'Not recorded' : `${b.currency ?? 'Currency unknown'} ${n.toLocaleString('en-CH')}`
  return (
    <section className="unified-visit-detail" aria-label="Imported booking details">
      <header>
        <div>
          <h2>{b.service}</h2>
          <p>Imported from vcita · Read only</p>
        </div>
        {onClose && (
          <button className="icon-btn" aria-label="Close imported details" onClick={onClose}>
            <X size={16} />
          </button>
        )}
      </header>
      <p>
        {dayLabel(b.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} ·{' '}
        {b.time} · Europe/Zurich
      </p>
      <p>
        {b.vehicleLabel} · {b.status}
        {b.noShow ? ' · No-show' : ''}
      </p>
      <dl>
        <div>
          <dt>Duration</dt>
          <dd>{b.duration ? `${b.duration} min` : 'Not recorded'}</dd>
        </div>
        <div>
          <dt>Region</dt>
          <dd>{b.region ?? 'Not recorded'}</dd>
        </div>
        <div>
          <dt>Team</dt>
          <dd>Not recorded in import</dd>
        </div>
        <div>
          <dt>Price</dt>
          <dd>{price(b.price)}</dd>
        </div>
        <div>
          <dt>Payment in vcita</dt>
          <dd>
            <PaymentBadge label={b.paymentStatus ?? 'Not recorded'} />
          </dd>
        </div>
        <div>
          <dt>Amount paid</dt>
          <dd>{price(b.amountPaid)}</dd>
        </div>
        <div>
          <dt>Balance in vcita</dt>
          <dd>{price(b.balanceDue)}</dd>
        </div>
      </dl>
      {b.address && <p>{b.address}</p>}
      {b.notes && <p className="unified-visit-notes">{b.notes}</p>}
      <small>vcita reference: {b.sourceId}</small>
    </section>
  )
}
export function UnifiedBookingList({
  entries,
  store,
  grouped = false,
  rangeNavigation,
  today = swissToday(),
  onOpenLive,
  onOpenImported,
  onCustomer,
}: {
  entries: BookingEntry[]
  rangeNavigation?: { label: string; unit: string; onPrevious: () => void; onNext: () => void }
  grouped?: boolean
  today?: string
  store: Store
  onOpenLive: (id: string) => void
  onOpenImported?: (booking: ImportedBooking) => void
  onCustomer?: (id: string) => void
}) {
  const [selected, setSelected] = useState<ImportedBooking | null>(null)
  const [sort, setSort] = useState('newest')
  const [bucket, setBucket] = useState<'upcoming' | 'past' | 'cancelled'>('upcoming')
  const [pagination, setPagination] = useState({ scope: '', page: 1 })
  const listTop = useRef<HTMLDivElement>(null)
  const sorted = sortBookingEntries(entries, sort)
  const groups = [
    { key: 'upcoming' as const, label: 'Active' },
    { key: 'past' as const, label: 'Past' },
    { key: 'cancelled' as const, label: 'Cancelled' },
  ].map((g) => ({ ...g, rows: sorted.filter((b) => bookingBucket(b, today) === g.key) }))

  const current = groups.find((g) => g.key === bucket)!
  const pageSize = 25
  const scope = `${bucket}:${sort}:${rangeNavigation?.label ?? ''}:${entries.map((b) => `${b.id}/${b.date}/${b.status}`).join('|')}`
  const pages = Math.max(1, Math.ceil(current.rows.length / pageSize))
  const page = pagination.scope === scope ? Math.min(pagination.page, pages) : 1
  const rows = current.rows.slice((page - 1) * pageSize, page * pageSize)
  function returnToList() {
    listTop.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
    listTop.current?.focus({ preventScroll: true })
  }
  function pageControls(position: 'top' | 'bottom') {
    if (pages === 1) return null
    return (
      <nav
        className="booking-list-pagination"
        aria-label={`${position === 'top' ? 'Top' : 'Bottom'} booking pages`}
      >
        <span aria-live="polite">
          {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, current.rows.length)} of{' '}
          {current.rows.length}
        </span>
        <div>
          <button
            className="icon-btn"
            aria-label="Previous bookings page"
            disabled={page === 1}
            onClick={() => {
              setPagination({ scope, page: page - 1 })
              if (position === 'bottom') returnToList()
            }}
          >
            <ChevronLeft size={16} />
          </button>
          <span>
            Page {page} of {pages}
          </span>
          <button
            className="icon-btn"
            aria-label="Next bookings page"
            disabled={page === pages}
            onClick={() => {
              setPagination({ scope, page: page + 1 })
              if (position === 'bottom') returnToList()
            }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </nav>
    )
  }
  function open(b: BookingEntry) {
    if (b.live) onOpenLive(b.live.id)
    else if (b.imported) (onOpenImported ?? setSelected)(b.imported)
  }
  const table = (rows: BookingEntry[]) => (
    <div className="table-scroll">
      <table className="bookings-table">
        <thead>
          <tr>
            <th>Date & time</th>
            <th>Customer / vehicle</th>
            <th>Service</th>
            <th>Work time</th>
            <th>Team</th>
            <th>Status</th>
            <th className="align-right">Amount</th>
            <th aria-label="Open details" />
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => (
            <tr
              key={b.id}
              className={bookingBucket(b, today) !== 'upcoming' ? 'booking-muted-row' : undefined}
              onClick={() => open(b)}
            >
              <td>
                <strong>{b.time}</strong>
                <span className="sub">
                  {dayLabel(b.date, { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </td>
              <td>
                {onCustomer ? (
                  <button
                    className="cell-link"
                    onClick={(e) => {
                      e.stopPropagation()
                      onCustomer(b.customer.id)
                    }}
                  >
                    <span className="client-dot" style={customerColorStyle(b.customer)} />
                    {b.customer.name}
                  </button>
                ) : (
                  <strong>{b.customer.name}</strong>
                )}
                <span className="sub">
                  {b.vehicleLabel}
                  {b.plate ? ` · ${b.plate}` : ''}
                </span>
              </td>
              <td>
                {b.service}
                <span className="sub">
                  <RegionBadge region={b.region ?? 'Unassigned'} />
                  {b.imported && <span className="unified-source">Imported · read only</span>}
                </span>
              </td>
              <td>
                <span>
                  {b.durationKnown ? `${formatWorkTime(b.duration)} planned` : 'Plan unknown'}
                </span>
                <ActualTimeLabel store={store} bookingId={b.live?.id} assigned={b.staffIds} />
              </td>
              <td>
                {b.staffIds.length ? (
                  b.staffIds
                    .map(
                      (id) =>
                        store.settings.staff.find((s) => s.id === id)?.name ?? 'Unknown member',
                    )
                    .join(', ')
                ) : (
                  <span className="muted">Unassigned</span>
                )}
              </td>
              <td>
                <StatusBadge status={b.status} />
              </td>
              <td className="align-right">
                {entryMoney(b)}
                <span className="sub">
                  <PaymentBadge label={b.payment} />
                  {b.imported ? ' · vcita' : ''}
                </span>
              </td>
              <td>
                <button
                  className="row-arrow"
                  aria-label={`Open ${b.imported ? 'imported ' : ''}booking ${b.imported?.sourceId ?? b.live?.id}`}
                >
                  <ChevronRight size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
  return (
    <div className="unified-bookings" ref={listTop} tabIndex={-1} aria-label="Booking list">
      {selected && <ImportedVisitDetails booking={selected} onClose={() => setSelected(null)} />}
      {grouped ? (
        <>
          <div className="booking-list-sort">
            <div
              className="selection-tabs booking-state-tabs"
              role="group"
              aria-label="Booking state"
            >
              {groups.map((g) => (
                <button
                  key={g.key}
                  aria-pressed={bucket === g.key}
                  onClick={() => {
                    setBucket(g.key)
                    setPagination({ scope: '', page: 1 })
                  }}
                >
                  <i className={`booking-state-dot state-${g.key}`} aria-hidden="true" />
                  {g.label}
                  <span className="count-pill">{g.rows.length}</span>
                </button>
              ))}
            </div>
            <label>
              Sort{' '}
              <Select
                aria-label="Sort bookings"
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value)
                  setPagination({ scope: '', page: 1 })
                }}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </Select>
            </label>
          </div>
          {pageControls('top')}
          <section className="booking-list-results" aria-label={`${current.label} bookings`}>
            {rows.length ? (
              table(rows)
            ) : (
              <p className="booking-list-empty">
                No {current.label.toLowerCase()} bookings in this period.
              </p>
            )}
          </section>
          {pageControls('bottom')}
          {rangeNavigation && (
            <nav className="booking-list-range" aria-label="Bottom date navigation">
              <button
                className="btn"
                onClick={() => {
                  rangeNavigation.onPrevious()
                  returnToList()
                }}
              >
                <ChevronLeft size={16} />
                Previous {rangeNavigation.unit}
              </button>
              <span>{rangeNavigation.label}</span>
              <button
                className="btn"
                onClick={() => {
                  rangeNavigation.onNext()
                  returnToList()
                }}
              >
                Next {rangeNavigation.unit}
                <ChevronRight size={16} />
              </button>
            </nav>
          )}
        </>
      ) : (
        table(sorted)
      )}
      {!grouped && !entries.length && (
        <p className="operation-caption">No bookings in this period.</p>
      )}
    </div>
  )
}
