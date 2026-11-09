import { RegionBadge } from './RegionBadge'
import { useState } from 'react'
import {
  CalendarDays,
  CarFront,
  ChevronRight,
  Mail,
  MapPin,
  MessageSquare,
  Pencil,
  Phone,
  Plus,
  X,
} from 'lucide-react'
import { customerColorStyle } from './customerColors'
import { ActivityHistory } from './ActivityHistory'
import { CustomerDetails } from './Operations'
import { Select } from './Select'
import { dayLabel, money, whatsappLink } from './model'
import { sizeLabels } from './websiteCatalog'
import type { Booking, Customer, Store, Vehicle } from './model'

type Props = {
  customer: Customer
  store: Store
  today: string
  readOnly: boolean
  onBook: (vehicleId?: string) => void
  onOpenVehicle: (id: string) => void
  onOpenBooking: (id: string) => void
  onSaveCustomer: (customer: Customer) => void
  onSaveNotes: (text: string) => void
  onAddNote: (text: string) => void
  onAddVehicle: (vehicle: Vehicle) => void
}
export function CustomerProfile({
  customer: c,
  store,
  today,
  readOnly,
  onBook,
  onOpenVehicle,
  onOpenBooking,
  onSaveCustomer,
  onSaveNotes,
  onAddNote,
  onAddVehicle,
}: Props) {
  const [tab, setTab] = useState<'Overview' | 'History' | 'Bookings'>('Overview')
  const [editing, setEditing] = useState(false),
    [addingVehicle, setAddingVehicle] = useState(false)
  const [editingNote, setEditingNote] = useState(false),
    [noteDraft, setNoteDraft] = useState(c.notes),
    [fullNote, setFullNote] = useState(false)
  const vehicles = store.vehicles.filter((v) => v.customerId === c.id)
  const vehicleIds = new Set(vehicles.map((v) => v.id))
  const bookings = store.bookings.filter((b) => vehicleIds.has(b.vehicleId))
  const chronological = [...bookings].sort((a, b) =>
    (a.date + a.time).localeCompare(b.date + b.time),
  )
  const next = chronological.find(
    (b) => b.date >= today && !['Completed', 'Cancelled'].includes(b.status),
  )
  const completed = [...bookings]
    .filter((b) => b.status === 'Completed')
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
  const outstanding = completed.filter((b) => !b.paid).reduce((n, b) => n + b.price, 0)
  const activities = store.activities.filter((a) => a.customerId === c.id)
  const addresses = [...new Set((c.addresses?.length ? c.addresses : [c.address]).filter(Boolean))]
  const phone = c.phone?.trim()
  const wa = whatsappLink(phone ?? '', `Hello ${c.contact.split(' · ')[0] || c.name}, `)
  const extraContact = c.contact && c.contact !== c.name ? c.contact : ''
  const longNote = c.notes.length > 120 || c.notes.split('\n').length > 2
  const initials = c.name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
  const ready = c.region !== 'Unassigned'
  function book(vehicleId?: string) {
    if (!vehicles.length) {
      setAddingVehicle(true)
      setEditing(false)
      return
    }
    if (c.region === 'Unassigned') {
      setEditing(true)
      setAddingVehicle(false)
      return
    }
    onBook(vehicleId)
  }
  function changeTab(value: typeof tab) {
    setTab(value)
    setEditing(false)
    setAddingVehicle(false)
    setEditingNote(false)
  }
  function bookingRow(b: Booking, highlight = false) {
    const v = vehicles.find((v) => v.id === b.vehicleId)!
    return (
      <button
        key={b.id}
        className={`client-booking ${highlight ? 'next' : ''}`}
        onClick={() => onOpenBooking(b.id)}
      >
        <span className="client-booking-date">
          <strong>{b.date === today ? 'Today' : dayLabel(b.date)}</strong>
          <span>{b.time}</span>
        </span>
        <span className="client-booking-description">
          <strong>{b.service.split(' · ')[0]}</strong>
          <span>{v.model}</span>
        </span>
        <span className="client-booking-state">
          <span className={`client-status ${b.status.toLowerCase().replaceAll(' ', '-')}`}>
            {b.status}
          </span>
          <small>{b.paid ? 'Paid' : 'Unpaid'}</small>
        </span>
        <ChevronRight size={15} />
      </button>
    )
  }
  return (
    <div className="client-profile">
      <div className="client-profile-top">
        <div className="client-identity-row">
          <span className="avatar client-avatar" style={customerColorStyle(c)}>
            {initials}
          </span>
          <div className="client-identity">
            <h2>{c.name}</h2>
            <p>
              <RegionBadge region={c.region} />
              {c.type !== 'Unclassified' && <> · {c.type}</>}
            </p>
          </div>
          {!readOnly && (
            <button
              className="btn small-btn client-edit"
              aria-label={`Edit ${c.name}`}
              aria-pressed={editing}
              onClick={() => {
                setEditing(!editing)
                setAddingVehicle(false)
              }}
            >
              <Pencil size={13} />
              Edit
            </button>
          )}
        </div>
        {(extraContact || phone) && (
          <div className="client-contact-line">
            {extraContact && <span>{extraContact}</span>}
            {phone && <a href={`tel:${phone.replace(/[^+0-9]/g, '')}`}>{phone}</a>}
          </div>
        )}
        <div className="client-quick-actions">
          {!readOnly && (
            <button className="btn primary" onClick={() => book()}>
              <CalendarDays size={15} />
              {!vehicles.length
                ? 'Add vehicle'
                : c.region === 'Unassigned'
                  ? 'Set region'
                  : 'Book a wash'}
            </button>
          )}
          {wa && (
            <a
              className="btn"
              href={wa}
              target="_blank"
              rel="noreferrer"
              title="Prepare a WhatsApp message"
            >
              <MessageSquare size={15} />
              WhatsApp
            </a>
          )}
          {phone && (
            <a
              className="btn"
              href={`tel:${phone.replace(/[^+0-9]/g, '')}`}
              aria-label={`Call ${phone}`}
            >
              <Phone size={14} />
              Call
            </a>
          )}
          {c.email && (
            <a
              className="btn client-email"
              href={`mailto:${encodeURIComponent(c.email)}`}
              aria-label={`Email ${c.email}`}
              title={c.email}
            >
              <Mail size={15} />
              <span>Email</span>
            </a>
          )}
          {!phone && !c.email && !readOnly && (
            <button className="client-text-action" onClick={() => setEditing(true)}>
              Add contact details
            </button>
          )}
        </div>
        <div className="client-tabs" role="group" aria-label="Customer profile view">
          {(['Overview', 'History', 'Bookings'] as const).map((t) => (
            <button
              key={t}
              aria-pressed={!editing && !addingVehicle && tab === t}
              onClick={() => changeTab(t)}
            >
              {t}
              {t === 'History' && activities.length > 0 && <span>{activities.length}</span>}
              {t === 'Bookings' && bookings.length > 0 && <span>{bookings.length}</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="client-profile-body">
        {editing && !readOnly ? (
          <section className="client-editor">
            <div className="client-section-heading">
              <h3>Edit customer</h3>
              <button
                className="icon-btn"
                aria-label="Cancel editing customer"
                onClick={() => setEditing(false)}
              >
                <X size={16} />
              </button>
            </div>
            <CustomerDetails
              key={c.id}
              inline
              customer={c}
              defaultDays={store.settings.reminderDays}
              onCancel={() => setEditing(false)}
              onSave={(updated) => {
                onSaveCustomer(updated)
                setEditing(false)
              }}
            />
          </section>
        ) : addingVehicle && !readOnly ? (
          <AddVehicle
            customerId={c.id}
            onCancel={() => setAddingVehicle(false)}
            onSave={(v) => {
              onAddVehicle(v)
              setAddingVehicle(false)
              setTab('Overview')
            }}
          />
        ) : tab === 'History' ? (
          <ActivityHistory activities={activities} addNote={onAddNote} readOnly={readOnly} />
        ) : tab === 'Bookings' ? (
          <div className="client-booking-list">
            {chronological.length ? (
              [...chronological].reverse().map((b) => bookingRow(b))
            ) : (
              <p className="client-empty-inline">No bookings yet.</p>
            )}
          </div>
        ) : (
          <>
            {next ? (
              <section className="client-next">
                <div className="client-section-heading">
                  <h3>{next.status === 'In progress' ? 'Current wash' : 'Next booking'}</h3>
                </div>
                {bookingRow(next, true)}
              </section>
            ) : (
              <p className="client-empty-inline">
                <CalendarDays size={14} />
                No upcoming booking
              </p>
            )}
            {outstanding > 0 && (
              <button className="client-payment-alert" onClick={() => changeTab('Bookings')}>
                {money(outstanding)} unpaid · completed washes
                <ChevronRight size={14} />
              </button>
            )}
            {(c.notes.trim() || editingNote) && (
              <section className="client-note">
                <div className="client-section-heading">
                  <h3>
                    <MessageSquare size={13} />
                    Visit notes
                  </h3>
                  {!readOnly && !editingNote && (
                    <button
                      className="client-text-action"
                      onClick={() => {
                        setNoteDraft(c.notes)
                        setEditingNote(true)
                      }}
                    >
                      Edit
                    </button>
                  )}
                </div>
                {editingNote ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      onSaveNotes(noteDraft.trim())
                      setEditingNote(false)
                    }}
                  >
                    <textarea
                      autoFocus
                      aria-label="Customer visit notes"
                      rows={3}
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                    />
                    <div className="client-form-actions">
                      <button
                        className="btn small-btn"
                        type="button"
                        onClick={() => setEditingNote(false)}
                      >
                        Cancel
                      </button>
                      <button className="btn primary small-btn" disabled={noteDraft === c.notes}>
                        Save note
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <p className={!longNote || fullNote ? '' : 'client-note-preview'}>{c.notes}</p>
                    {longNote && (
                      <button className="client-text-action" onClick={() => setFullNote(!fullNote)}>
                        {fullNote ? 'Show less' : 'Read full note'}
                      </button>
                    )}
                  </>
                )}
              </section>
            )}
            <section className="client-vehicles">
              <div className="client-section-heading">
                <h3>
                  Vehicles <span>{vehicles.length}</span>
                </h3>
                {!readOnly && (
                  <button className="client-text-action" onClick={() => setAddingVehicle(true)}>
                    <Plus size={13} />
                    Add vehicle
                  </button>
                )}
              </div>
              {vehicles.map((v) => (
                <article key={v.id} className="client-vehicle-row">
                  <button
                    className="client-vehicle-open"
                    onClick={() => onOpenVehicle(v.id)}
                    aria-label={`Open ${v.model}`}
                  >
                    <span className="client-car-symbol">
                      <CarFront size={21} />
                    </span>
                    <span className="client-car-description">
                      <strong>
                        {v.model}
                        <small
                          className={`client-size ${v.notes.startsWith('[Size review]') ? 'needs-review' : ''}`}
                        >
                          {sizeLabels[v.size] ?? 'Size needed'}
                        </small>
                      </strong>
                      <span>
                        {v.plate || 'Registration not added'}
                        {v.color && <> · {v.color}</>}
                      </span>
                      {v.notes.startsWith('[Size review]') && (
                        <small className="client-size-review">Confirm size before booking</small>
                      )}
                    </span>
                    <ChevronRight size={14} />
                  </button>
                  {!readOnly && ready && (
                    <button
                      className="btn small-btn client-car-book"
                      onClick={() =>
                        v.notes.startsWith('[Size review]') || !v.size
                          ? onOpenVehicle(v.id)
                          : book(v.id)
                      }
                      aria-label={
                        v.notes.startsWith('[Size review]') || !v.size
                          ? `Confirm size for ${v.model}`
                          : `Book ${v.model}`
                      }
                    >
                      {v.notes.startsWith('[Size review]') || !v.size ? 'Check size' : 'Book'}
                    </button>
                  )}
                </article>
              ))}
              {!vehicles.length && (
                <p className="client-empty-inline">Add a vehicle to start booking.</p>
              )}
            </section>
            <section className="client-addresses">
              <div className="client-section-heading">
                <h3>Service address{addresses.length > 1 ? 'es' : ''}</h3>
                {!readOnly && (
                  <button className="client-text-action" onClick={() => setEditing(true)}>
                    {addresses.length ? 'Edit' : 'Add'}
                  </button>
                )}
              </div>
              {addresses.map((address, i) => (
                <p key={address}>
                  <MapPin size={15} />
                  <span>
                    {address}
                    {addresses.length > 1 && i === 0 && <small>Primary</small>}
                  </span>
                </p>
              ))}
              {!addresses.length && <p className="client-empty-inline">Address not added</p>}
            </section>
            {!c.notes.trim() && !editingNote && !readOnly && (
              <button
                className="client-add-note"
                onClick={() => {
                  setNoteDraft('')
                  setEditingNote(true)
                }}
              >
                <Plus size={14} />
                Add visit note
              </button>
            )}
            {completed.length > 0 && (
              <div className="client-service-summary">
                <span>
                  Last wash <strong>{dayLabel(completed[0].date)}</strong>
                </span>
                <span>{completed.length} completed</span>
                <span>{money(completed.reduce((n, b) => n + b.price, 0))} total</span>
              </div>
            )}
            <details className="client-secondary">
              <summary>
                Contacts & reminders
                <ChevronRight size={14} />
              </summary>
              <div>
                {c.email && (
                  <p>
                    <span>Email</span>
                    <a href={`mailto:${encodeURIComponent(c.email)}`}>{c.email}</a>
                  </p>
                )}
                {(c.contacts?.length ? c.contacts : [c.contact])
                  .filter(Boolean)
                  .map((contact, i) => (
                    <p key={i}>
                      <span>{i === 0 ? 'Primary contact' : 'Contact'}</span>
                      {contact}
                    </p>
                  ))}
                <p>
                  <span>Wash interval</span>
                  {c.reminderDays ?? store.settings.reminderDays} days
                </p>
                <p>
                  <span>Wash reminders</span>
                  {c.unsubscribed ? 'Unsubscribed' : c.whatsappOptIn ? 'Opted in' : 'Not opted in'}
                </p>
              </div>
            </details>
          </>
        )}
      </div>
    </div>
  )
}
function AddVehicle({
  customerId,
  onSave,
  onCancel,
}: {
  customerId: string
  onSave: (v: Vehicle) => void
  onCancel: () => void
}) {
  const [size, setSize] = useState('')
  return (
    <form
      className="client-add-vehicle"
      onSubmit={(e) => {
        e.preventDefault()
        const data = new FormData(e.currentTarget)
        const model = String(data.get('model') ?? '').trim()
        if (!model) return
        onSave({
          id: crypto.randomUUID(),
          customerId,
          model,
          plate: String(data.get('plate') ?? '').trim(),
          color: String(data.get('color') ?? '').trim(),
          size,
          notes: '',
        })
      }}
    >
      <h3>Add vehicle</h3>
      <label className="field">
        Make and model
        <input autoFocus name="model" required placeholder="e.g. Porsche Cayenne" />
      </label>
      <div className="form-grid">
        <label className="field">
          Registration
          <input name="plate" placeholder="Optional" />
        </label>
        <label className="field">
          Size
          <Select
            aria-label="New vehicle size"
            value={size}
            onChange={(e) => setSize(e.target.value)}
          >
            <option value="">Not set</option>
            <option value="Compact">S</option>
            <option value="Sedan">M</option>
            <option value="SUV">XL</option>
          </Select>
        </label>
      </div>
      <label className="field">
        Colour
        <input name="color" placeholder="Optional" />
      </label>
      <div className="client-form-actions">
        <button className="btn" type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn primary">Add vehicle</button>
      </div>
    </form>
  )
}
