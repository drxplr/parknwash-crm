import { Info } from 'lucide-react'
import { Select } from './Select'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { DEMO_DATE, reminderQueue, whatsappLink, customerTypeLabel } from './model'
import type { Customer, Store, Region, Reminder } from './model'

export function Messages({
  store,
  setStore,
  region,
  openCustomer,
  live = false,
}: {
  live?: boolean
  store: Store
  setStore: (s: Store) => void
  region: Region | 'All regions'
  openCustomer: (id: string) => void
}) {
  const [tab, setTab] = useState('Queue'),
    [selected, setSelected] = useState<Reminder | null>(null),
    [text, setText] = useState(''),
    [phone, setPhone] = useState(''),
    [clientId, setClientId] = useState(store.customers[0]?.id ?? '')
  const clients = store.customers.filter((c) => region === 'All regions' || c.region === region)
  const queue = reminderQueue(store, live ? new Date().toISOString() : undefined)
    .filter(
      (r) =>
        !live ||
        r.type !== 'Wash reminder' ||
        (store.customers.find((c) => c.id === r.customerId)?.whatsappOptIn &&
          !store.customers.find((c) => c.id === r.customerId)?.unsubscribed),
    )
    .filter((r) => clients.some((c) => c.id === r.customerId))
  const sent = store.sentMessages.filter((m) => clients.some((c) => c.id === m.customerId))
  const select = (r: Reminder) => {
    setSelected(r)
    setText(r.text)
    setPhone(store.customers.find((c) => c.id === r.customerId)?.phone ?? '')
  }
  function markSent(e: FormEvent) {
    e.preventDefault()
    if (!selected || !text.trim()) return
    const at = new Date().toISOString(),
      id = crypto.randomUUID()
    setStore({
      ...store,
      customers: store.customers.map((c) => (c.id === selected.customerId ? { ...c, phone } : c)),
      sentMessages: [
        { id, key: selected.key, customerId: selected.customerId, at, text },
        ...store.sentMessages,
      ],
      activities: [
        {
          id,
          at,
          customerId: selected.customerId,
          vehicleId: selected.vehicleId,
          bookingId: selected.bookingId,
          kind: 'message',
          title: `${selected.type} · marked sent manually`,
          text,
          author: live ? 'Team' : 'Demo manager',
        },
        ...store.activities,
      ],
    })
    setSelected(null)
  }
  return (
    <section className="operations">
      <div className="listing-toolbar">
        <div className="tabs">
          {['Queue', 'Manual follow-up', 'Sent'].map((t) => (
            <button
              key={t}
              className={tab === t ? 'selected' : ''}
              onClick={() => {
                setTab(t)
                setSelected(null)
              }}
            >
              {t}
              {t === 'Queue' ? ` · ${queue.length}` : t === 'Sent' ? ` · ${sent.length}` : ''}
            </button>
          ))}
        </div>
      </div>
      <details className="inline-help">
        <summary>
          <Info size={14} aria-hidden="true" />
          <span>Reminder rules</span>
        </summary>
        <p>
          Wash reminders pause for customers with upcoming bookings.{' '}
          {live
            ? 'Current Swiss time. Wash reminders require an opt-in.'
            : `Demo: ${DEMO_DATE}, 08:00 Zurich.`}
        </p>
      </details>
      {tab === 'Queue' && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Reminder</th>
                <th>When</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((r) => (
                <tr key={r.key}>
                  <td>
                    <button className="cell-link" onClick={() => openCustomer(r.customerId)}>
                      {store.customers.find((c) => c.id === r.customerId)!.name}
                    </button>
                  </td>
                  <td>{r.type}</td>
                  <td>{r.reason}</td>
                  <td>
                    <button className="btn small-btn" onClick={() => select(r)}>
                      Prepare message
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!queue.length && <p className="operation-caption">All caught up.</p>}
        </div>
      )}
      {tab === 'Manual follow-up' && (
        <div className="settings-section">
          <label className="field">
            Customer
            <Select
              aria-label="Customer"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              {store.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </label>
          <button
            className="btn"
            disabled={!clientId}
            onClick={() =>
              select({
                key: `manual-${crypto.randomUUID()}`,
                customerId: clientId,
                type: 'Manual follow-up',
                reason: 'Manual follow-up',
                text: `Hi ${store.customers.find((c) => c.id === clientId)!.contact.split(' · ')[0]}! Following up from Park n Wash. How can we help?`,
              })
            }
          >
            Compose follow-up
          </button>
        </div>
      )}
      {tab === 'Sent' && (
        <div className="settings-section">
          {sent.map((m) => (
            <article className="sent-item" key={m.id}>
              <button className="cell-link" onClick={() => openCustomer(m.customerId)}>
                {store.customers.find((c) => c.id === m.customerId)!.name}
              </button>
              <p>{m.text}</p>
              <small>Manually marked sent · {new Date(m.at).toLocaleString('en-GB')}</small>
            </article>
          ))}
          {!sent.length && <p>No messages marked sent yet.</p>}
        </div>
      )}
      {selected && (
        <form className="message-composer settings-section" onSubmit={markSent}>
          <h3>{selected.reason === 'Manual follow-up' ? 'Manual follow-up' : selected.type}</h3>
          <p>{store.customers.find((c) => c.id === selected.customerId)!.name}</p>
          <label className="field">
            WhatsApp number
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+41 …"
            />
          </label>
          <label className="field">
            Message
            <textarea required value={text} onChange={(e) => setText(e.target.value)} />
          </label>
          <p className="muted">Mark as sent only after sending in WhatsApp.</p>
          <div className="action-row">
            {whatsappLink(phone, text) ? (
              <a className="btn" href={whatsappLink(phone, text)!} target="_blank" rel="noreferrer">
                Open WhatsApp ↗
              </a>
            ) : (
              <span className="muted">Add a number to open WhatsApp.</span>
            )}
            <button className="btn primary">Mark as sent</button>
            <button type="button" className="btn" onClick={() => setSelected(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  )
}

export function CustomerDetails({
  customer: c,
  defaultDays,
  onSave,
}: {
  customer: Customer
  defaultDays: number
  onSave: (c: Customer) => void
}) {
  const [addresses, setAddresses] = useState((c.addresses ?? [c.address]).join('\n')),
    [contacts, setContacts] = useState((c.contacts ?? [c.contact]).join('\n')),
    [days, setDays] = useState(c.reminderDays ?? defaultDays),
    [phone, setPhone] = useState(c.phone ?? ''),
    [saved, setSaved] = useState(false),
    [whatsappOptIn, setWhatsappOptIn] = useState(c.whatsappOptIn ?? false),
    [type, setType] = useState(c.type),
    [region, setRegion] = useState(c.region)
  return (
    <>
      <details className="customer-details">
        <summary>Contacts, addresses & reminders</summary>
        <form
          className="settings-section"
          onChange={() => setSaved(false)}
          onSubmit={(e) => {
            e.preventDefault()
            const list = addresses
                .split('\n')
                .map((x) => x.trim())
                .filter(Boolean),
              people = contacts
                .split('\n')
                .map((x) => x.trim())
                .filter(Boolean)
            if (!people.length) return
            onSave({
              ...c,
              addresses: list,
              address: list[0] ?? '',
              contacts: people,
              contact: people[0],
              reminderDays: days,
              phone,
              whatsappOptIn,
              type,
              region,
            })
            setSaved(true)
          }}
        >
          <div className="form-grid">
            <label className="field">
              Customer type
              <Select
                aria-label="Customer type"
                value={type}
                onChange={(e) => setType(e.target.value as Customer['type'])}
              >
                {(['Unclassified', 'Private', 'Business'] as const).map((t) => (
                  <option key={t} value={t}>
                    {customerTypeLabel(t)}
                  </option>
                ))}
              </Select>
            </label>
            <label className="field">
              Region
              <Select
                aria-label="Customer region"
                value={region}
                onChange={(e) => setRegion(e.target.value as Customer['region'])}
              >
                <option value="Unassigned">Not set</option>
                <option>Geneva</option>
                <option>Ticino</option>
              </Select>
            </label>
          </div>
          <label className="field">
            Contacts · one per line
            <textarea required value={contacts} onChange={(e) => setContacts(e.target.value)} />
          </label>
          <label className="field">
            Saved addresses · one per line
            <textarea value={addresses} onChange={(e) => setAddresses(e.target.value)} />
          </label>
          <label className="field">
            WhatsApp number
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <label className="opt-in-field">
            <input
              type="checkbox"
              checked={whatsappOptIn}
              onChange={(e) => setWhatsappOptIn(e.target.checked)}
            />
            Customer has opted in to WhatsApp wash reminders
          </label>
          <label className="field">
            Wash reminder interval · days
            <input
              required
              type="number"
              min="1"
              max="365"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            />
          </label>
          <button className="btn">{saved ? 'Saved' : 'Save customer details'}</button>
        </form>
      </details>
    </>
  )
}

export function Settings({
  store,
  onSave,
}: {
  store: Store
  onSave: (s: Store['settings']) => void
}) {
  const [draft, setDraft] = useState(structuredClone(store.settings)),
    [saved, setSaved] = useState(false)
  return (
    <form
      className="operations"
      onChange={() => setSaved(false)}
      onSubmit={(e) => {
        e.preventDefault()
        onSave(draft)
        setSaved(true)
      }}
    >
      <div className="settings-section">
        <h2>Services & packages</h2>
        <details className="inline-help">
          <summary>
            <Info size={14} aria-hidden="true" />
            <span>About pricing</span>
          </summary>
          <p>CHF by vehicle size. Changes apply to new bookings; existing quotes stay fixed.</p>
        </details>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Service</th>
              <th>Minutes</th>
              {['Compact', 'Sedan', 'Estate', 'SUV'].map((size) => (
                <th key={size}>{size} · CHF</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {draft.services.map((s, i) => (
              <tr key={i}>
                <td>
                  <input
                    aria-label={`Service ${i + 1} name`}
                    required
                    value={s.name}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        services: draft.services.map((x, j) =>
                          i === j ? { ...x, name: e.target.value } : x,
                        ),
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    aria-label={`${s.name} minutes`}
                    required
                    type="number"
                    min="15"
                    max="480"
                    step="15"
                    value={s.duration}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        services: draft.services.map((x, j) =>
                          i === j ? { ...x, duration: Number(e.target.value) } : x,
                        ),
                      })
                    }
                  />
                </td>
                {Object.entries(s.tariffs).map(([size, price]) => (
                  <td key={size}>
                    <input
                      aria-label={`${s.name} ${size} price`}
                      required
                      type="number"
                      min="0"
                      max="10000"
                      value={price}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          services: draft.services.map((x, j) =>
                            i === j
                              ? { ...x, tariffs: { ...x.tariffs, [size]: Number(e.target.value) } }
                              : x,
                          ),
                        })
                      }
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="settings-section">
        <button
          type="button"
          className="btn"
          onClick={() =>
            setDraft({
              ...draft,
              services: [
                ...draft.services,
                {
                  id: crypto.randomUUID(),
                  name: '',
                  duration: 60,
                  price: 0,
                  tariffs: { Compact: 0, Sedan: 0, Estate: 0, SUV: 0 },
                },
              ],
            })
          }
        >
          Add service
        </button>
        <h2>Regions & staff</h2>
        <details className="inline-help">
          <summary>
            <Info size={14} aria-hidden="true" />
            <span>How region availability works</span>
          </summary>
          <p>Disabled regions cannot accept new bookings. Existing bookings stay available.</p>
        </details>
        {(['Geneva', 'Ticino'] as Region[]).map((r) => (
          <div className="region-setting" key={r}>
            <label>
              <input
                type="checkbox"
                checked={draft.regions[r].enabled}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    regions: {
                      ...draft.regions,
                      [r]: { ...draft.regions[r], enabled: e.target.checked },
                    },
                  })
                }
              />{' '}
              {r}
            </label>
            <input
              aria-label={`${r} coverage`}
              value={draft.regions[r].notes}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  regions: {
                    ...draft.regions,
                    [r]: { ...draft.regions[r], notes: e.target.value },
                  },
                })
              }
            />
          </div>
        ))}
        {draft.staff.map((s, i) => (
          <div className="region-setting" key={s.id}>
            <input
              aria-label={`Staff ${i + 1} name`}
              required
              value={s.name}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  staff: draft.staff.map((x, j) => (i === j ? { ...x, name: e.target.value } : x)),
                })
              }
            />
            <Select
              aria-label={`Staff ${i + 1} region`}
              value={s.region}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  staff: draft.staff.map((x, j) =>
                    i === j ? { ...x, region: e.target.value as Region } : x,
                  ),
                })
              }
            >
              <option>Geneva</option>
              <option>Ticino</option>
            </Select>
          </div>
        ))}
      </div>
      <div className="settings-section">
        <button
          type="button"
          className="btn"
          onClick={() =>
            setDraft({
              ...draft,
              staff: [
                ...draft.staff,
                { id: crypto.randomUUID(), name: '', initials: '', region: 'Geneva' },
              ],
            })
          }
        >
          Add staff member
        </button>
        <h2>Reminders</h2>
        <div className="form-grid">
          <label className="field">
            Default wash interval · days
            <input
              required
              type="number"
              min="1"
              max="365"
              value={draft.reminderDays}
              onChange={(e) => setDraft({ ...draft, reminderDays: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            Appointment reminder · hours before
            <input
              required
              type="number"
              min="1"
              max="168"
              value={draft.appointmentHours}
              onChange={(e) => setDraft({ ...draft, appointmentHours: Number(e.target.value) })}
            />
          </label>
        </div>
        <button className="btn primary">{saved ? 'Settings saved' : 'Save settings'}</button>
      </div>
    </form>
  )
}
