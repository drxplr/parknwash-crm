import { useState } from 'react'
import { CalendarDays, MapPin, RefreshCw, LogOut } from 'lucide-react'
import { PageHeader } from './PageHeader'
import { dayLabel } from './model'
import type { Store } from './model'
import { sizeLabels } from './websiteCatalog'
import './WasherWorkspace.css'
export function WasherWorkspace({
  store,
  staffId,
  onStatus,
  onReload,
  onSignOut,
  embedded = false,
}: {
  store: Store
  staffId: string
  onStatus: (id: string, status: 'In progress' | 'Completed') => Promise<void>
  onReload?: () => Promise<void>
  onSignOut?: () => void
  embedded?: boolean
}) {
  const [tab, setTab] = useState('Open'),
    [busy, setBusy] = useState(''),
    [error, setError] = useState('')
  const own = store.bookings.filter((b) => b.staffIds.includes(staffId))
  const shown = own
    .filter(
      (b) =>
        tab === 'All' ||
        (tab === 'Completed'
          ? b.status === 'Completed'
          : b.status !== 'Completed' && b.status !== 'Cancelled'),
    )
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
  async function advance(id: string, status: 'In progress' | 'Completed') {
    if (busy) return
    setBusy(id)
    setError('')
    try {
      await onStatus(id, status)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update wash. Reload and try again.')
    } finally {
      setBusy('')
    }
  }
  const content = (
    <>
      {!embedded && (
        <PageHeader
          title="My washes"
          meta={store.settings.staff.find((s) => s.id === staffId)?.name}
          actions={
            <>
              {onReload && (
                <button
                  className="btn"
                  disabled={!!busy}
                  onClick={() => {
                    setBusy('reload')
                    setError('')
                    void onReload()
                      .catch((e) => setError(e instanceof Error ? e.message : 'Unable to reload'))
                      .finally(() => setBusy(''))
                  }}
                >
                  <RefreshCw size={15} />
                  Reload
                </button>
              )}
              {onSignOut && (
                <button className="btn" onClick={onSignOut}>
                  <LogOut size={15} />
                  Sign out
                </button>
              )}
            </>
          }
        />
      )}
      <div className="selection-tabs" role="group" aria-label="My wash filters">
        {['Open', 'Completed', 'All'].map((t) => (
          <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="washer-jobs">
        {shown.map((b) => {
          const v = store.vehicles.find((v) => v.id === b.vehicleId),
            c = store.customers.find((c) => c.id === v?.customerId)
          return (
            <article className="washer-job" key={b.id}>
              <div className="washer-job-top">
                <span>
                  <CalendarDays size={15} />
                  {dayLabel(b.date)} · {b.time}
                </span>
                <span>{b.status}</span>
              </div>
              <h2>
                {v?.model ?? 'Vehicle'} <small>{v ? sizeLabels[v.size] : ''}</small>
              </h2>
              <p>
                {c?.name}
                {v?.plate && ` · ${v.plate}`}
              </p>
              <p>
                {b.service.split(' · ')[0]} · {b.duration} min
              </p>
              <p className="washer-address">
                <MapPin size={14} />
                {b.address}
              </p>
              {b.notes && <p className="washer-job-note">{b.notes}</p>}
              {b.status === 'Confirmed' && (
                <button
                  className="btn primary"
                  disabled={!!busy}
                  onClick={() => void advance(b.id, 'In progress')}
                >
                  {busy === b.id ? 'Saving…' : 'Start wash'}
                </button>
              )}
              {b.status === 'In progress' && (
                <button
                  className="btn primary"
                  disabled={!!busy}
                  onClick={() => void advance(b.id, 'Completed')}
                >
                  {busy === b.id ? 'Saving…' : 'Complete wash'}
                </button>
              )}
              {b.status === 'Pending' && <small>Waiting for manager confirmation</small>}
            </article>
          )
        })}
        {!shown.length && <p className="washer-empty">No assigned washes in this view.</p>}
      </div>
    </>
  )
  return embedded ? (
    <section className="washer-workspace">{content}</section>
  ) : (
    <div className="app-shell washer-shell">
      <main className="washer-workspace">{content}</main>
    </div>
  )
}
