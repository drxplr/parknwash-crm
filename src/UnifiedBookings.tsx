import { ActualTimeLabel } from './WorkTime'
import { formatWorkTime } from './workTimeModel'
import { useState } from 'react'
import { ChevronRight, X } from 'lucide-react'
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
          <dd>{b.paymentStatus ?? 'Not recorded'}</dd>
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
  today = swissToday(),
  onOpenLive,
  onOpenImported,
  onCustomer,
}: {
  entries: BookingEntry[]
  grouped?: boolean
  today?: string
  store: Store
  onOpenLive: (id: string) => void
  onOpenImported?: (booking: ImportedBooking) => void
  onCustomer?: (id: string) => void
}) {
  const [selected, setSelected] = useState<ImportedBooking | null>(null)
  const [sort, setSort] = useState('newest')
  const sorted = sortBookingEntries(entries, sort)
  const groups = [
    { key: 'upcoming' as const, label: 'Upcoming & active' },
    { key: 'past' as const, label: 'Past & completed' },
    { key: 'cancelled' as const, label: 'Cancelled & no-shows' },
  ]
    .map((g) => ({ ...g, rows: sorted.filter((b) => bookingBucket(b, today) === g.key) }))
    .filter((g) => g.rows.length)
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
                <span
                  className={`unified-status status-${b.status.toLowerCase().replaceAll(' ', '-')}`}
                >
                  {b.status}
                </span>
              </td>
              <td className="align-right">
                {entryMoney(b)}
                <span className="sub">
                  {b.payment}
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
    <div className="unified-bookings">
      {selected && <ImportedVisitDetails booking={selected} onClose={() => setSelected(null)} />}
      {grouped ? (
        <>
          <div className="booking-list-sort">
            <span>Grouped by booking state</span>
            <label>
              Sort{' '}
              <Select
                aria-label="Sort bookings"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </Select>
            </label>
          </div>
          {groups.map((g) =>
            g.key === 'upcoming' ? (
              <section className="booking-list-group" key={g.key} aria-label={g.label}>
                <h3>
                  {g.label} <span className="count-pill">{g.rows.length}</span>
                </h3>
                {table(g.rows)}
              </section>
            ) : (
              <details
                key={g.key}
                className="booking-list-group"
                open={g.key === 'past' || groups.length === 1}
              >
                <summary>
                  {g.label} <span className="count-pill">{g.rows.length}</span>
                </summary>
                {table(g.rows)}
              </details>
            ),
          )}
        </>
      ) : (
        table(sorted)
      )}
      {!entries.length && <p className="operation-caption">No bookings in this period.</p>}
    </div>
  )
}
