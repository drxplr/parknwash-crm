import { RegionBadge } from './RegionBadge'
import { teamRoleLabels, teamRolesLabel } from './teamRoles'
import { WhatsAppTest } from './WhatsAppTest'
import type { WhatsAppTestApi } from './WhatsAppTest'
import type { Staff, TeamRole } from './model'
import { websitePackages, websiteServices } from './websiteCatalog'
import { Info, Package, Users, MapPin, Bell, Plus, Check, MessageSquare, ChevronDown } from 'lucide-react'
import { Select } from './Select'
import { useRef, useState } from 'react'
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
  const reachable = clients.filter(
    (c) => /^\+?[1-9]\d{6,14}$/.test((c.phone ?? '').replace(/[\s()-]/g, '')) && !c.unsubscribed,
  )
  const optedIn = reachable.filter((c) => c.whatsappOptIn)
  const currentDraft = !selected?.bookingId || queue.some((r) => r.key === selected.key)
  const select = (r: Reminder) => {
    setSelected(r)
    setText(r.text)
    setPhone(store.customers.find((c) => c.id === r.customerId)?.phone ?? '')
  }
  function markSent(e: FormEvent) {
    e.preventDefault()
    if (!selected || !text.trim()) return
    if (selected.bookingId && !queue.some((r) => r.key === selected.key)) {
      setSelected(null)
      return
    }
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
        <div className="tabs selection-tabs">
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
      {live && (
        <div className="messaging-readiness" aria-label="WhatsApp readiness">
          <strong>WhatsApp readiness</strong>
          <span>{reachable.length} reachable contacts</span>
          <span>{optedIn.length} opted in for wash reminders</span>
          <p>
            Booking confirmations and reminders are prepared below. Cloud API tests go only to the verified test number; customer automation is off.
          </p>
        </div>
      )}
      <details className="inline-help">
        <summary>
          <Info size={14} aria-hidden="true" />
          <span>Reminder rules</span>
        </summary>
        <p>
          Confirmations follow confirmed bookings; appointment reminders use the configured lead time. Pending and cancelled bookings do not trigger appointment messages. Wash reminders pause for customers with upcoming bookings.{' '}
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
          {!queue.length && <p className="operation-caption">{live && !optedIn.length ? 'No booking messages due. Wash reminders require customer opt-in.' : 'All caught up.'}</p>}
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
          {!currentDraft && <p role="alert" className="form-error">This appointment changed. Close this draft and prepare the current message from the queue.</p>}
          <div className="action-row">
            {currentDraft && whatsappLink(phone, text) ? (
              <a className="btn" href={whatsappLink(phone, text)!} target="_blank" rel="noreferrer">
                Open WhatsApp ↗
              </a>
            ) : (
              <span className="muted">Add a number to open WhatsApp.</span>
            )}
            <button className="btn primary" disabled={!currentDraft}>Mark as sent</button>
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
  inline = false,
  onCancel,
}: {
  customer: Customer
  defaultDays: number
  onSave: (c: Customer) => void
  inline?: boolean
  onCancel?: () => void
}) {
  const [name, setName] = useState(c.name),
    [email, setEmail] = useState(c.email)
  const [addresses, setAddresses] = useState((c.addresses ?? [c.address]).join('\n')),
    [contacts, setContacts] = useState((c.contacts ?? [c.contact]).join('\n')),
    [days, setDays] = useState(c.reminderDays ?? defaultDays),
    [phone, setPhone] = useState(c.phone ?? ''),
    [saved, setSaved] = useState(false),
    [whatsappOptIn, setWhatsappOptIn] = useState(c.whatsappOptIn ?? false),
    [type, setType] = useState(c.type),
    [region, setRegion] = useState(c.region)
  const Wrapper = inline ? 'div' : 'details'
  return (
    <>
      <Wrapper className="customer-details">
        {!inline && <summary>Edit customer details & reminders</summary>}
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
              name: name.trim(),
              email: email.trim(),
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
              Customer name
              <input required value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="field">
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
          </div>
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
          <div className="customer-editor-actions">
            {onCancel && (
              <button type="button" className="btn" onClick={onCancel}>
                Cancel
              </button>
            )}
            <button className="btn primary">{saved ? 'Saved' : 'Save changes'}</button>
          </div>
        </form>
      </Wrapper>
    </>
  )
}

