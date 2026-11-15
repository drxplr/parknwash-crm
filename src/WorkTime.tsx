import { useState } from 'react'
import { ChevronDown, Clock3 } from 'lucide-react'
import type { Booking, Store } from './model'
import type { WorkTimeSave } from './workTimeModel'
import { bookingWorkTime, formatWorkTime } from './workTimeModel'
import './WorkTime.css'
export function WorkTimeSummary({
  bookings,
  store,
}: {
  bookings: { id: string; duration: number; staffIds: string[]; status: string }[]
  store: Store
}) {
  const planned = bookings
    .filter((b) => !['Cancelled', 'Rejected', 'No-show'].includes(b.status))
    .reduce((n, b) => n + b.duration, 0)
  const values = bookings.map((b) => bookingWorkTime(store, b.id))
  const recorded = values.filter((t) => t.entered)
  const fromPlan = recorded.filter((t) => t.source === 'planned').length
  return (
    <div className="work-time-summary" aria-label="Wash hours summary">
      <Clock3 size={16} aria-hidden="true" />
      <span>
        Planned <strong>{formatWorkTime(planned)}</strong>
      </span>
      <span>
        Recorded{' '}
        <strong>
          {recorded.length
            ? formatWorkTime(recorded.reduce((n, t) => n + t.minutes, 0))
            : 'Not entered'}
        </strong>
      </span>
      {recorded.length > 0 && (
        <small>
          {recorded.length} washes{fromPlan ? ` · ${fromPlan} from plan` : ''}
        </small>
      )}
    </div>
  )
}
export function ActualTimeLabel({
  store,
  bookingId,
}: {
  store: Store
  bookingId?: string
  assigned: string[]
}) {
  const total = bookingId ? bookingWorkTime(store, bookingId) : null
  return (
    <span className="sub work-time-label">
      {total?.source === 'planned' ? 'From plan' : 'Actual'}:{' '}
      {total?.entered ? formatWorkTime(total.minutes) : 'Not entered'}
    </span>
  )
}
function TimeField({
  bookingId,
  saved,
  onSave,
}: {
  bookingId: string
  saved?: number
  onSave?: WorkTimeSave
}) {
  const [value, setValue] = useState(saved == null ? '' : String(saved)),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const dirty = value !== (saved == null ? '' : String(saved))
  return (
    <form
      className="work-time-input-row"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!onSave || busy || !dirty) return
        const minutes = value.trim() === '' ? null : Number(value)
        if (minutes !== null && (!Number.isInteger(minutes) || minutes < 0 || minutes > 1440)) {
          setError('Enter whole minutes from 0 to 1440.')
          return
        }
        setBusy(true)
        setError('')
        try {
          await onSave(bookingId, minutes)
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Could not save time. Reload and try again.')
        } finally {
          setBusy(false)
        }
      }}
    >
      <label>
        <span>Wash duration</span>
        <span className="work-time-control">
          <input
            type="number"
            inputMode="numeric"
            min="0"
            max="1440"
            step="1"
            placeholder="—"
            aria-label="Actual wash duration in minutes"
            value={value}
            readOnly={!onSave}
            disabled={busy}
            onChange={(e) => setValue(e.target.value)}
          />
          <span>min</span>
        </span>
      </label>
      {onSave && dirty && (
        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}
export function WorkTimeEditor({
  booking,
  store,
  onSave,
}: {
  booking: Booking
  store: Store
  onSave?: WorkTimeSave
}) {
  const entry = store.bookingWorkTime?.find((t) => t.bookingId === booking.id)
  return (
    <details className="work-time-editor">
      <summary>
        <Clock3 size={16} aria-hidden="true" />
        <span>Work time</span>
        <span className="work-time-preview">
          Plan {formatWorkTime(booking.duration)}
          <span> · </span>
          {entry
            ? `${entry.source === 'planned' ? 'From plan' : 'Actual'} ${formatWorkTime(entry.minutes)}`
            : 'Not entered'}
        </span>
        <ChevronDown size={14} aria-hidden="true" />
      </summary>
      <div className="work-time-body">
        <TimeField
          key={`${booking.id}:${entry?.minutes ?? ''}:${entry?.source ?? ''}`}
          bookingId={booking.id}
          saved={entry?.minutes}
          onSave={onSave}
        />
        <p className="work-time-hint">
          {entry?.source === 'planned'
            ? 'Filled from the plan on completion. Adjust if needed.'
            : 'One duration for the whole wash. Completed bookings fill from the plan.'}
        </p>
      </div>
    </details>
  )
}
