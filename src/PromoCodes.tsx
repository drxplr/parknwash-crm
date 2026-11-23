import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Plus, RefreshCw, Search, X } from 'lucide-react'
import { PageHeader } from './PageHeader'
import { swissInstant } from './model'
import type { Promo, PromoApi, PromoInput } from './promoRepository'
import './PromoCodes.css'

const packages = ['Essential', 'Complete', 'Signature']
const regions = ['ticino', 'geneva']
function localTime(iso: string | null) {
  if (!iso) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Zurich',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const get = (type: string) => parts.find((p) => p.type === type)!.value
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}
function instant(value: string) {
  if (!value) return null
  const [date, time] = value.split('T')
  const milliseconds = swissInstant(date, time)
  if (!Number.isFinite(milliseconds)) throw new Error('Choose a valid date and time.')
  return new Date(milliseconds).toISOString()
}
function status(promo: Promo) {
  if (!promo.enabled) return 'Off'
  if (promo.starts_at && Date.parse(promo.starts_at) > Date.now()) return 'Scheduled'
  if (promo.ends_at && Date.parse(promo.ends_at) <= Date.now()) return 'Expired'
  return 'Active'
}
function editable(promo: Promo): PromoInput {
  return {
    code: promo.code,
    discount_percent: promo.discount_percent,
    packages: promo.packages,
    regions: promo.regions,
    first_wash_only: promo.first_wash_only,
    enabled: promo.enabled,
    starts_at: promo.starts_at,
    ends_at: promo.ends_at,
  }
}
export function PromoCodes({ api }: { api: PromoApi }) {
  const [items, setItems] = useState<Promo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [editor, setEditor] = useState<Promo | 'new' | null>(null)
  const [busy, setBusy] = useState('')
  const mounted = useRef(true)
  async function load() {
    setLoading(true)
    setError('')
    try {
      const next = await api.list()
      if (mounted.current) setItems(next)
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : 'Could not load promo codes.')
    } finally {
      if (mounted.current) setLoading(false)
    }
  }
  useEffect(() => {
    mounted.current = true
    void load()
    return () => {
      mounted.current = false
    }
  }, [api])
  function remember(next: Promo) {
    setItems((current) =>
      [...current.filter((item) => item.id !== next.id), next].sort((a, b) =>
        a.code.localeCompare(b.code),
      ),
    )
  }
  async function toggle(promo: Promo) {
    if (busy) return
    setBusy(promo.id)
    setError('')
    setNotice('')
    try {
      remember(await api.save({ ...editable(promo), enabled: !promo.enabled }, promo))
      setNotice(promo.enabled ? 'Code switched off.' : 'Code switched on.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change this code.')
    } finally {
      setBusy('')
    }
  }
  const shown = items.filter((item) => item.code.includes(query.trim().toLowerCase()))
  return (
    <>
      <PageHeader
        title="Promo codes"
        meta="Changes apply to the website calculator."
        filters={
          <label className="promo-search">
            <Search size={15} />
            <input
              aria-label="Search promo codes"
              placeholder="Search codes"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        }
        actions={
          <>
            <button className="btn" disabled={loading || !!busy} onClick={() => void load()}>
              <RefreshCw size={15} />
              Refresh
            </button>
            <button className="btn primary" onClick={() => setEditor('new')}>
              <Plus size={15} />
              New code
            </button>
          </>
        }
      />
      <section className="promo-workspace" aria-busy={loading || !!busy}>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="promo-notice" role="status">
            {notice}
          </p>
        )}
        <div className="promo-table-wrap">
          <table className="promo-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Discount</th>
                <th>Packages</th>
                <th>Region</th>
                <th>Conditions</th>
                <th>Status</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((promo) => (
                <tr key={promo.id}>
                  <td>
                    <strong>{promo.code}</strong>
                  </td>
                  <td>{promo.discount_percent}%</td>
                  <td>{promo.packages.join(', ')}</td>
                  <td>
                    {promo.regions
                      .map((region) => (region === 'geneva' ? 'Geneva' : 'Ticino'))
                      .join(', ')}
                  </td>
                  <td>
                    {promo.first_wash_only ? 'First wash' : 'Any wash'}
                    {promo.ends_at && (
                      <small>Until {localTime(promo.ends_at).replace('T', ' ')} · Zurich</small>
                    )}
                  </td>
                  <td>
                    <span
                      className={`promo-state ${status(promo) === 'Active' ? 'is-active' : ''}`}
                    >
                      {status(promo)}
                    </span>
                  </td>
                  <td>
                    <div className="promo-row-actions">
                      <button
                        className="btn small-btn"
                        disabled={!!busy}
                        onClick={() => setEditor(promo)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn small-btn"
                        disabled={!!busy}
                        onClick={() => void toggle(promo)}
                      >
                        {promo.enabled ? 'Switch off' : 'Switch on'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!shown.length && (
            <p className="promo-empty">
              {loading
                ? 'Loading codes…'
                : query
                  ? 'No matching codes.'
                  : 'No promo codes yet. Create your first one.'}
            </p>
          )}
        </div>
      </section>
      {editor && (
        <PromoEditor
          key={editor === 'new' ? 'new' : editor.id}
          previous={editor === 'new' ? undefined : editor}
          onClose={() => setEditor(null)}
          onSave={async (draft) => {
            const next = await api.save(draft, editor === 'new' ? undefined : editor)
            remember(next)
            setEditor(null)
            setNotice('Code saved. Website checks use the new settings.')
          }}
        />
      )}
    </>
  )
}
function PromoEditor({
  previous,
  onClose,
  onSave,
}: {
  previous?: Promo
  onClose: () => void
  onSave: (draft: PromoInput) => Promise<void>
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [draft, setDraft] = useState<PromoInput>(
    previous
      ? editable(previous)
      : {
          code: '',
          discount_percent: 10,
          packages,
          regions,
          first_wash_only: true,
          enabled: true,
          starts_at: null,
          ends_at: null,
        },
  )
  const [start, setStart] = useState(localTime(draft.starts_at)),
    [end, setEnd] = useState(localTime(draft.ends_at))
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  useEffect(() => {
    ref.current?.showModal()
  }, [])
  function select(key: 'packages' | 'regions', value: string) {
    setDraft({
      ...draft,
      [key]: draft[key].includes(value)
        ? draft[key].filter((item) => item !== value)
        : [...draft[key], value],
    })
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setError('')
    if (!/^[a-z0-9][a-z0-9_-]{2,31}$/i.test(draft.code.trim())) {
      setError('Use 3–32 letters, numbers, hyphens or underscores.')
      return
    }
    if (!draft.packages.length || !draft.regions.length) {
      setError('Choose at least one package and region.')
      return
    }
    try {
      const starts_at = instant(start),
        ends_at = instant(end)
      if (starts_at && ends_at && ends_at <= starts_at)
        throw new Error('The end must be after the start.')
      setBusy(true)
      await onSave({ ...draft, starts_at, ends_at })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this code.')
      setBusy(false)
    }
  }
  return (
    <dialog
      ref={ref}
      className="promo-dialog"
      aria-labelledby="promo-editor-title"
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onClose()
      }}
    >
      <div className="dialog-top">
        <h2 id="promo-editor-title">{previous ? 'Edit promo code' : 'New promo code'}</h2>
        <button
          type="button"
          className="icon-btn"
          aria-label="Close promo editor"
          disabled={busy}
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      <form onSubmit={submit} aria-busy={busy}>
        <fieldset disabled={busy} className="promo-editor-fields">
          <div className="form-grid">
            <label className="field">
              Code
              <input
                autoFocus
                autoComplete="off"
                required
                maxLength={32}
                value={draft.code}
                onChange={(e) => setDraft({ ...draft, code: e.target.value.toLowerCase() })}
              />
            </label>
            <label className="field">
              Discount, %
              <input
                type="number"
                min={1}
                max={100}
                step={1}
                required
                value={draft.discount_percent}
                onChange={(e) => setDraft({ ...draft, discount_percent: Number(e.target.value) })}
              />
            </label>
          </div>
          <fieldset className="promo-options">
            <legend>Packages</legend>
            {packages.map((item) => (
              <label key={item}>
                <input
                  type="checkbox"
                  checked={draft.packages.includes(item)}
                  onChange={() => select('packages', item)}
                />
                {item}
              </label>
            ))}
          </fieldset>
          <fieldset className="promo-options">
            <legend>Regions</legend>
            {regions.map((item) => (
              <label key={item}>
                <input
                  type="checkbox"
                  checked={draft.regions.includes(item)}
                  onChange={() => select('regions', item)}
                />
                {item === 'geneva' ? 'Geneva' : 'Ticino'}
              </label>
            ))}
          </fieldset>
          <div className="form-grid">
            <label className="field">
              Starts · Europe/Zurich
              <input
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label className="field">
              Ends · Europe/Zurich
              <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
            </label>
          </div>
          <label className="promo-checkbox">
            <input
              type="checkbox"
              checked={draft.first_wash_only}
              onChange={(e) => setDraft({ ...draft, first_wash_only: e.target.checked })}
            />
            First wash only
          </label>
          <label className="promo-checkbox">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
            />
            Enabled
          </label>
          <p className="promo-help">
            The discount includes selected extras. First-wash eligibility is checked when confirming
            the booking.
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="promo-editor-actions">
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button className="btn primary">{busy ? 'Saving…' : 'Save code'}</button>
          </div>
        </fieldset>
      </form>
    </dialog>
  )
}