export function Settings({
  store,
  onSave,
  whatsapp,
}: {
  store: Store
  onSave: (s: Store['settings']) => void
  whatsapp?: WhatsAppTestApi
}) {
  const [draft, setDraft] = useState(structuredClone(store.settings)),
    [saved, setSaved] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const [section, setSection] = useState('services')
  const sections = [
    { id: 'services', label: 'Services & pricing', icon: Package },
    { id: 'team', label: 'Team members', icon: Users },
    { id: 'regions', label: 'Regions', icon: MapPin },
    { id: 'reminders', label: 'Reminders', icon: Bell },
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
  ]
  const dirty = JSON.stringify(draft) !== JSON.stringify(store.settings)
  const [teamError, setTeamError] = useState('')
  const [editingMember, setEditingMember] = useState<string | null>(null)
  function updateMember(index: number, patch: Partial<Staff>) {
    setSaved(false)
    setTeamError('')
    setDraft({ ...draft, staff: draft.staff.map((m, i) => (i === index ? { ...m, ...patch } : m)) })
  }
  const [priceRegion, setPriceRegion] = useState<'Ticino' | 'Geneva'>('Ticino')
  const variants = ['S', 'M', 'L+'] as const
  const keys = ['Compact', 'Sedan', 'SUV'] as const
  const isWebsite = (name: string) => websitePackages.some((p) => name.startsWith(p.name + ' · '))
  function updateVariant(index: number, patch: Partial<Store['settings']['services'][number]>) {
    setSaved(false)
    setDraft({
      ...draft,
      services: draft.services.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    })
  }
  return (
    <div className="settings-workspace">
      <nav className="settings-nav selection-tabs" aria-label="Settings sections">
        {sections.map(({ id, label, icon: Icon }) => (
          <button
            type="button"
            key={id}
            aria-current={section === id ? 'page' : undefined}
            onClick={() => {
              if (!formRef.current || formRef.current.reportValidity()) setSection(id)
            }}
          >
            <Icon size={17} />
            <span>{label}</span>
            {id === 'team' && <small>{draft.staff.length}</small>}
          </button>
        ))}
      </nav>
      {section === 'whatsapp' ? <WhatsAppTest api={whatsapp} /> : <form
        ref={formRef}
        className="operations settings-content"
        onChange={() => setSaved(false)}
        onSubmit={(e) => {
          e.preventDefault()
          const invalidMember = draft.staff.find((m) =>
            !m.name.trim() || m.roles?.length === 0 ||
            (m.roles?.includes('washer') && m.region === 'Unassigned'))
          if (invalidMember) {
            setEditingMember(invalidMember.id)
            setSection('team')
            setTeamError(
              'Enter a name, choose at least one role per member and a service region for every washer.',
            )
            return
          }
          onSave(draft)
          setSaved(true)
        }}
      >
        <section
          className="settings-pane"
          aria-label={sections.find((s) => s.id === section)?.label}
        >
          <header className="settings-pane-header">
            <h2>{sections.find((s) => s.id === section)?.label}</h2>
            <p>
              {section === 'services'
                ? 'Prices in CHF, by region and vehicle size.'
                : section === 'team'
                  ? 'People available for booking assignments.'
                  : section === 'regions'
                    ? 'Coverage and availability for new bookings.'
                    : 'Default timing for your message queue.'}
            </p>
          </header>
          {section === 'services' && (
            <>
              <div className="package-settings">
                <div className="package-toolbar">
                  <h2>Packages</h2>
                  <div className="segmented selection-tabs">
                    {(['Ticino', 'Geneva'] as const).map((r) => (
                      <button
                        type="button"
                        key={r}
                        className={priceRegion === r ? 'selected' : ''}
                        aria-pressed={priceRegion === r}
                        onClick={() => setPriceRegion(r)}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                  <a
                    href="https://parknwash.ch/en/car-care/"
                    target="_blank"
                    rel="noreferrer"
                    aria-label="View website prices"
                  >
                    ↗
                  </a>
                </div>
                <div className="table-scroll">
                  <table className="package-table">
                    <thead>
                      <tr>
                        <th>Package</th>
                        <th>S</th>
                        <th>M</th>
                        <th>XL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {websitePackages.map((pkg) => (
                        <tr key={pkg.name}>
                          <th scope="row">{pkg.name.replace(' Care', '')}</th>
                          {variants.map((size, j) => {
                            const index = draft.services.findIndex(
                              (s) => s.name === `${pkg.name} · ${priceRegion} · ${size}`,
                            )
                            const service = draft.services[index]
                            return (
                              <td key={size}>
                                {service ? (
                                  <div className="package-cell">
                                    <label>
                                      <span>CHF</span>
                                      <input
                                        type="number"
                                        min="0"
                                        max="10000"
                                        required
                                        value={service.tariffs[keys[j]] ?? service.price}
                                        aria-label={`${pkg.name} ${priceRegion} ${size === 'L+' ? 'XL' : size} CHF`}
                                        onChange={(e) => {
                                          const price = Number(e.target.value)
                                          updateVariant(index, {
                                            price,
                                            tariffs: Object.fromEntries(
                                              Object.keys(service.tariffs).map((k) => [k, price]),
                                            ),
                                          })
                                        }}
                                      />
                                    </label>
                                    <label className="package-duration">
                                      <input
                                        type="number"
                                        min="15"
                                        max="480"
                                        required
                                        value={service.duration}
                                        aria-label={`${pkg.name} ${priceRegion} ${size === 'L+' ? 'XL' : size} minutes`}
                                        onChange={(e) =>
                                          updateVariant(index, { duration: Number(e.target.value) })
                                        }
                                      />
                                      <span>min</span>
                                    </label>
                                  </div>
                                ) : (
                                  <span className="muted">—</span>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!websitePackages.every((pkg) =>
                  variants.every((size) =>
                    draft.services.some((s) => s.name === `${pkg.name} · ${priceRegion} · ${size}`),
                  ),
                ) && (
                  <button
                    type="button"
                    className="btn small-btn"
                    onClick={() => {
                      setSaved(false)
                      setDraft({
                        ...draft,
                        services: [
                          ...draft.services,
                          ...websiteServices().filter(
                            (s) => !draft.services.some((x) => x.name === s.name),
                          ),
                        ],
                      })
                    }}
                  >
                    Load packages
                  </button>
                )}
              </div>
              {draft.services.some((s) => !isWebsite(s.name)) && (
                <details className="custom-services" open>
                  <summary>Other services</summary>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Service</th>
                          <th>Minutes</th>
                          <th>S · CHF</th>
                          <th>M · CHF</th>
                          <th>XL · CHF</th>
                        </tr>
                      </thead>
                      <tbody>
                        {draft.services
                          .map((service, index) => ({ service, index }))
                          .filter(({ service }) => !isWebsite(service.name))
                          .map(({ service, index }) => (
                            <tr key={index}>
                              <td>
                                <input
                                  required
                                  aria-label={`Custom service ${index + 1}`}
                                  value={service.name}
                                  onChange={(e) => updateVariant(index, { name: e.target.value })}
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  required
                                  min="15"
                                  max="480"
                                  aria-label={`${service.name} minutes`}
                                  value={service.duration}
                                  onChange={(e) =>
                                    updateVariant(index, { duration: Number(e.target.value) })
                                  }
                                />
                              </td>
                              {keys.map((key) => (
                                <td key={key}>
                                  <input
                                    type="number"
                                    min="0"
                                    required
                                    aria-label={`${service.name} ${key} CHF`}
                                    value={service.tariffs[key] ?? service.price}
                                    onChange={(e) =>
                                      updateVariant(index, {
                                        tariffs: {
                                          ...service.tariffs,
                                          [key]: Number(e.target.value),
                                          ...(key === 'Sedan'
                                            ? { Estate: Number(e.target.value) }
                                            : {}),
                                        },
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
                </details>
              )}
              <div className="settings-add-service">
                <button
                  type="button"
                  className="btn small-btn"
                  onClick={() => {
                    setSaved(false)
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
                  }}
                >
                  Add service
                </button>
              </div>
            </>
          )}
          {section === 'regions' && (
            <div className="settings-region-list">
              {(['Geneva', 'Ticino'] as Region[]).map((r) => (
                <div className="settings-region-card" key={r}>
                  <label className="settings-region-toggle">
                    <input
                      type="checkbox"
                      role="switch"
                      aria-label={`${r} accepts new bookings`}
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
                    <strong>{r}</strong>
                    <span>{draft.regions[r].enabled ? 'Accepting bookings' : 'Paused'}</span>
                  </label>
                  <details className="region-coverage">
                    <summary>{draft.regions[r].notes || 'Add coverage note'}</summary>
                    <label className="field">
                      Coverage note
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
                    </label>
                  </details>
                </div>
              ))}
              <p className="settings-footnote">
                Pausing a region keeps existing bookings available.
              </p>
            </div>
          )}
          {section === 'team' && (
            <div className="settings-team-list">
              {!draft.staff.length && (
                <div className="settings-empty">
                  <Users size={24} />
                  <h3>Add your first team member</h3>
                  <p>Then assign them to washes in their region.</p>
                </div>
              )}
              {teamError && (
                <p className="form-error" role="alert">
                  {teamError}
                </p>
              )}
              {draft.staff.map((s, i) => (
                <article className="team-member-card" key={s.id}>
                  <button type="button" className="team-member-summary"
                    aria-expanded={editingMember === s.id}
                    aria-controls={`team-editor-${s.id}`}
                    onClick={() => {
                      if (formRef.current && !formRef.current.reportValidity()) return
                      setEditingMember(editingMember === s.id ? null : s.id)
                    }}>
                    <span className="avatar" aria-hidden="true">{s.name.trim().split(/\s+/).slice(0, 2).map((n) => n[0]).join('') || <Users size={16} />}</span>
                    <span className="team-member-identity">
                      <strong>{s.name.trim() || 'New team member'}</strong>
                      <small>{store.teamAccounts?.find((a) => a.userId === s.userId)?.email ?? (s.userId ? 'Linked account' : 'No login account')}</small>
                    </span>
                    <span className="team-member-roles">{teamRolesLabel(s)}</span>
                    <RegionBadge region={s.region} />
                    <span className={`team-member-status ${s.active === false ? 'inactive' : ''}`}><span aria-hidden="true" />{s.active === false ? 'Inactive' : 'Active'}</span>
                    <ChevronDown size={16} className="team-member-chevron" aria-hidden="true" />
                  </button>
                  {editingMember === s.id && <div id={`team-editor-${s.id}`} className="team-member-editor">
                  <div className="settings-staff-row">
                    <span className="avatar">
                      {s.name
                        .trim()
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((n) => n[0])
                        .join('') || <Users size={16} />}
                    </span>
                    <label className="field">
                      Name
                      <input
                        required
                        aria-label={`Staff ${i + 1} name`}
                        value={s.name}
                        onChange={(e) => updateMember(i, { name: e.target.value })}
                      />
                    </label>
                    <label className="field">
                      Service region
                      <Select
                        aria-label={`Staff ${i + 1} region`}
                        value={s.region}
                        onChange={(e) =>
                          updateMember(i, { region: e.target.value as Staff['region'] })
                        }
                      >
                        <option value="Unassigned">Not required</option>
                        <option>Geneva</option>
                        <option>Ticino</option>
                      </Select>
                    </label>
                  </div>
                  <div className="team-member-detail">
                    <fieldset className="team-role-options">
                      <legend>Roles</legend>
                      {(['manager', 'washer'] as TeamRole[]).map((role) => (
                        <label key={role}>
                          <input
                            type="checkbox"
                            aria-label={`${s.name || 'New member'}: ${teamRoleLabels[role]}`}
                            checked={s.roles?.includes(role) ?? false}
                            onChange={(e) =>
                              updateMember(i, {
                                roles: e.target.checked
                                  ? [...(s.roles ?? []), role]
                                  : (s.roles ?? []).filter((r) => r !== role),
                              })
                            }
                          />
                          {teamRoleLabels[role]}
                        </label>
                      ))}
                    </fieldset>
                    <div className="team-member-account">
                      <label className="field">
                        Login account
                        <Select
                          aria-label={`${s.name || 'New member'} login account`}
                          value={s.userId ?? ''}
                          onChange={(e) => updateMember(i, { userId: e.target.value || null })}
                        >
                          <option value="">No login account</option>
                          {store.teamAccounts?.map((a) => (
                            <option
                              key={a.userId}
                              value={a.userId}
                              disabled={draft.staff.some(
                                (m) => m.id !== s.id && m.userId === a.userId,
                              )}
                            >
                              {a.email}
                            </option>
                          ))}
                        </Select>
                        {store.teamAccounts?.find((a) => a.userId === s.userId)?.accessRole ===
                          'admin' && <small>Administrator access is preserved</small>}
                      </label>
                      <label className="team-active">
                        <input
                          type="checkbox"
                          checked={s.active !== false}
                          onChange={(e) => updateMember(i, { active: e.target.checked })}
                        />
                        Active
                      </label>
                    </div>
                  </div>
                  </div>}
                </article>
              ))}
              <button
                type="button"
                className="btn"
                onClick={() => {
                  if (formRef.current && !formRef.current.reportValidity()) return
                  const id = crypto.randomUUID()
                  setEditingMember(id)
                  setSaved(false)
                  setDraft({ ...draft, staff: [...draft.staff, {
                    id, name: '', initials: '', region: 'Unassigned', roles: [], active: true, userId: null,
                  }] })
                }}
              >
                <Plus size={15} /> Add team member
              </button>
            </div>
          )}
          {section === 'reminders' && (
            <div className="settings-reminders">
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
                    onChange={(e) =>
                      setDraft({ ...draft, appointmentHours: Number(e.target.value) })
                    }
                  />
                </label>
              </div>
              <p className="settings-footnote">
                Customer-specific intervals override the default. Messages are sent manually.
              </p>
            </div>
          )}
        </section>
        <footer className="settings-savebar">
          <span role="status">
            {dirty ? (
              'Unsaved changes'
            ) : saved ? (
              <>
                <Check size={14} /> Changes saved
              </>
            ) : (
              'All changes saved'
            )}
          </span>
          {dirty && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                setDraft(structuredClone(store.settings))
                setSaved(false)
              }}
            >
              Discard
            </button>
          )}
          <button className="btn primary" disabled={!dirty}>
            Save changes
          </button>
        </footer>
      </form>}
    </div>
  )
}
