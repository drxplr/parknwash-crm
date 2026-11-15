import { formatWorkTime, bookingWorkTime } from './workTimeModel'
import { canAssignWash } from './teamRoles'
import { useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { addDays, dayLabel, overlaps, DEMO_DATE } from './model'
import { layoutBookings, minutes } from './calendarModel'
import { customerColorStyle } from './customerColors'
import { bookingBucket } from './bookingEntries'
import type { BookingEntry } from './bookingEntries'
import type { Store } from './model'
export type BookingStart = {
  date: string
  time: string
  staffId?: string
  customerId?: string
  vehicleId?: string
}
const hourHeight = 60

export function ScheduleCalendar({
  store,
  today = DEMO_DATE,
  bookings,
  team,
  date,
  start,
  range,
  canCreate = true,
  onOpen,
  onDay,
  onCreate,
}: {
  store: Store
  today?: string
  bookings: BookingEntry[]
  team: Store['settings']['staff']
  date: string
  start: string
  range: 'Day' | 'Week'
  canCreate?: boolean
  onOpen: (id: string) => void
  onDay: (date: string) => void
  onCreate: (context: BookingStart) => void
}) {
  const scroll = useRef<HTMLDivElement>(null)
  const startHour = Math.min(7, ...bookings.map((b) => Math.floor(minutes(b.time) / 60)))
  const endHour = Math.min(
    24,
    Math.max(20, ...bookings.map((b) => Math.ceil((minutes(b.time) + b.duration) / 60))),
  )
  const gridHours = Math.max(1, endHour - startHour)
  const columns =
    range === 'Week'
      ? Array.from({ length: 7 }, (_, i) => ({
          key: addDays(start, i),
          date: addDays(start, i),
          staffId: undefined as string | undefined,
          name: dayLabel(addDays(start, i), { weekday: 'short' }),
          subtitle: dayLabel(addDays(start, i), { day: 'numeric', month: 'short' }),
        }))
      : team.length
        ? team.map((s) => ({ key: s.id, date, staffId: s.id, name: s.name, subtitle: s.region }))
        : [
            {
              key: date,
              date,
              staffId: undefined,
              name: 'Schedule',
              subtitle: 'Assign team when booking',
            },
          ]
  if (range === 'Day' && team.length && bookings.some((b) => b.staffIds.length === 0))
    columns.push({
      key: '__unassigned',
      date,
      staffId: '__unassigned',
      name: 'Unassigned',
      subtitle: 'No recorded assignee',
    })
  useEffect(() => {
    if (scroll.current) {
      const earliest = bookings.length ? Math.min(...bookings.map((b) => minutes(b.time))) : 540
      scroll.current.scrollTop = Math.max(0, ((earliest - startHour * 60 - 30) * hourHeight) / 60)
    }
  }, [start, date, range, startHour])
  if (!columns.length) return <p className="operation-caption">No staff match these filters.</p>
  return (
    <>
      <div
        className="schedule-scroll amie-calendar"
        ref={scroll}
        aria-label={range === 'Week' ? 'Weekly time calendar' : 'Daily staff calendar'}
      >
        <div
          className={`schedule-grid ${range === 'Week' ? 'week-mode' : 'day-mode'}`}
          style={{
            gridTemplateColumns:
              range === 'Week'
                ? '48px repeat(7,minmax(124px,1fr))'
                : `48px repeat(${columns.length},minmax(180px,1fr))`,
          }}
        >
          <div className="schedule-heading schedule-zone">Zurich</div>
          {columns.map((col) => (
            <div
              key={col.key}
              className={`schedule-heading ${col.date === today ? 'is-today' : ''}`}
            >
              <button
                className="schedule-column-title"
                onClick={() =>
                  range === 'Week'
                    ? onDay(col.date)
                    : onCreate({ date: col.date, time: '09:00', staffId: col.staffId })
                }
                disabled={
                  range === 'Day' &&
                  (!canCreate ||
                    col.staffId === '__unassigned' ||
                    (!!col.staffId && !team.some((s) => s.id === col.staffId && canAssignWash(s))))
                }
                aria-label={
                  range === 'Week'
                    ? `Open ${dayLabel(col.date)} staff schedule`
                    : col.staffId === '__unassigned'
                      ? 'Unassigned visits'
                      : `Book with ${col.name}`
                }
              >
                {range === 'Day' && col.staffId !== '__unassigned' && (
                  <span className="schedule-staff-avatar">
                    {col.name
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')}
                  </span>
                )}
                <strong>{col.name}</strong>
                <span className={range === 'Week' ? 'calendar-day-number' : ''}>
                  {range === 'Week' ? Number(col.date.slice(-2)) : col.subtitle}
                </span>
              </button>
            </div>
          ))}
          <div className="schedule-ruler" style={{ height: gridHours * hourHeight }}>
            {Array.from({ length: gridHours + 1 }, (_, i) => (
              <span key={i} style={{ top: i * hourHeight }}>
                {String(i + startHour).padStart(2, '0')}:00
              </span>
            ))}
          </div>
          {columns.map((col) => {
            const items = bookings.filter(
              (b) =>
                b.date === col.date &&
                (col.staffId === '__unassigned'
                  ? !b.staffIds.length
                  : !col.staffId || b.staffIds.includes(col.staffId)),
            )
            return (
              <div
                key={col.key}
                className={`schedule-lane ${col.date === today ? 'is-today' : ''}`}
                style={{ height: gridHours * hourHeight }}
              >
                {canCreate && col.staffId !== '__unassigned' && (
                  <FreeTimes
                    date={col.date}
                    startHour={startHour}
                    staffId={col.staffId}
                    team={team}
                    store={store}
                    onCreate={onCreate}
                  />
                )}
                {layoutBookings(items).map(({ booking: b, column, columns: lanes }) => {
                  const c = b.customer
                  const teamName = b.staffIds
                    .map((id) => store.settings.staff.find((s) => s.id === id)?.name)
                    .join(', ')
                  const actual = b.live ? bookingWorkTime(store, b.live.id, b.staffIds) : null
                  const hoursLabel = `Plan: ${b.durationKnown ? formatWorkTime(b.duration) : 'unknown'}; ${actual?.source === 'planned' ? 'from plan' : 'actual'}: ${actual?.entered ? formatWorkTime(actual.minutes) + (actual.missing ? ' (partial)' : '') : 'not entered'}`
                  const label = `${hoursLabel}. ${b.time}, ${c.name}, ${b.vehicleLabel}, ${b.service}, ${b.status}, ${teamName || 'Unassigned'}${b.imported ? ', Imported from vcita, read only' : ''}${!b.durationKnown ? ', duration not recorded' : ''}`
                  return (
                    <button
                      key={b.id}
                      className={`schedule-event ${b.duration <= 60 ? 'short' : ''} ${lanes > 1 ? 'narrow' : ''} ${['Cancelled', 'Rejected', 'No-show'].includes(b.status) ? 'cancelled' : ''} ${b.imported ? 'imported-event' : ''} ${bookingBucket(b, today) !== 'upcoming' ? 'muted-event' : ''}`}
                      title={label}
                      aria-label={label}
                      onClick={() => onOpen(b.id)}
                      style={{
                        ...customerColorStyle(c),
                        top: ((minutes(b.time) - startHour * 60) * hourHeight) / 60 + 2,
                        height: Math.max(
                          18,
                          (Math.min(b.duration, endHour * 60 - minutes(b.time)) * hourHeight) / 60 -
                            4,
                        ),
                        left: `calc(${(column / lanes) * 100}% + 4px)`,
                        width: `calc(${100 / lanes}% - 8px)`,
                      }}
                    >
                      <span className="schedule-event-time">
                        <span
                          className={`event-state ${b.status.toLowerCase().replaceAll(' ', '-')}`}
                        />
                        {b.time}
                        {lanes === 1 && (
                          <small>
                            {b.durationKnown ? formatWorkTime(b.duration) : 'Time only'}
                          </small>
                        )}
                      </span>
                      <strong>
                        {range === 'Week' && lanes > 1 && c.type !== 'Business'
                          ? c.name
                              .split(' ')
                              .map((n, i, a) => (i === a.length - 1 ? n : n[0] + '.'))
                              .join(' ')
                          : c.name}
                      </strong>
                      <span className="event-vehicle">{b.vehicleLabel}</span>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
      <p className="schedule-hint">
        {bookings.length === 0 ? 'No bookings in this period. ' : ''}
        {canCreate ? 'Select a free time to book' : 'Calendar overview'}. Times in Zurich.
      </p>
    </>
  )
}
function FreeTimes({
  date,
  startHour,
  staffId,
  team,
  store,
  onCreate,
}: {
  date: string
  startHour: number
  staffId?: string
  team: Store['settings']['staff']
  store: Store
  onCreate: (c: BookingStart) => void
}) {
  const [focus, setFocus] = useState(0),
    ref = useRef<HTMLDivElement>(null)
  const available = Array.from({ length: 26 }, (_, i) => {
    const total = 420 + i * 30,
      time = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
    return { index: i, time }
  })
    .filter(
      (slot) =>
        minutes(slot.time) +
          Math.min(...store.settings.services.map((service) => service.duration)) <=
        1200,
    )
    .filter((slot) =>
      team
        .filter((s) => !staffId || s.id === staffId)
        .some(
          (s) =>
            s.region !== 'Unassigned' &&
            canAssignWash(s) &&
            store.settings.regions[s.region].enabled &&
            !store.bookings.some((b) =>
              overlaps(
                {
                  date,
                  time: slot.time,
                  duration: Math.min(...store.settings.services.map((service) => service.duration)),
                  staffIds: [s.id],
                },
                b,
              ),
            ),
        ),
    )
  const active = Math.min(focus, available.length - 1)
  return (
    <div ref={ref} className="free-times">
      {available.map((slot, i) => (
        <button
          type="button"
          key={slot.index}
          className="free-time"
          style={{
            top: ((420 - startHour * 60) * hourHeight) / 60 + (slot.index * hourHeight) / 2,
            height: hourHeight / 2,
          }}
          tabIndex={i === active ? 0 : -1}
          onFocus={() => setFocus(i)}
          onKeyDown={(e) => {
            if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
              e.preventDefault()
              const next =
                e.key === 'Home'
                  ? 0
                  : e.key === 'End'
                    ? available.length - 1
                    : Math.max(
                        0,
                        Math.min(available.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)),
                      )
              setFocus(next)
              ref.current?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus()
            }
          }}
          aria-label={`New booking ${dayLabel(date)} at ${slot.time}${staffId ? ` with ${team.find((s) => s.id === staffId)?.name}` : ''}`}
          onClick={() => {
            const member = team.find(
              (s) =>
                (!staffId || s.id === staffId) &&
                s.region !== 'Unassigned' &&
                canAssignWash(s) &&
                store.settings.regions[s.region].enabled &&
                !store.bookings.some((b) =>
                  overlaps(
                    {
                      date,
                      time: slot.time,
                      duration: Math.min(
                        ...store.settings.services.map((service) => service.duration),
                      ),
                      staffIds: [s.id],
                    },
                    b,
                  ),
                ),
            )
            onCreate({ date, time: slot.time, staffId: member?.id })
          }}
        >
          <Plus size={12} />
          <span>{slot.time}</span>
        </button>
      ))}
    </div>
  )
}
