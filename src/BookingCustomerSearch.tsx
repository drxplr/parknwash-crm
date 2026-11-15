import { useEffect, useId, useState } from 'react'
import { Search } from 'lucide-react'
import { findBookingTargets } from './bookingEntries'
import type { Store } from './model'

export function BookingCustomerSearch({
  store,
  onSelect,
}: {
  store: Store
  onSelect: (customerId: string, vehicleId: string) => void
}) {
  const [query, setQuery] = useState(''),
    [open, setOpen] = useState(false),
    [active, setActive] = useState(0)
  const id = useId()
  const found = findBookingTargets(store, query)
  const rows = found.slice(0, 12),
    shown = open && !!query.trim()
  useEffect(() => {
    if (shown) document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [active, shown, id])
  function choose(index: number) {
    const row = rows[index]
    if (!row) return
    onSelect(row.c.id, row.v.id)
    setQuery('')
    setOpen(false)
    setActive(0)
  }
  return (
    <div
      className="booking-customer-lookup"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false)
      }}
    >
      <label htmlFor={id}>Find customer or vehicle</label>
      <div className="booking-lookup-input">
        <Search size={16} aria-hidden="true" />
        <input
          id={id}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={shown}
          aria-controls={shown ? `${id}-results` : undefined}
          aria-activedescendant={shown && rows[active] ? `${id}-${active}` : undefined}
          placeholder="Name, phone, car or registration…"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
            setOpen(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              e.stopPropagation()
              setOpen(false)
              return
            }
            if (!shown) return
            if (e.key === 'Enter') {
              e.preventDefault()
              choose(active)
            }
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((n) =>
                Math.max(0, Math.min(rows.length - 1, n + (e.key === 'ArrowDown' ? 1 : -1))),
              )
            }
          }}
        />
      </div>
      {shown && (
        <div
          data-select-menu
          className="booking-lookup-results"
          id={`${id}-results`}
          role="listbox"
          aria-label="Matching customers and vehicles"
        >
          {rows.map(({ c, v }, i) => (
            <button
              key={v.id}
              type="button"
              role="option"
              aria-selected={active === i}
              id={`${id}-${i}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(i)}
            >
              <strong>{c.name}</strong>
              <span>
                {v.model}
                {v.plate ? ` · ${v.plate}` : ''} · {c.region}
              </span>
            </button>
          ))}
          {!rows.length && <p role="status">No matching customers or vehicles.</p>}
          {found.length > 12 && (
            <p role="status">Showing 12 of {found.length}. Keep typing to narrow the results.</p>
          )}
        </div>
      )}
    </div>
  )
}
