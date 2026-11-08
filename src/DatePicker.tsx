import { useEffect, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { addDays, dayLabel } from './model'
import { startOfWeek } from './calendarModel'

export function DatePicker({
  value,
  label,
  today,
  onChange,
}: {
  value: string
  label: string
  today: string
  onChange: (day: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [activeDay, setActiveDay] = useState(value)
  const [month, setMonth] = useState(value.slice(0, 7) + '-01')
  const pendingFocus = useRef<string | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    root.current?.querySelector<HTMLButtonElement>('[aria-pressed=true]')?.focus()
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  useEffect(() => {
    if (open && pendingFocus.current) {
      root.current
        ?.querySelector<HTMLButtonElement>(`[data-day="${pendingFocus.current}"]`)
        ?.focus()
      pendingFocus.current = null
    }
  }, [month, open])
  function select(day: string) {
    onChange(day)
    setOpen(false)
    trigger.current?.focus()
  }
  const first = startOfWeek(month)
  return (
    <div
      className="date-picker"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          setOpen(false)
          trigger.current?.focus()
        }
      }}
    >
      <button
        ref={trigger}
        className="calendar-date-jump"
        aria-label={`Choose date: ${label}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setActiveDay(value)
          setMonth(value.slice(0, 7) + '-01')
          setOpen(!open)
        }}
      >
        <CalendarDays size={16} />
        <span>{label}</span>
      </button>
      {open && (
        <div className="date-popover" role="dialog" aria-label="Choose calendar date">
          <div className="date-month">
            <strong>{dayLabel(month, { month: 'long', year: 'numeric' })}</strong>
            <button
              className="icon-btn"
              aria-label="Previous month"
              onClick={() => setMonth(addDays(month, -1).slice(0, 7) + '-01')}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              className="icon-btn"
              aria-label="Next month"
              onClick={() => setMonth(addDays(month, 32).slice(0, 7) + '-01')}
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="date-grid">
            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((day) => (
              <span key={day}>{day}</span>
            ))}
            {Array.from({ length: 42 }, (_, i) => addDays(first, i)).map((day) => (
              <button
                key={day}
                aria-label={dayLabel(day, {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
                aria-pressed={day === value}
                tabIndex={
                  day ===
                  (activeDay >= first && activeDay <= addDays(first, 41) ? activeDay : month)
                    ? 0
                    : -1
                }
                onFocus={() => setActiveDay(day)}
                aria-current={day === today ? 'date' : undefined}
                data-outside={day.slice(0, 7) !== month.slice(0, 7)}
                onClick={() => select(day)}
                onKeyDown={(event) => {
                  const offset: Record<string, number> = {
                    ArrowLeft: -1,
                    ArrowRight: 1,
                    ArrowUp: -7,
                    ArrowDown: 7,
                  }
                  if (offset[event.key]) {
                    event.preventDefault()
                    const next = addDays(day, offset[event.key])
                    setActiveDay(next)
                    if (next >= first && next <= addDays(first, 41))
                      root.current
                        ?.querySelector<HTMLButtonElement>(`[data-day="${next}"]`)
                        ?.focus()
                    else {
                      pendingFocus.current = next
                      setMonth(next.slice(0, 7) + '-01')
                    }
                  }
                }}
                data-day={day}
              >
                {Number(day.slice(-2))}
              </button>
            ))}
          </div>
          <button className="date-today" onClick={() => select(today)}>
            Go to today
          </button>
        </div>
      )}
    </div>
  )
}
