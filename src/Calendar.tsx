import { useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { addDays, dayLabel, overlaps, DEMO_DATE } from './model'
import { layoutBookings, minutes } from './calendarModel'
import { customerColorStyle } from './customerColors'
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
  bookings: Store['bookings']
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
  const columns =
    range === 'Week'
      ? Array.from({ length: 7 }, (_, i) => ({
          key: addDays(start, i),
          date: addDays(start, i),
          staffId: undefined as string | undefined,
          name: dayLabel(addDays(start, i), { weekday: 'short' }),
          subtitle: dayLabel(addDays(start, i), { day: 'numeric', month: 'short' }),
        }))
      : team.map((s) => ({ key: s.id, date, staffId: s.id, name: s.name, subtitle: s.region }))
  useEffect(() => {
    if (scroll.current) {
      const earliest = bookings.length ? Math.min(...bookings.map((b) => minutes(b.time))) : 540
      scroll.current.scrollTop = Math.max(0, ((earliest - 450) * hourHeight) / 60)
    }
  }, [start, date, range])
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
                disabled={range === 'Day' && !canCreate}
                aria-label={
                  range === 'Week'
                    ? `Open ${dayLabel(col.date)} staff schedule`
                    : `Book with ${col.name}`
                }
              >
                {range === 'Day' && (
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
          <div className="schedule-ruler" style={{ height: 13 * hourHeight }}>
            {Array.from({ length: 14 }, (_, i) => (
              <span key={i} style={{ top: i * hourHeight }}>
                {String(i + 7).padStart(2, '0')}:00
              </span>
            ))}
          </div>
          {columns.map((col) => {
            const items = bookings.filter(
              (b) => b.date === col.date && (!col.staffId || b.staffIds.includes(col.staffId)),
            )
            return (
              <div
                key={col.key}
                className={`schedule-lane ${col.date === today ? 'is-today' : ''}`}
                style={{ height: 13 * hourHeight }}
              >
                {canCreate && (
                  <FreeTimes
                    date={col.date}
                    staffId={col.staffId}
                    team={team}
                    store={store}
                    onCreate={onCreate}
                  />
                )}
                {layoutBookings(items).map(({ booking: b, column, columns: lanes }) => {
                  const v = store.vehicles.find((v) => v.id === b.vehicleId)!,
                    c = store.customers.find((c) => c.id === v.customerId)!
                  const teamName = b.staffIds
                    .map((id) => store.settings.staff.find((s) => s.id === id)?.name)
                    .join(', ')
                  const label = `${b.time}, ${c.name}, ${v.model}, ${b.service}, ${b.status}, ${teamName}`
                  return (
                    <button
                      key={b.id}
                      className={`schedule-event ${b.duration <= 60 ? 'short' : ''} ${lanes > 1 ? 'narrow' : ''} ${b.status === 'Cancelled' ? 'cancelled' : ''}`}
                      title={label}
                      aria-label={label}
                      onClick={() => onOpen(b.id)}
                      style={{
                        ...customerColorStyle(c),
                        top: ((minutes(b.time) - 420) * hourHeight) / 60 + 2,
                        height: (b.duration * hourHeight) / 60 - 4,
                        left: `calc(${(column / lanes) * 100}% + 4px)`,
                        width: `calc(${100 / lanes}% - 8px)`,
                      }}
                    >
                      <span className="schedule-event-time">
                        <span
                          className={`event-state ${b.status.toLowerCase().replaceAll(' ', '-')}`}
                        />
                        {b.time}
                        {lanes === 1 && <small>{b.duration}m</small>}
                      </span>
                      <strong>
                        {range === 'Week' && lanes > 1 && c.type !== 'Business'
                          ? c.name
                              .split(' ')
                              .map((n, i, a) => (i === a.length - 1 ? n : n[0] + '.'))
                              .join(' ')
                          : c.name}
                      </strong>
                      <span className="event-vehicle">{v.model}</span>
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
  staffId,
  team,
  store,
  onCreate,
}: {
  date: string
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
          style={{ top: (slot.index * hourHeight) / 2, height: hourHeight / 2 }}
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
