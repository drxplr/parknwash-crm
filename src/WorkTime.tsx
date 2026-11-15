import { useState } from 'react'
import { Clock3 } from 'lucide-react'
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
  const planned = bookings.filter((b) => !['Cancelled', 'Rejected', 'No-show'].includes(b.status))
  const service = planned.reduce((n, b) => n + b.duration, 0)
  const unknownCrew = planned.some((b) => b.staffIds.length === 0)
  const crew = planned.reduce((n, b) => n + b.duration * b.staffIds.length, 0)
  const totals = bookings.map((b) => bookingWorkTime(store, b.id, b.staffIds))
  const entered = totals.reduce((n, t) => n + t.entered, 0)
  const actual = totals.reduce((n, t) => n + t.minutes, 0)
  return (
    <div className="work-time-summary" aria-label="Work hours summary">
      <Clock3 size={16} aria-hidden="true" />
      <span>
        Planned <strong>{formatWorkTime(service)}</strong>
      </span>
      <span title="Planned duration × assigned people">
        Team plan{' '}
        <strong>
          {crew || !unknownCrew
            ? `${formatWorkTime(crew)}${unknownCrew ? ' + unknown' : ''}`
            : 'Unknown'}
        </strong>
      </span>
      <span title="Sum of actual time entered for each person">
        Actual <strong>{entered ? formatWorkTime(actual) : 'Not entered'}</strong>
      </span>
      {entered > 0 && (
        <small>
          {entered} staff {entered === 1 ? 'entry' : 'entries'} · entered time only
        </small>
      )}
    </div>
  )
}
export function ActualTimeLabel({
  store,
  bookingId,
  assigned,
}: {
  store: Store
  bookingId?: string
  assigned: string[]
}) {
  const total = bookingId ? bookingWorkTime(store, bookingId, assigned) : null
  return (
    <span className="sub work-time-label">
      Actual:{' '}
      {total?.entered
        ? `${formatWorkTime(total.minutes)}${total.missing ? ' · partial' : ''}`
        : 'Not entered'}
    </span>
  )
}
function TimeField({
  bookingId,
  staffId,
  name,
  saved,
  onSave,
}: {
  bookingId: string
  staffId: string
  name: string
  saved?: number
  onSave?: WorkTimeSave
}) {
  const [value, setValue] = useState(saved == null ? '' : String(saved))
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('')
  const dirty = value !== (saved == null ? '' : String(saved))
  return (
    <form
      className="work-time-person"
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
        setNotice('')
        try {
          await onSave(bookingId, staffId, minutes)
          setNotice('Saved')
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Could not save time. Reload and try again.')
        } finally {
          setBusy(false)
        }
      }}
    >
      <span className="work-time-name">{name}</span>
      <label>
        <input
          type="number"
          inputMode="numeric"
          min="0"
          max="1440"
          step="1"
          placeholder="—"
          aria-label={`Actual minutes · ${name}`}
          value={value}
          readOnly={!onSave}
          disabled={busy}
          onChange={(e) => {
            setValue(e.target.value)
            setNotice('')
            setError('')
          }}
        />
        <span>min</span>
      </label>
      <span className="work-time-formatted">
        {saved == null ? 'Not entered' : formatWorkTime(saved)}
      </span>
      {onSave && dirty && (
        <button className="btn" disabled={busy} type="submit">
          {busy ? 'Saving…' : 'Save'}
        </button>
      )}
      {notice && <small role="status">{notice}</small>}
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
  staffId,
}: {
  booking: Booking
  store: Store
  onSave?: WorkTimeSave
  staffId?: string
}) {
  const entries = (store.workTime ?? []).filter((t) => t.bookingId === booking.id)
  const members = [...new Set([...booking.staffIds, ...entries.map((t) => t.staffId)])].filter(
    (id) => !staffId || staffId === id,
  )
  const total = bookingWorkTime(store, booking.id, booking.staffIds)
  return (
    <section className="work-time-editor" aria-label="Planned and actual work time">
      <header>
        <h3>
          <Clock3 size={16} aria-hidden="true" /> Work time
        </h3>
        <span>
          Plan <strong>{formatWorkTime(booking.duration)}</strong> per person
        </span>
      </header>
      {!staffId && (
        <p className="work-time-total">
          Team plan <strong>{formatWorkTime(booking.duration * booking.staffIds.length)}</strong>
          <span>
            Actual <strong>{total.entered ? formatWorkTime(total.minutes) : 'Not entered'}</strong>
            {total.entered > 0 && total.missing > 0 ? ' · partial' : ''}
          </span>
        </p>
      )}
      <p className="work-time-hint">Actual time · enter minutes after the wash.</p>
      {members.map((id) => {
        const t = entries.find((t) => t.staffId === id)
        return (
          <TimeField
            key={`${id}:${t?.minutes ?? ''}`}
            bookingId={booking.id}
            staffId={id}
            name={store.settings.staff.find((s) => s.id === id)?.name ?? 'Former team member'}
            saved={t?.minutes}
            onSave={onSave}
          />
        )
      })}
      {!members.length && <p className="work-time-hint">Assign a washer to enter actual time.</p>}
    </section>
  )
}
