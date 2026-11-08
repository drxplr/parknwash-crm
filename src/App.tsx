import { DatePicker } from './DatePicker'
import { serviceFits, sizeLabels } from './websiteCatalog'
import { ScheduleCalendar } from './Calendar'
import type { BookingStart } from './Calendar'
import { startOfWeek, calendarRangeLabel } from './calendarModel'
import { Select } from './Select'
import { customerColorStyle } from './customerColors'
import { Messages, Settings, CustomerDetails } from './Operations'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CarFront,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Command,
  CreditCard,
  LayoutDashboard,
  MapPin,
  MessageSquare,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Users,
  X,
  Building2,
  Leaf,
  PanelLeftClose,
  RotateCcw,
} from 'lucide-react'
import {
  addDays,
  dayLabel,
  DEMO_DATE,
  loadStore,
  matches,
  money,
  overlaps,
  createDemoStore,
  tariff,
  statuses,
  STORAGE_KEY,
  customerTypeLabel,
  swissToday,
} from './model'
import type { Activity, Booking, Customer, Region, Status, Store, Vehicle } from './model'
type Page = 'Overview' | 'Bookings' | 'Customers' | 'Messages' | 'Settings'
type Detail = { kind: 'booking' | 'customer' | 'vehicle'; id: string } | null
const initials = (name: string) =>
  name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
const statusClass = (s: string) => s.toLowerCase().replaceAll(' ', '-')
function Badge({ status }: { status: Status }) {
  return (
    <span className={`badge ${statusClass(status)}`}>
      <span className="status-dot" />
      {status}
    </span>
  )
}
function Avatar({
  name,
  small = false,
  customer,
}: {
  name: string
  small?: boolean
  customer?: Customer
}) {
  return (
    <span
      style={customer ? customerColorStyle(customer) : undefined}
      className={`avatar ${small ? 'small' : ''} ${customer ? 'client-avatar' : ''}`}
    >
      {initials(name)}
    </span>
  )
}
function Empty({
  title = 'Nothing here yet',
  text = 'Try a different search or filter.',
}: {
  title?: string
  text?: string
}) {
  return (
    <div className="empty">
      <Search size={25} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  )
}
function Dialog({
  children,
  onClose,
  title,
  wide = false,
}: {
  children: ReactNode
  onClose: () => void
  title: string
  wide?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null),
    closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const previous = document.activeElement as HTMLElement
    const before = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    ref.current?.focus()
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[data-select-menu]')) {
        e.preventDefault()
        e.stopImmediatePropagation()
        closeRef.current()
      }
      if (e.key === 'Tab') {
        const els = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled),a[href],input,textarea,summary,[tabindex="0"]',
          ) ?? [],
        ).filter((el) => el.getClientRects().length > 0)
        if (!els?.length) return
        const first = els[0],
          last = els[els.length - 1]
        if (
          e.shiftKey &&
          (document.activeElement === first || document.activeElement === ref.current)
        ) {
          e.preventDefault()
          last.focus()
        } else if (
          !e.shiftKey &&
          (document.activeElement === last || document.activeElement === ref.current)
        ) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', key, true)
    return () => {
      document.body.style.overflow = before
      document.removeEventListener('keydown', key, true)
      previous?.focus()
    }
  }, [])
  return (
    <div
      className={`overlay ${wide ? 'centered' : ''}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={wide ? 'modal' : 'drawer'}
      >
        <div className="dialog-top">
          <span>{title}</span>
          <button className="icon-btn" aria-label="Close dialog" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
export interface CloudMode {
  initial: Store
  role: 'admin' | 'editor' | 'viewer'
  label: string
  commit: (before: Store, after: Store) => Promise<Store>
  reload: () => Promise<void>
  signOut: () => void
}
export default function App({ cloud }: { cloud?: CloudMode }) {
  const today = cloud ? swissToday() : DEMO_DATE
  const [store, setLocalStore] = useState<Store>(() => cloud?.initial ?? loadStore()),
    [page, setPage] = useState<Page>('Bookings'),
    [region, setRegion] = useState<Region | 'All regions'>('All regions'),
    [staffFilter, setStaffFilter] = useState('All staff'),
    [detail, setDetail] = useState<Detail>(null),
    [searchOpen, setSearchOpen] = useState(false),
    [query, setQuery] = useState(''),
    [newBooking, setNewBooking] = useState(false),
    [bookingStart, setBookingStart] = useState<BookingStart | undefined>(),
    [toast, setToastRaw] = useState(''),
    [storageError, setStorageError] = useState(false),
    [menuOpen, setMenuOpen] = useState(false),
    [resetOpen, setResetOpen] = useState(false),
    [addCustomerOpen, setAddCustomerOpen] = useState(false)
  const [view, setView] = useState<'List' | 'Calendar'>('Calendar'),
    [date, setDate] = useState(today),
    [range, setRange] = useState<'Day' | 'Week'>('Week'),
    [status, setStatus] = useState('All active'),
    [customerType, setCustomerType] = useState('All customers'),
    [tableSearch, setTableSearch] = useState(''),
    [directoryView, setDirectoryView] = useState<'Customers' | 'Vehicles'>('Customers'),
    [sort, setSort] = useState('Name A–Z')
  const busy = useRef(false),
    queuedToast = useRef('')
  const [saving, setSaving] = useState(false),
    [saveError, setSaveError] = useState(''),
    [resetKey, setResetKey] = useState(0)
  const setToast = (message: string) => {
    if (busy.current) queuedToast.current = message
    else setToastRaw(message)
  }
  function setStore(update: Store | ((previous: Store) => Store)) {
    if (busy.current) return
    const next = typeof update === 'function' ? update(store) : update
    if (!cloud) {
      setLocalStore(next)
      return
    }
    if (cloud.role === 'viewer') {
      setSaveError('Your account has read-only access.')
      return
    }
    busy.current = true
    queuedToast.current = ''
    setSaving(true)
    setSaveError('')
    void cloud
      .commit(store, next)
      .then((saved) => {
        setLocalStore(saved)
        setToastRaw(queuedToast.current || 'Saved')
      })
      .catch((error) => {
        setDetail(null)
        setNewBooking(false)
        setAddCustomerOpen(false)
        setResetKey((k) => k + 1)
        setSaveError(
          `Not saved. ${error instanceof Error ? error.message : 'Please reload and try again.'}`,
        )
      })
      .finally(() => {
        busy.current = false
        setSaving(false)
        queuedToast.current = ''
      })
  }
  useEffect(() => {
    if (cloud) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
      setStorageError(false)
    } catch {
      setStorageError(true)
    }
  }, [store])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 3500)
    return () => clearTimeout(t)
  }, [toast])
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])
  const { staff } = store.settings
  const customer = (id: string) => store.customers.find((c) => c.id === id)!
  const vehicle = (id: string) => store.vehicles.find((v) => v.id === id)!
  const owner = (b: Booking) => customer(vehicle(b.vehicleId).customerId)
  const inRegion = (c: Customer) => region === 'All regions' || c.region === region
  const filtered = store.bookings.filter(
    (b) => inRegion(owner(b)) && (staffFilter === 'All staff' || b.staffIds.includes(staffFilter)),
  )
  const todays = filtered
    .filter((b) => b.date === today && b.status !== 'Cancelled')
    .sort((a, b) => a.time.localeCompare(b.time))
  const pending = todays.filter((b) => b.status === 'Pending')
  const rangeStart = range === 'Week' ? startOfWeek(date) : date
  const rangeEnd = addDays(rangeStart, range === 'Week' ? 6 : 0)
  const visibleBookings = filtered
    .filter(
      (b) =>
        b.date >= rangeStart &&
        b.date <= rangeEnd &&
        (status === 'All statuses' ||
          (status === 'All active' ? b.status !== 'Cancelled' : b.status === status)),
    )
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
  const lastVisit = (customerId: string, vehicleId?: string) =>
    store.bookings
      .filter(
        (b) =>
          b.status === 'Completed' &&
          (vehicleId ? b.vehicleId === vehicleId : owner(b).id === customerId),
      )
      .map((b) => b.date + b.time)
      .sort()
      .at(-1) ?? ''
  function compareCustomers(a: Customer, b: Customer) {
    if (sort === 'Name Z–A') return b.name.localeCompare(a.name)
    if (sort === 'Region') return a.region.localeCompare(b.region) || a.name.localeCompare(b.name)
    if (sort === 'Most recent visit')
      return lastVisit(b.id).localeCompare(lastVisit(a.id)) || a.name.localeCompare(b.name)
    if (sort === 'Most vehicles')
      return (
        store.vehicles.filter((v) => v.customerId === b.id).length -
          store.vehicles.filter((v) => v.customerId === a.id).length || a.name.localeCompare(b.name)
      )
    return a.name.localeCompare(b.name)
  }
  const navigate = (p: Page) => {
    setPage(p)
    setTableSearch('')
    setMenuOpen(false)
  }
  const openCustomer = (id: string) => setDetail({ kind: 'customer', id })
  function record(b: Booking, title: string, text: string): Activity {
    return {
      id: crypto.randomUUID(),
      customerId: owner(b).id,
      vehicleId: b.vehicleId,
      bookingId: b.id,
      at: new Date().toISOString(),
      title,
      text,
      kind: title.includes('Payment') ? 'payment' : 'booking',
      author: cloud?.label ?? 'Demo manager',
    }
  }
  function updateBooking(id: string, patch: Partial<Booking>) {
    const b = store.bookings.find((x) => x.id === id)!
    const changed = { ...b, ...patch }
    if (
      changed.status !== 'Cancelled' &&
      store.bookings.some((x) => x.id !== id && overlaps(changed, x))
    ) {
      setToast('Cannot save: assigned staff already have a booking at this time.')
      return
    }
    const start = Number(changed.time.slice(0, 2)) * 60 + Number(changed.time.slice(3))
    if (start < 420 || start + changed.duration > 1200) {
      setToast('Choose a service time between 07:00 and 20:00.')
      return
    }
    const text = Object.entries(patch)
      .map(([k, v]) =>
        k === 'staffIds'
          ? `Team: ${(v as string[]).map((id) => staff.find((s) => s.id === id)?.name).join(', ')}`
          : k === 'paid'
            ? `Payment ${v ? 'received' : 'pending'}`
            : k === 'status'
              ? `Status: ${v}`
              : k === 'notes'
                ? 'Booking notes updated'
                : `${k}: ${v}`,
      )
      .join(' · ')
    setStore((s) => ({
      ...s,
      bookings: s.bookings.map((x) => (x.id === id ? changed : x)),
      activities: [
        record(b, 'paid' in patch ? 'Payment updated' : 'Booking updated', text),
        ...s.activities,
      ],
    }))
    setToast('Booking updated')
  }
  function saveNotes(kind: 'customer' | 'vehicle', id: string, text: string) {
    const cId = kind === 'customer' ? id : vehicle(id).customerId
    const a: Activity = {
      id: crypto.randomUUID(),
      customerId: cId,
      vehicleId: kind === 'vehicle' ? id : undefined,
      at: new Date().toISOString(),
      title: kind === 'customer' ? 'Client notes updated' : 'Vehicle notes updated',
      text: text || 'Notes cleared.',
      kind: 'note',
      author: cloud?.label ?? 'Demo manager',
    }
    setStore((s) =>
      kind === 'customer'
        ? {
            ...s,
            customers: s.customers.map((c) => (c.id === id ? { ...c, notes: text } : c)),
            activities: [a, ...s.activities],
          }
        : {
            ...s,
            vehicles: s.vehicles.map((v) => (v.id === id ? { ...v, notes: text } : v)),
            activities: [a, ...s.activities],
          },
    )
    setToast('Notes saved')
  }
  function addNote(customerId: string, text: string, vehicleId?: string) {
    setStore((s) => ({
      ...s,
      activities: [
        {
          id: crypto.randomUUID(),
          customerId,
          vehicleId,
          at: new Date().toISOString(),
          title: 'Internal note',
          text,
          kind: 'note',
          author: cloud?.label ?? 'Demo manager',
        },
        ...s.activities,
      ],
    }))
    setToast('Note added to history')
  }
  const bookingRows = (items: Booking[], showDate = false) => (
    <div className="table-scroll">
      <table className="bookings-table">
        <thead>
          <tr>
            <th>{showDate ? 'Date & time' : 'Time'}</th>
            <th>Customer / vehicle</th>
            <th>Service</th>
            <th>Team</th>
            <th>Status</th>
            <th className="align-right">Amount</th>
            <th aria-label="Open details" />
          </tr>
        </thead>
        <tbody>
          {items.map((b) => (
            <tr key={b.id} onClick={() => setDetail({ kind: 'booking', id: b.id })}>
              <td>
                <strong>{b.time}</strong>
                <span className="sub">{showDate ? dayLabel(b.date) : `${b.duration} min`}</span>
              </td>
              <td>
                <button
                  className="cell-link"
                  onClick={(e) => {
                    e.stopPropagation()
                    openCustomer(owner(b).id)
                  }}
                >
                  <span className="client-dot" style={customerColorStyle(owner(b))} />
                  {owner(b).name}
                  {owner(b).type === 'Business' && <Building2 size={12} />}
                </button>
                <span className="sub">
                  {vehicle(b.vehicleId).model}{' '}
                  <span className="text-faint">· {vehicle(b.vehicleId).plate}</span>
                </span>
              </td>
              <td>
                {b.service.split(' · ')[0]}
                <span className="sub">
                  <MapPin size={11} />
                  {owner(b).region}
                </span>
              </td>
              <td>
                <div className="avatar-stack">
                  {b.staffIds.map((id) => (
                    <span title={staff.find((s) => s.id === id)?.name} key={id}>
                      <Avatar small name={staff.find((s) => s.id === id)!.name} />
                    </span>
                  ))}
                </div>
              </td>
              <td>
                <Badge status={b.status} />
              </td>
              <td className="align-right amount">
                {money(b.price)}
                <span className={`sub ${b.paid ? 'text-green' : ''}`}>
                  {b.paid ? 'Paid' : 'Unpaid'}
                </span>
              </td>
              <td>
                <button className="row-arrow" aria-label={`Open booking ${b.id}`}>
                  <ChevronRight size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!items.length && (
        <Empty
          title="No bookings in this view"
          text="Choose another date or create a new booking."
        />
      )}
    </div>
  )
  return (
    <>
      {saving && (
        <div className="cloud-saving" role="status">
          Saving…
        </div>
      )}
      <div className="app-shell" aria-busy={saving} inert={saving}>
        {saveError && (
          <div className="cloud-error" role="alert">
            <span>{saveError}</span>
            <button className="btn small-btn" onClick={() => void cloud?.reload()}>
              Reload latest data
            </button>
            <button
              className="icon-btn"
              aria-label="Dismiss error"
              onClick={() => setSaveError('')}
            >
              <X size={16} />
            </button>
          </div>
        )}
        <aside className={`sidebar ${menuOpen ? 'mobile-open' : ''}`}>
          <button
            className="sidebar-close icon-btn"
            aria-label="Close navigation"
            onClick={() => setMenuOpen(false)}
          >
            <X size={16} />
          </button>
          <a
            className="brand"
            href="#"
            onClick={(e) => {
              e.preventDefault()
              navigate('Overview')
            }}
          >
            <div className="brand-icon">
              <img src={`${import.meta.env.BASE_URL}brand-mark.svg`} alt="" aria-hidden="true" />
            </div>
            <div>
              park n wash<span>Team workspace</span>
            </div>
          </a>
          <div className="sidebar-section">Workspace</div>
          <nav>
            {(
              [
                { name: 'Overview', icon: LayoutDashboard },
                { name: 'Bookings', icon: CalendarDays },
                { name: 'Customers', icon: Users },
                { name: 'Messages', icon: MessageSquare },
                { name: 'Settings', icon: SlidersHorizontal },
              ] as const
            ).map(({ name, icon: Icon }) => (
              <button
                key={name}
                className={`nav-link ${page === name ? 'active' : ''}`}
                aria-current={page === name ? 'page' : undefined}
                onClick={() => navigate(name)}
              >
                <Icon size={17} />
                {name}
                {name === 'Bookings' && (
                  <span className="nav-count">
                    {
                      store.bookings.filter((b) => b.date === today && b.status !== 'Cancelled')
                        .length
                    }
                  </span>
                )}
              </button>
            ))}
          </nav>
          <div className="sidebar-section locations-label">Regions</div>
          <div className="location-list">
            {(['Geneva', 'Ticino'] as Region[]).map((r) => (
              <button
                onClick={() => setRegion(region === r ? 'All regions' : r)}
                key={r}
                className={region === r ? 'selected' : ''}
                aria-pressed={region === r}
              >
                <span className={`location-dot ${r === 'Ticino' ? 'purple' : ''}`} />
                {r}
                <span>
                  {region === r && <Check size={14} aria-hidden="true" />}
                  {store.customers.filter((c) => c.region === r).length}
                </span>
              </button>
            ))}
          </div>
          <div className="sidebar-bottom">
            <div className="demo-card">
              <div>
                <span className="live-dot" />
                {cloud ? 'Shared workspace' : 'Demo · fictional data'}
              </div>

              <button onClick={() => (cloud ? cloud.signOut() : setResetOpen(true))}>
                {cloud ? 'Sign out' : 'Reset demo'} <RotateCcw size={12} />
              </button>
            </div>
            <a className="demo-switch" href={cloud ? '?demo=1' : '?'}>
              {cloud ? 'Explore demo' : 'Back to live workspace'}
              <ArrowUpRight size={13} />
            </a>
            <div className="profile">
              <Avatar name={cloud?.label ?? 'Demo Manager'} />
              <div>
                {cloud?.label ?? 'Demo manager'}
                <span>{cloud?.role ?? 'Park n Wash team'}</span>
              </div>
              <Leaf size={17} />
            </div>
          </div>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <div className="breadcrumbs">
              <button
                className="mobile-toggle icon-btn"
                aria-label="Toggle navigation"
                onClick={() => setMenuOpen(!menuOpen)}
              >
                <PanelLeftClose size={18} />
              </button>
              <span>Workspace</span>
              <ChevronRight size={13} />
              <strong>{page}</strong>
            </div>
            <button
              className="global-search"
              aria-label="Search workspace"
              onClick={() => {
                setQuery('')
                setSearchOpen(true)
              }}
            >
              <Search size={15} />
              <span>Search anything...</span>
              <kbd>⌘ K</kbd>
            </button>
            <span className="topbar-avatar">
              <Avatar small name={cloud?.label ?? 'Demo Manager'} />
            </span>
          </header>
          <main>
            <div className="page-heading">
              <div>
                <h1>{page === 'Overview' ? 'Today' : page}</h1>
              </div>
              {page === 'Customers' && cloud?.role !== 'viewer' && (
                <button className="btn primary" onClick={() => setAddCustomerOpen(true)}>
                  <Plus size={16} />
                  Add customer
                </button>
              )}
              {(page === 'Bookings' || page === 'Overview') && (
                <button
                  className="btn primary"
                  disabled={cloud?.role === 'viewer'}
                  onClick={() => {
                    if (!store.settings.services.length || !staff.length) {
                      if (!cloud || cloud.role === 'admin') navigate('Settings')
                      else setToast('Ask an administrator to add services and staff.')
                      return
                    }
                    if (
                      !store.vehicles.some((v) =>
                        store.customers.some((c) => c.id === v.customerId),
                      )
                    ) {
                      navigate('Customers')
                      return
                    }

                    setBookingStart({
                      date,
                      time: '09:00',
                      staffId: staffFilter === 'All staff' ? undefined : staffFilter,
                    })
                    setNewBooking(true)
                  }}
                >
                  <Plus size={16} />
                  {!store.settings.services.length || !staff.length
                    ? 'Set up calendar'
                    : 'New booking'}
                </button>
              )}
            </div>
            {page !== 'Settings' && (
              <div className="context-bar">
                <div className="context-date">
                  <CalendarDays size={15} />
                  {page === 'Overview'
                    ? dayLabel(today, {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })
                    : page === 'Bookings'
                      ? 'Zurich time'
                      : 'Workspace'}
                  {!cloud && <span className="demo-label">Demo</span>}
                </div>
                <div className="filters">
                  <label className="select-wrap">
                    <MapPin size={14} />
                    <Select
                      aria-label="Filter region"
                      value={region}
                      onChange={(e) => setRegion(e.target.value as Region | 'All regions')}
                    >
                      <option>All regions</option>
                      <option>Geneva</option>
                      <option>Ticino</option>
                    </Select>
                  </label>
                  {(page === 'Overview' || page === 'Bookings') && (
                    <label className="select-wrap">
                      <Users size={14} />
                      <Select
                        aria-label="Filter staff"
                        value={staffFilter}
                        onChange={(e) => setStaffFilter(e.target.value)}
                      >
                        <option>All staff</option>
                        {staff.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </Select>
                    </label>
                  )}
                </div>
              </div>
            )}
            {storageError && (
              <div role="alert" className="notice">
                Browser storage is unavailable. Changes will last only for this session.
              </div>
            )}
            {page === 'Overview' && (
              <>
                <section className="stats-grid">
                  {[
                    {
                      label: "Today's bookings",
                      value: todays.length,
                      foot: `Across ${new Set(todays.map((b) => owner(b).region)).size} locations`,
                      icon: CalendarDays,
                    },
                    {
                      label: 'To confirm',
                      value: pending.length,
                      foot: 'Awaiting confirmation',
                      icon: Clock3,
                    },
                    {
                      label: 'Completed',
                      value: todays.filter((b) => b.status === 'Completed').length,
                      foot: 'Services finished',
                      icon: CheckCheck,
                    },
                    {
                      label: 'Scheduled value',
                      value: money(todays.reduce((n, b) => n + b.price, 0)),
                      foot: `${money(todays.filter((b) => b.paid).reduce((n, b) => n + b.price, 0))} collected`,
                      icon: CreditCard,
                    },
                  ].map((s, i) => (
                    <div className="stat" key={s.label}>
                      <div className="stat-label">
                        {s.label}
                        <s.icon size={16} />
                      </div>
                      <div className="stat-value">
                        {s.value}
                        {i === 2 && (
                          <span className="stat-check">
                            <Check size={15} />
                          </span>
                        )}
                      </div>
                      {i === 3 && (
                        <div className="stat-foot">
                          <ArrowDownLeft size={12} /> {s.foot}
                        </div>
                      )}
                    </div>
                  ))}
                </section>
                <div className="overview-grid">
                  <div>
                    <section className="card schedule-card">
                      <div className="section-heading">
                        <div>
                          <h2>
                            Today's schedule <span className="count-pill">{todays.length}</span>
                          </h2>
                        </div>
                        <button
                          className="text-button"
                          onClick={() => {
                            navigate('Bookings')
                            setDate(today)
                          }}
                        >
                          All bookings <ArrowRight size={14} />
                        </button>
                      </div>
                      {bookingRows(todays)}
                      <div className="table-footer">
                        <span>Zurich time</span>
                        <span>
                          {todays.length} bookings ·{' '}
                          {(todays.reduce((n, b) => n + b.duration, 0) / 60).toFixed(1)} service
                          hours
                        </span>
                      </div>
                    </section>
                  </div>
                  <div className="right-column">
                    <section className="card attention-card">
                      <div className="section-heading">
                        <h2>
                          <span className="amber-dot" />
                          Needs attention
                        </h2>
                        <span className="count-pill">{pending.length}</span>
                      </div>
                      {pending.length ? (
                        pending.map((b) => (
                          <button
                            className="attention-item"
                            key={b.id}
                            onClick={() => setDetail({ kind: 'booking', id: b.id })}
                          >
                            <div className="attention-icon">
                              <Clock3 size={17} />
                            </div>
                            <div>
                              <strong>{owner(b).name}</strong>
                              <p>{vehicle(b.vehicleId).model}</p>
                              <span>{b.time} · To confirm</span>
                            </div>
                            <ChevronRight size={14} />
                          </button>
                        ))
                      ) : (
                        <div className="all-clear">
                          <CheckCheck size={20} />
                          All confirmed
                        </div>
                      )}
                    </section>
                    <section className="card team-card">
                      <div className="section-heading">
                        <h2>Team today</h2>
                        <span className="muted">
                          {
                            staff.filter(
                              (s) =>
                                (region === 'All regions' || s.region === region) &&
                                (staffFilter === 'All staff' || s.id === staffFilter),
                            ).length
                          }{' '}
                          staff
                        </span>
                      </div>
                      {staff
                        .filter(
                          (s) =>
                            (region === 'All regions' || s.region === region) &&
                            (staffFilter === 'All staff' || s.id === staffFilter),
                        )
                        .map((s) => (
                          <button
                            className="team-row"
                            key={s.id}
                            onClick={() => {
                              setStaffFilter(s.id)
                              setRange('Day')
                              setView('Calendar')
                              navigate('Bookings')
                              setDate(today)
                            }}
                          >
                            <Avatar name={s.name} />
                            <div>
                              <strong>{s.name}</strong>
                              <span>{s.region}</span>
                            </div>
                            <span>
                              {todays.filter((b) => b.staffIds.includes(s.id)).length} jobs
                            </span>
                          </button>
                        ))}
                    </section>
                  </div>
                </div>
              </>
            )}
            {page === 'Bookings' && (
              <section className="card">
                <div className="booking-toolbar">
                  <div className="segmented">
                    {(['Calendar', 'List'] as const).map((v) => (
                      <button
                        className={view === v ? 'selected' : ''}
                        aria-pressed={view === v}
                        key={v}
                        onClick={() => setView(v)}
                      >
                        {v === 'List' ? (
                          <SlidersHorizontal size={14} />
                        ) : (
                          <CalendarDays size={14} />
                        )}{' '}
                        {v}
                      </button>
                    ))}
                  </div>
                  <div className="date-nav">
                    <button
                      className="icon-btn"
                      aria-label="Previous date range"
                      onClick={() => setDate(addDays(date, range === 'Week' ? -7 : -1))}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <DatePicker
                      value={date}
                      today={today}
                      label={calendarRangeLabel(rangeStart, rangeEnd)}
                      onChange={setDate}
                    />
                    <button
                      className="icon-btn"
                      aria-label="Next date range"
                      onClick={() => setDate(addDays(date, range === 'Week' ? 7 : 1))}
                    >
                      <ChevronRight size={16} />
                    </button>
                    <button
                      className="btn small-btn"
                      title={cloud ? 'Today · Europe/Zurich' : 'Demo today · 9 November 2026'}
                      onClick={() => setDate(today)}
                    >
                      Today
                    </button>
                  </div>
                  <div className="booking-controls">
                    <Select
                      aria-label="Date range"
                      value={range}
                      onChange={(e) => setRange(e.target.value as 'Day' | 'Week')}
                    >
                      <option>Week</option>
                      <option>Day</option>
                    </Select>
                    <Select
                      aria-label="Booking status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      <option>All active</option>
                      <option>All statuses</option>
                      {statuses.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </Select>
                  </div>
                </div>
                <div className="schedule-context">
                  <span>
                    <strong>{visibleBookings.length}</strong> bookings ·{' '}
                    {range === 'Week' ? 'Week' : 'Day'} · Europe/Zurich
                  </span>
                  {!cloud && <span className="demo-label">Fictional demo bookings</span>}
                </div>
                {cloud && (!staff.length || !store.settings.services.length) && (
                  <div className="setup-notice">
                    <div>
                      <strong>Finish setting up your calendar</strong>
                      <p>
                        {!store.settings.services.length ? 'Add your care packages and ' : 'Add '}
                        the real team to start scheduling.
                      </p>
                    </div>
                    {cloud.role === 'admin' && (
                      <button className="btn" onClick={() => navigate('Settings')}>
                        Open settings <ArrowRight size={14} />
                      </button>
                    )}
                    <a className="btn" href="?demo=1">
                      Preview with demo bookings
                    </a>
                  </div>
                )}
                {(status !== 'All active' ||
                  region !== 'All regions' ||
                  staffFilter !== 'All staff') && (
                  <div className="calendar-filter-state">
                    <span>
                      {[
                        region !== 'All regions' ? region : '',
                        staffFilter !== 'All staff'
                          ? staff.find((s) => s.id === staffFilter)?.name
                          : '',
                        status !== 'All active' ? status : '',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                    <button
                      onClick={() => {
                        setRegion('All regions')
                        setStaffFilter('All staff')
                        setStatus('All active')
                      }}
                    >
                      Clear filters <X size={12} />
                    </button>
                  </div>
                )}
                {view === 'List' ? (
                  bookingRows(visibleBookings, true)
                ) : (
                  <ScheduleCalendar
                    store={store}
                    today={today}
                    bookings={visibleBookings}
                    team={staff.filter(
                      (s) =>
                        (region === 'All regions' || s.region === region) &&
                        (staffFilter === 'All staff' || s.id === staffFilter),
                    )}
                    date={date}
                    start={rangeStart}
                    range={range}
                    canCreate={
                      (!cloud || cloud.role !== 'viewer') &&
                      !!store.settings.services.length &&
                      !!staff.length &&
                      !!store.vehicles.length
                    }
                    onOpen={(id) => setDetail({ kind: 'booking', id })}
                    onDay={(day) => {
                      setDate(day)
                      setRange('Day')
                    }}
                    onCreate={(context) => {
                      if (
                        !cloud ||
                        (cloud.role !== 'viewer' &&
                          store.settings.services.length &&
                          staff.length &&
                          store.vehicles.length)
                      ) {
                        setBookingStart(context)
                        setNewBooking(true)
                      }
                    }}
                  />
                )}
                <div className="table-footer">
                  <span>
                    {visibleBookings.length} bookings in this {range.toLowerCase()}
                  </span>
                  <span>Times in Europe/Zurich</span>
                </div>
              </section>
            )}
            {page === 'Customers' && (
              <div className="directory-controls">
                <div className="segmented" aria-label="Directory view">
                  {(['Customers', 'Vehicles'] as const).map((v) => (
                    <button
                      key={v}
                      aria-pressed={directoryView === v}
                      className={directoryView === v ? 'selected' : ''}
                      onClick={() => {
                        setDirectoryView(v)
                        setTableSearch('')
                      }}
                    >
                      {v === 'Customers' ? <Users size={15} /> : <CarFront size={15} />} {v}
                      <span className="count-pill">
                        {v === 'Customers'
                          ? store.customers.filter(inRegion).length
                          : store.vehicles.filter((v) => inRegion(customer(v.customerId))).length}
                      </span>
                    </button>
                  ))}
                </div>
                <Select
                  aria-label="Sort directory"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  {['Name A–Z', 'Name Z–A', 'Region', 'Most recent visit', 'Most vehicles'].map(
                    (s) => (
                      <option key={s}>{s}</option>
                    ),
                  )}
                </Select>
              </div>
            )}
            {page === 'Customers' && directoryView === 'Customers' && (
              <section className="card">
                <div className="listing-toolbar">
                  <div className="tabs">
                    {['All customers', 'Private', 'Business', 'Unclassified'].map((t) => (
                      <button
                        className={customerType === t ? 'selected' : ''}
                        aria-pressed={customerType === t}
                        key={t}
                        onClick={() => setCustomerType(t)}
                      >
                        {t === 'Unclassified' ? 'Not set' : t}{' '}
                        <span>
                          {
                            store.customers.filter(
                              (c) => inRegion(c) && (t === 'All customers' || c.type === t),
                            ).length
                          }
                        </span>
                      </button>
                    ))}
                  </div>
                  <label className="table-search">
                    <Search size={14} />
                    <input
                      value={tableSearch}
                      onChange={(e) => setTableSearch(e.target.value)}
                      placeholder="Name, phone, car or registration…"
                      aria-label="Search customers"
                    />
                  </label>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Type</th>
                        <th>Region</th>
                        <th>Cars & registrations</th>
                        <th>Last visit</th>
                        <th className="align-right">Lifetime value</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {store.customers
                        .filter(
                          (c) =>
                            inRegion(c) &&
                            (customerType === 'All customers' || c.type === customerType) &&
                            matches(
                              tableSearch,
                              c.name,
                              c.contact,
                              c.email,
                              c.phone ?? '',
                              ...store.vehicles
                                .filter((v) => v.customerId === c.id)
                                .flatMap((v) => [v.model, v.plate]),
                            ),
                        )
                        .sort((a, b) => compareCustomers(a, b))
                        .map((c) => {
                          const bs = store.bookings.filter(
                            (b) => owner(b).id === c.id && b.status === 'Completed',
                          )
                          return (
                            <tr key={c.id} onClick={() => openCustomer(c.id)}>
                              <td>
                                <button
                                  className="customer-name cell-link"
                                  onClick={() => openCustomer(c.id)}
                                >
                                  <Avatar name={c.name} customer={c} />
                                  <div>
                                    <strong>{c.name}</strong>
                                    <span className="sub">{c.email}</span>
                                  </div>
                                </button>
                              </td>
                              <td>
                                <span
                                  className={`type-tag ${c.type === 'Business' ? 'business' : ''}`}
                                >
                                  {c.type === 'Business' ? (
                                    <Building2 size={12} />
                                  ) : c.type === 'Unclassified' ? (
                                    <Clock3 size={12} />
                                  ) : (
                                    <Users size={12} />
                                  )}{' '}
                                  {customerTypeLabel(c.type)}
                                </span>
                              </td>
                              <td>
                                <span
                                  className={`location-dot ${c.region === 'Ticino' ? 'purple' : ''}`}
                                />
                                {c.region}
                              </td>
                              <td>
                                <div className="directory-cars">
                                  {store.vehicles
                                    .filter((v) => v.customerId === c.id)
                                    .slice(0, 2)
                                    .map((v) => (
                                      <span key={v.id}>
                                        {v.model}
                                        {v.plate && <small>{v.plate}</small>}
                                      </span>
                                    ))}
                                  {store.vehicles.filter((v) => v.customerId === c.id).length >
                                    2 && (
                                    <small>
                                      +
                                      {store.vehicles.filter((v) => v.customerId === c.id).length -
                                        2}{' '}
                                      more
                                    </small>
                                  )}
                                </div>
                              </td>
                              <td>
                                {bs.length
                                  ? dayLabel(
                                      bs
                                        .map((b) => b.date)
                                        .sort()
                                        .at(-1)!,
                                    )
                                  : '—'}
                              </td>
                              <td className="align-right amount">
                                {money(bs.reduce((n, b) => n + b.price, 0))}
                              </td>
                              <td>
                                <ChevronRight size={15} />
                              </td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                  {!store.customers.some(
                    (c) =>
                      inRegion(c) &&
                      (customerType === 'All customers' || c.type === customerType) &&
                      matches(
                        tableSearch,
                        c.name,
                        c.contact,
                        c.email,
                        c.phone ?? '',
                        ...store.vehicles
                          .filter((v) => v.customerId === c.id)
                          .flatMap((v) => [v.model, v.plate]),
                      ),
                  ) && <Empty />}
                </div>
                <div className="table-footer">
                  One customer. All their cars, visits and little details.
                </div>
              </section>
            )}
            {page === 'Customers' && directoryView === 'Vehicles' && (
              <section className="card">
                <div className="listing-toolbar">
                  <h2>
                    Vehicle directory{' '}
                    <span className="count-pill">
                      {store.vehicles.filter((v) => inRegion(customer(v.customerId))).length}
                    </span>
                  </h2>
                  <label className="table-search">
                    <Search size={14} />
                    <input
                      value={tableSearch}
                      onChange={(e) => setTableSearch(e.target.value)}
                      placeholder="Model, plate or owner..."
                      aria-label="Search vehicles"
                    />
                  </label>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Vehicle</th>
                        <th>License plate</th>
                        <th>Customer</th>
                        <th>Region</th>
                        <th>Last service</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {store.vehicles
                        .filter(
                          (v) =>
                            inRegion(customer(v.customerId)) &&
                            matches(tableSearch, v.model, v.plate, customer(v.customerId).name),
                        )
                        .sort((a, b) =>
                          sort === 'Name A–Z'
                            ? a.model.localeCompare(b.model)
                            : sort === 'Name Z–A'
                              ? b.model.localeCompare(a.model)
                              : sort === 'Most recent visit'
                                ? lastVisit(b.customerId, b.id).localeCompare(
                                    lastVisit(a.customerId, a.id),
                                  )
                                : compareCustomers(customer(a.customerId), customer(b.customerId)),
                        )
                        .map((v) => {
                          const last = store.bookings
                            .filter((b) => b.vehicleId === v.id && b.status === 'Completed')
                            .sort((a, b) => b.date.localeCompare(a.date))[0]
                          return (
                            <tr key={v.id} onClick={() => setDetail({ kind: 'vehicle', id: v.id })}>
                              <td>
                                <div className="vehicle-cell">
                                  <span className="car-icon">
                                    <CarFront size={23} />
                                  </span>
                                  <div>
                                    <strong>
                                      {v.model}{' '}
                                      <small
                                        className="vehicle-size"
                                        title={
                                          v.notes.startsWith('[Size review]')
                                            ? 'Size needs review'
                                            : 'Vehicle size'
                                        }
                                      >
                                        {sizeLabels[v.size] ?? '—'}
                                        {v.notes.startsWith('[Size review]') ? ' ?' : ''}
                                      </small>
                                    </strong>
                                    <span className="sub">
                                      {v.color} · {sizeLabels[v.size] ?? v.size}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span className="plate">{v.plate}</span>
                              </td>
                              <td>
                                <button
                                  className="cell-link"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    openCustomer(v.customerId)
                                  }}
                                >
                                  {customer(v.customerId).name}
                                  <ArrowUpRight size={12} />
                                </button>
                              </td>
                              <td>{customer(v.customerId).region}</td>
                              <td>{last ? dayLabel(last.date) : 'No visits yet'}</td>
                              <td>
                                <button className="row-arrow" aria-label={`Open ${v.model}`}>
                                  <ChevronRight size={16} />
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                  {!store.vehicles.some(
                    (v) =>
                      inRegion(customer(v.customerId)) &&
                      matches(tableSearch, v.model, v.plate, customer(v.customerId).name),
                  ) && <Empty />}
                </div>
              </section>
            )}
            {page === 'Messages' && (
              <Messages
                key={resetKey}
                live={!!cloud}
                store={store}
                setStore={setStore}
                region={region}
                openCustomer={openCustomer}
              />
            )}
            {page === 'Settings' && (
              <Settings
                key={resetKey}
                store={store}
                onSave={(settings) => {
                  setStore((s) => ({ ...s, settings }))
                  setToast('Settings saved')
                }}
              />
            )}
          </main>
        </div>
        {detail &&
          (detail.kind === 'booking' ? store.bookings.some((b) => b.id === detail.id) : true) && (
            <Dialog
              key={`${detail.kind}-${detail.id}`}
              title={
                detail.kind === 'booking'
                  ? `Bookings / ${detail.id}`
                  : detail.kind === 'customer'
                    ? 'Customers / Profile'
                    : 'Vehicles / Profile'
              }
              onClose={() => setDetail(null)}
            >
              {detail.kind === 'booking'
                ? (() => {
                    const b = store.bookings.find((b) => b.id === detail.id)!,
                      v = vehicle(b.vehicleId),
                      c = customer(v.customerId)
                    return (
                      <BookingDetail
                        booking={b}
                        staff={staff}
                        vehicle={v}
                        customer={c}
                        onUpdate={(patch) => updateBooking(b.id, patch)}
                        openCustomer={() => openCustomer(c.id)}
                        openVehicle={() => setDetail({ kind: 'vehicle', id: v.id })}
                      />
                    )
                  })()
                : detail.kind === 'customer'
                  ? (() => {
                      const c = customer(detail.id)
                      return (
                        <Profile
                          key={c.id}
                          title={c.name}
                          subtitle={`${customerTypeLabel(c.type)} · ${c.region}`}
                          customer={c}
                          notes={c.notes}
                          saveNotes={(text) => saveNotes('customer', c.id, text)}
                          activities={store.activities.filter((a) => a.customerId === c.id)}
                          addNote={(text) => addNote(c.id, text)}
                          bookings={store.bookings.filter((b) => owner(b).id === c.id)}
                          renderBookings={(bs) => bookingRows(bs, true)}
                        >
                          <div className="contact-summary">
                            <div>
                              <span>Contact</span>
                              <strong>{c.contact || c.name}</strong>
                              <div className="contact-actions">
                                {c.phone ? (
                                  <a href={`tel:${c.phone.replace(/[^+0-9]/g, '')}`}>{c.phone}</a>
                                ) : (
                                  <span>Phone not added</span>
                                )}
                                {c.email && <a href={`mailto:${c.email}`}>{c.email}</a>}
                              </div>
                            </div>
                            <div>
                              <span>Service addresses</span>
                              {(c.addresses?.length ? c.addresses : [c.address])
                                .filter(Boolean)
                                .map((address, i) => (
                                  <p key={i}>
                                    <MapPin size={14} />
                                    {address}
                                  </p>
                                ))}
                            </div>
                            {(c.contacts?.length ?? 0) > 1 && (
                              <div>
                                <span>Other contacts</span>
                                <p>{c.contacts!.slice(1).join(' · ')}</p>
                              </div>
                            )}
                          </div>
                          <CustomerDetails
                            customer={c}
                            defaultDays={store.settings.reminderDays}
                            onSave={(updated) => {
                              setStore((s) => ({
                                ...s,
                                customers: s.customers.map((x) => (x.id === c.id ? updated : x)),
                                activities: [
                                  {
                                    id: crypto.randomUUID(),
                                    customerId: c.id,
                                    at: new Date().toISOString(),
                                    title: 'Customer details updated',
                                    text: 'Contacts, addresses and reminder preferences saved.',
                                    kind: 'note',
                                    author: cloud?.label ?? 'Demo manager',
                                  },
                                  ...s.activities,
                                ],
                              }))
                              setToast('Customer updated')
                            }}
                          />
                          <NotesEditor
                            notes={c.notes}
                            onSave={(text) => saveNotes('customer', c.id, text)}
                          />
                          <div className="profile-section">
                            <h3>
                              Vehicles{' '}
                              <span className="count-pill">
                                {store.vehicles.filter((v) => v.customerId === c.id).length}
                              </span>
                            </h3>
                            {store.vehicles
                              .filter((v) => v.customerId === c.id)
                              .map((v) => (
                                <button
                                  className="profile-vehicle"
                                  key={v.id}
                                  onClick={() => setDetail({ kind: 'vehicle', id: v.id })}
                                >
                                  <CarFront size={23} />
                                  <div>
                                    <strong>
                                      {v.model}{' '}
                                      <small
                                        className="vehicle-size"
                                        title={
                                          v.notes.startsWith('[Size review]')
                                            ? 'Size needs review'
                                            : 'Vehicle size'
                                        }
                                      >
                                        {sizeLabels[v.size] ?? '—'}
                                        {v.notes.startsWith('[Size review]') ? ' ?' : ''}
                                      </small>
                                    </strong>
                                    <span>
                                      {[v.plate, v.color].filter(Boolean).join(' · ') ||
                                        'Vehicle details needed'}
                                    </span>
                                  </div>
                                  <ChevronRight size={16} />
                                </button>
                              ))}
                          </div>
                        </Profile>
                      )
                    })()
                  : (() => {
                      const v = vehicle(detail.id),
                        c = customer(v.customerId)
                      return (
                        <Profile
                          title={v.model}
                          subtitle={
                            [v.plate, v.color, sizeLabels[v.size] ?? v.size]
                              .filter(Boolean)
                              .join(' · ') || 'Vehicle details needed'
                          }
                          customer={c}
                          notes={v.notes}
                          saveNotes={(text) => saveNotes('vehicle', v.id, text)}
                          activities={store.activities.filter((a) => a.vehicleId === v.id)}
                          addNote={(text) => addNote(c.id, text, v.id)}
                          bookings={store.bookings.filter((b) => b.vehicleId === v.id)}
                          renderBookings={(bs) => bookingRows(bs, true)}
                        >
                          <form
                            className="settings-section"
                            onSubmit={(e) => {
                              e.preventDefault()
                              const d = new FormData(e.currentTarget)
                              setStore((s) => ({
                                ...s,
                                vehicles: s.vehicles.map((x) =>
                                  x.id === v.id
                                    ? {
                                        ...x,
                                        size: String(d.get('size') ?? ''),
                                        plate: String(d.get('plate') ?? ''),
                                        notes: String(d.get('size') ?? '')
                                          ? x.notes.replace(/^\[Size review\][^\n]*(?:\n)?/, '')
                                          : x.notes,
                                      }
                                    : x,
                                ),
                              }))
                              setToast('Vehicle updated')
                            }}
                          >
                            <label className="field">
                              Vehicle size
                              <FormSelect
                                name="size"
                                label="Vehicle size"
                                initial={v.size}
                                options={['', 'Compact', 'Sedan', 'SUV']}
                              />
                            </label>
                            <label className="field">
                              Registration
                              <input name="plate" defaultValue={v.plate} />
                            </label>
                            <button className="btn small-btn">
                              {v.notes.startsWith('[Size review]')
                                ? 'Confirm vehicle size'
                                : 'Save vehicle details'}
                            </button>
                          </form>
                          <button className="owner-card" onClick={() => openCustomer(c.id)}>
                            <Avatar name={c.name} customer={c} />
                            <div>
                              <span>Customer · {customerTypeLabel(c.type)}</span>
                              <strong>{c.name}</strong>
                            </div>
                            <ArrowUpRight size={16} />
                          </button>
                        </Profile>
                      )
                    })()}
            </Dialog>
          )}
        {searchOpen && (
          <Dialog wide title="Search workspace" onClose={() => setSearchOpen(false)}>
            <div className="command-input">
              <Search size={21} />
              <input
                autoFocus
                aria-label="Global search"
                placeholder="Name, car model or license plate..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <kbd>esc</kbd>
            </div>
            <div className="search-results">
              <div className="search-hint">{query ? 'All regions' : 'Customers & vehicles'}</div>
              {store.customers
                .filter((c) => matches(query, c.name, c.contact))
                .map((c) => (
                  <button
                    className="search-result"
                    key={c.id}
                    onClick={() => {
                      openCustomer(c.id)
                      setSearchOpen(false)
                    }}
                  >
                    <Avatar name={c.name} customer={c} />
                    <div>
                      <strong>{c.name}</strong>
                      <span>
                        {customerTypeLabel(c.type)} · {c.region}
                      </span>
                    </div>
                    <ArrowUpRight size={15} />
                  </button>
                ))}
              {store.vehicles
                .filter((v) => matches(query, v.model, v.plate, customer(v.customerId).name))
                .map((v) => (
                  <button
                    className="search-result"
                    key={v.id}
                    onClick={() => {
                      setDetail({ kind: 'vehicle', id: v.id })
                      setSearchOpen(false)
                    }}
                  >
                    <span className="search-car">
                      <CarFront size={20} />
                    </span>
                    <div>
                      <strong>
                        {v.model}{' '}
                        <small
                          className="vehicle-size"
                          title={
                            v.notes.startsWith('[Size review]')
                              ? 'Size needs review'
                              : 'Vehicle size'
                          }
                        >
                          {sizeLabels[v.size] ?? '—'}
                          {v.notes.startsWith('[Size review]') ? ' ?' : ''}
                        </small>
                      </strong>
                      <span>
                        {v.plate} · {customer(v.customerId).name}
                      </span>
                    </div>
                    <ArrowUpRight size={15} />
                  </button>
                ))}
              {!store.customers.some((c) => matches(query, c.name, c.contact)) &&
                !store.vehicles.some((v) =>
                  matches(query, v.model, v.plate, customer(v.customerId).name),
                ) && (
                  <Empty title="No matches" text="Try a name, car model or plate without spaces." />
                )}
            </div>
            <div className="command-footer">
              <Command size={12} /> K to search anytime{' '}
              <span>{cloud ? 'Team workspace' : 'Fictional demo data only'}</span>
            </div>
          </Dialog>
        )}
        {addCustomerOpen && (
          <Dialog wide title="Add customer" onClose={() => setAddCustomerOpen(false)}>
            <CreateCustomer
              onCreate={(c, v) => {
                setStore((s) => ({
                  ...s,
                  customers: [...s.customers, c],
                  vehicles: [...s.vehicles, v],
                  activities: [
                    {
                      id: crypto.randomUUID(),
                      customerId: c.id,
                      vehicleId: v.id,
                      at: new Date().toISOString(),
                      title: 'Customer created',
                      text: 'Customer and vehicle added by the team.',
                      kind: 'note',
                      author: cloud?.label ?? 'Demo manager',
                    },
                    ...s.activities,
                  ],
                }))
                setAddCustomerOpen(false)
              }}
            />
          </Dialog>
        )}
        {newBooking && (
          <Dialog wide title="New booking" onClose={() => setNewBooking(false)}>
            <NewBooking
              store={store}
              initial={bookingStart}
              today={today}
              live={!!cloud}
              onCreate={(b) => {
                setStore((s) => ({
                  ...s,
                  bookings: [...s.bookings, b],
                  activities: [
                    record(b, 'Booking created', `${b.service} · ${dayLabel(b.date)} at ${b.time}`),
                    ...s.activities,
                  ],
                }))
                setNewBooking(false)
                setDate(b.date)
                setStatus('All active')
                setRegion('All regions')
                setStaffFilter('All staff')
                setDetail({ kind: 'booking', id: b.id })
                setToast('Booking created')
              }}
            />
          </Dialog>
        )}
        {resetOpen && (
          <Dialog wide title="Reset demo workspace" onClose={() => setResetOpen(false)}>
            <div className="reset-content">
              <h2>Start fresh?</h2>
              <p>
                This clears your local demo bookings, notes and edits and restores the sample data.
              </p>
              <div className="form-actions">
                <button className="btn" onClick={() => setResetOpen(false)}>
                  Keep my changes
                </button>
                <button
                  className="btn primary"
                  onClick={() => {
                    setStore(createDemoStore())
                    setDetail(null)
                    setResetOpen(false)
                    setToast('Demo restored')
                  }}
                >
                  Reset demo
                </button>
              </div>
            </div>
          </Dialog>
        )}
        {toast && (
          <div
            className="toast"
            role={
              toast.startsWith('Cannot save') || toast.startsWith('Choose') ? 'alert' : 'status'
            }
          >
            <span>
              {toast.startsWith('Cannot save') || toast.startsWith('Choose') ? (
                <X size={14} />
              ) : (
                <Check size={14} />
              )}
            </span>
            {toast}
          </div>
        )}
      </div>
    </>
  )
}
function NotesEditor({ notes, onSave }: { notes: string; onSave: (text: string) => void }) {
  const [draft, setDraft] = useState(notes)
  return (
    <div className="notes-editor">
      <label htmlFor="profile-notes">
        <MessageSquare size={14} />
        Things to remember
      </label>
      <textarea
        id="profile-notes"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Preferences, access details, little things..."
      />
      <div>
        <span>Internal note</span>
        <button className="btn small-btn" disabled={draft === notes} onClick={() => onSave(draft)}>
          Save notes
        </button>
      </div>
    </div>
  )
}
function Profile({
  title,
  subtitle,
  customer,
  notes,
  saveNotes,
  activities,
  addNote,
  bookings,
  renderBookings,
  children,
}: {
  title: string
  subtitle: string
  customer?: Customer
  notes: string
  saveNotes: (s: string) => void
  activities: Activity[]
  addNote: (s: string) => void
  bookings: Booking[]
  renderBookings: (b: Booking[]) => ReactNode
  children: ReactNode
}) {
  const [tab, setTab] = useState('Overview'),
    [draft, setDraft] = useState(''),
    [activityKind, setActivityKind] = useState('All activity')
  return (
    <>
      <div className="profile-heading">
        <Avatar name={title} customer={customer} />
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      <div className="profile-tabs tabs">
        {['Overview', 'History', 'Bookings'].map((t) => (
          <button
            key={t}
            aria-pressed={tab === t}
            className={tab === t ? 'selected' : ''}
            onClick={() => setTab(t)}
          >
            {t}
            {t === 'History' && <span>{activities.length}</span>}
          </button>
        ))}
      </div>
      <div className={`profile-body ${tab === 'Overview' ? 'profile-overview' : ''}`}>
        {tab === 'Overview' ? (
          <>
            {children}
            {!customer || title !== customer.name ? (
              <NotesEditor notes={notes} onSave={saveNotes} />
            ) : null}
            <div className="profile-summary">
              <div>
                <strong>{bookings.length}</strong>
                <span>Total bookings</span>
              </div>
              <div>
                <strong>
                  {money(
                    bookings
                      .filter((b) => b.status === 'Completed')
                      .reduce((n, b) => n + b.price, 0),
                  )}
                </strong>
                <span>Completed services</span>
              </div>
            </div>
          </>
        ) : tab === 'Bookings' ? (
          <div className="profile-bookings">
            {renderBookings(
              [...bookings].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)),
            )}
          </div>
        ) : (
          <>
            <form
              className="add-note"
              onSubmit={(e) => {
                e.preventDefault()
                if (draft.trim()) {
                  addNote(draft.trim())
                  setDraft('')
                }
              }}
            >
              <label htmlFor="activity-note">Add a note</label>
              <textarea
                id="activity-note"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Write a note…"
                required
              />
              <div>
                <span>
                  <MessageSquare size={12} /> Internal note
                </span>
                <button className="btn primary small-btn" disabled={!draft.trim()}>
                  <Plus size={13} />
                  Add note
                </button>
              </div>
            </form>
            <div className="activity-filters" role="group" aria-label="Filter activity">
              {[
                ['All activity', 'All'],
                ['booking', 'Bookings'],
                ['payment', 'Payments'],
                ['note', 'Notes'],
                ['message', 'Messages'],
              ].map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={activityKind === value}
                  onClick={() => setActivityKind(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="timeline">
              {[...activities]
                .filter((a) => activityKind === 'All activity' || a.kind === activityKind)
                .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
                .map((a) => (
                  <div className="timeline-item" key={a.id}>
                    <div className={`timeline-icon ${a.kind === 'note' ? 'note' : ''}`}>
                      {a.kind === 'booking' ? (
                        <CalendarDays size={13} />
                      ) : a.kind === 'payment' ? (
                        <CreditCard size={13} />
                      ) : (
                        <MessageSquare size={13} />
                      )}
                    </div>
                    <div>
                      <h4>{a.title}</h4>
                      <p>{a.text}</p>
                      <span>
                        {a.author} ·{' '}
                        {new Date(a.at).toLocaleString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: 'Europe/Zurich',
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              {!activities.some(
                (a) => activityKind === 'All activity' || a.kind === activityKind,
              ) && <p className="activity-empty">No activity of this type yet.</p>}
            </div>
          </>
        )}
      </div>
    </>
  )
}
function BookingDetail({
  booking: b,
  staff,
  vehicle: v,
  customer: c,
  onUpdate,
  openCustomer,
  openVehicle,
}: {
  booking: Booking
  staff: Store['settings']['staff']
  vehicle: Vehicle
  customer: Customer
  onUpdate: (p: Partial<Booking>) => void
  openCustomer: () => void
  openVehicle: () => void
}) {
  const [notes, setNotes] = useState(b.notes),
    [date, setDate] = useState(b.date),
    [time, setTime] = useState(b.time),
    [arrivalWindow, setArrivalWindow] = useState(b.arrivalWindow ?? 30),
    [assigned, setAssigned] = useState(b.staffIds)
  return (
    <div className="booking-detail">
      <div className="detail-hero">
        <div className="detail-service-icon">
          <Sparkles size={25} />
        </div>
        <Badge status={b.status} />
        <h2>{b.service.replace(' · L+', ' · XL')}</h2>
        <p>
          {v.model} · {b.id}
        </p>
      </div>
      <div className="detail-grid">
        <div>
          <CalendarDays size={16} />
          <span>
            Date & time
            <strong>
              {dayLabel(b.date, {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}{' '}
              · {b.time}
            </strong>
          </span>
        </div>
        <div>
          <Clock3 size={16} />
          <span>
            Duration<strong>{b.duration} minutes</strong>
          </span>
        </div>
        <div>
          <MapPin size={16} />
          <span>
            Service location<strong>{b.address}</strong>
          </span>
        </div>
      </div>
      <details className="detail-section">
        <summary>
          <span>Reschedule</span>
          <span className="summary-caption">
            Arrival {b.time}–
            {String(
              Math.floor(
                (Number(b.time.slice(0, 2)) * 60 +
                  Number(b.time.slice(3)) +
                  (b.arrivalWindow ?? 30)) /
                  60,
              ),
            ).padStart(2, '0')}
            :{String((Number(b.time.slice(3)) + (b.arrivalWindow ?? 30)) % 60).padStart(2, '0')}
          </span>
        </summary>
        <form
          className="settings-section"
          onSubmit={(e) => {
            e.preventDefault()
            onUpdate({ date, time, arrivalWindow, staffIds: assigned })
          }}
        >
          <label className="field">
            Date
            <input
              required
              type="date"
              value={date}
              onInput={(e) => setDate(e.currentTarget.value)}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="field">
            Start time · Zurich
            <input
              required
              type="time"
              min="07:00"
              max="19:00"
              step="900"
              value={time}
              onInput={(e) => setTime(e.currentTarget.value)}
              onChange={(e) => setTime(e.target.value)}
            />
          </label>
          <label className="field">
            Estimated arrival window · minutes
            <input
              required
              type="number"
              min="0"
              max="120"
              step="15"
              value={arrivalWindow}
              onChange={(e) => setArrivalWindow(Number(e.target.value))}
            />
          </label>
          <fieldset className="staff-picker">
            <legend>Assigned team</legend>
            {staff
              .filter((s) => s.region === c.region)
              .map((s) => (
                <label key={s.id}>
                  <input
                    type="checkbox"
                    checked={assigned.includes(s.id)}
                    onChange={(e) =>
                      setAssigned(
                        e.target.checked
                          ? [...assigned, s.id]
                          : assigned.filter((id) => id !== s.id),
                      )
                    }
                  />
                  {s.name}
                </label>
              ))}
          </fieldset>
          <button className="btn primary" disabled={!assigned.length}>
            Save schedule
          </button>
        </form>
      </details>

      <div className="detail-section">
        <h3>Customer & vehicle</h3>
        <button className="owner-card" onClick={openCustomer}>
          <Avatar name={c.name} customer={c} />
          <div>
            <strong>{c.name}</strong>
            <span>
              {customerTypeLabel(c.type)} · {c.region}
            </span>
          </div>
          <ArrowUpRight size={16} />
        </button>
        <button className="profile-vehicle" onClick={openVehicle}>
          <CarFront size={23} />
          <div>
            <strong>
              {v.model}{' '}
              <small
                className="vehicle-size"
                title={v.notes.startsWith('[Size review]') ? 'Size needs review' : 'Vehicle size'}
              >
                {sizeLabels[v.size] ?? '—'}
                {v.notes.startsWith('[Size review]') ? ' ?' : ''}
              </small>
            </strong>
            <span>
              {[v.plate, v.color].filter(Boolean).join(' · ') || 'Vehicle details needed'}
            </span>
          </div>
          <ArrowUpRight size={16} />
        </button>
      </div>
      <div className="detail-section">
        <h3>Team & status</h3>
        <label className="field">
          Booking status
          <Select
            aria-label="Booking status"
            value={b.status}
            onChange={(e) => onUpdate({ status: e.target.value as Status })}
          >
            {statuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </label>
        <div className="assigned-team">
          {b.staffIds.map((id) => (
            <div key={id}>
              <Avatar small name={staff.find((s) => s.id === id)!.name} />
              {staff.find((s) => s.id === id)!.name}
            </div>
          ))}
        </div>
        <p className="muted">Assigned team · {c.region}</p>
      </div>
      <div className="detail-section payment-row">
        <div>
          <h3>Payment</h3>
          <p>{b.paid ? 'Payment received' : 'Awaiting payment'}</p>
        </div>
        <strong>{money(b.price)}</strong>
        <button className="btn small-btn" onClick={() => onUpdate({ paid: !b.paid })}>
          {b.paid ? 'Mark unpaid' : 'Mark paid'}
        </button>
      </div>
      <div className="detail-section">
        <label className="field" htmlFor="booking-notes">
          Booking notes
          <textarea
            id="booking-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Instructions for this visit..."
          />
        </label>
        <button
          className="btn small-btn"
          disabled={notes === b.notes}
          onClick={() => onUpdate({ notes })}
        >
          Save booking notes
        </button>
      </div>
    </div>
  )
}
function NewBooking({
  store,
  initial,
  onCreate,
  today = DEMO_DATE,
  live = false,
}: {
  store: Store
  today?: string
  live?: boolean
  initial?: BookingStart
  onCreate: (b: Booking) => void
}) {
  const { services, staff } = store.settings
  const initialCustomer =
    store.customers.find(
      (c) =>
        store.vehicles.some((v) => v.customerId === c.id) &&
        (!initial?.staffId || staff.find((s) => s.id === initial.staffId)?.region === c.region),
    ) ?? store.customers[0]
  const [customerId, setCustomerId] = useState(initialCustomer.id),
    [vehicleId, setVehicleId] = useState(
      store.vehicles.find((v) => v.customerId === initialCustomer.id)!.id,
    ),
    [service, setService] = useState(
      (initial
        ? services.find(
            (service) =>
              Number(initial.time.slice(0, 2)) * 60 +
                Number(initial.time.slice(3)) +
                service.duration <=
                1200 &&
              (!initial.staffId ||
                !store.bookings.some((b) =>
                  overlaps(
                    {
                      date: initial.date,
                      time: initial.time,
                      duration: service.duration,
                      staffIds: [initial.staffId!],
                    },
                    b,
                  ),
                )),
          )
        : undefined
      )?.name ?? services[0].name,
    ),
    [date, setDate] = useState(initial?.date ?? today),
    [time, setTime] = useState(initial?.time ?? '09:00'),
    [assigned, setAssigned] = useState<string[]>(initial?.staffId ? [initial.staffId] : []),
    [address, setAddress] = useState(initialCustomer.address),
    [notes, setNotes] = useState(''),
    [error, setError] = useState('')
  const c = store.customers.find((c) => c.id === customerId)!,
    size = store.vehicles.find((v) => v.id === vehicleId)?.size ?? '',
    availableServices = services.filter((s) => serviceFits(s, c.region, size)),
    s = availableServices.find((s) => s.name === service) ?? availableServices[0]
  useEffect(() => {
    if (s && service !== s.name) setService(s.name)
  }, [s?.name, service])
  function submit(e: FormEvent) {
    e.preventDefault()
    if (!s) {
      setError('No matching package. Check the vehicle size and service region.')
      return
    }
    if (c.region === 'Unassigned' || !store.settings.regions[c.region].enabled) {
      setError('This region is disabled. Enable it in Settings.')
      return
    }
    if (
      live &&
      (!store.vehicles.find((v) => v.id === vehicleId)?.size ||
        s.tariffs[store.vehicles.find((v) => v.id === vehicleId)!.size] == null)
    ) {
      setError('Set the vehicle size and service tariff before booking.')
      return
    }
    if (live && store.vehicles.find((v) => v.id === vehicleId)?.notes.startsWith('[Size review]')) {
      setError('Confirm the vehicle size in its profile before booking.')
      return
    }
    const mins = Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
    if (!assigned.length) {
      setError('Assign at least one team member.')
      return
    }
    if (mins + s.duration > 20 * 60) {
      setError('Please choose a time that finishes by 20:00.')
      return
    }
    const id = live
      ? crypto.randomUUID()
      : `PNW-${Math.max(...store.bookings.map((b) => Number(b.id.split('-')[1])), 1000) + 1}`
    const b: Booking = {
      id,
      vehicleId,
      date,
      time,
      duration: s.duration,
      service: s.name,
      price: tariff(s, store.vehicles.find((v) => v.id === vehicleId)!.size),
      arrivalWindow: 30,
      staffIds: assigned,
      status: 'Confirmed',
      paid: false,
      address: address.trim(),
      notes,
    }
    if (store.bookings.some((existing) => overlaps(b, existing))) {
      setError('A team member already has a booking at this time. Choose another time or team.')
      return
    }
    onCreate(b)
  }
  return (
    <form className="booking-form" onSubmit={submit}>
      <h2>New booking</h2>

      <div className="form-grid">
        <label className="field">
          Customer
          <Select
            aria-label="Customer"
            value={customerId}
            onChange={(e) => {
              const c = store.customers.find((c) => c.id === e.target.value)!
              setCustomerId(c.id)
              setVehicleId(store.vehicles.find((v) => v.customerId === c.id)!.id)
              setAddress(c.address)
              setAssigned([])
              setError('')
            }}
          >
            {store.customers
              .filter((c) => store.vehicles.some((v) => v.customerId === c.id))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.region}
                </option>
              ))}
          </Select>
        </label>
        <label className="field">
          Vehicle
          <Select
            aria-label="Vehicle"
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
          >
            {store.vehicles
              .filter((v) => v.customerId === customerId)
              .map((v) => (
                <option key={v.id} value={v.id}>
                  {v.model} · {v.plate}
                </option>
              ))}
          </Select>
        </label>
        <label className="field full">
          Service
          <Select aria-label="Service" value={service} onChange={(e) => setService(e.target.value)}>
            {availableServices.map((s) => (
              <option key={s.name} value={s.name}>
                {size ? s.name.split(' · ')[0] : s.name.replace(' · L+', ' · XL')}
              </option>
            ))}
          </Select>
        </label>
        <label className="field">
          Date
          <input
            required
            type="date"
            value={date}
            min="2020-01-01"
            max="2100-12-31"
            onInput={(e) => setDate(e.currentTarget.value)}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label className="field">
          Start time · Zurich
          <input
            required
            type="time"
            min="07:00"
            max="19:00"
            step="900"
            value={time}
            onInput={(e) => setTime(e.currentTarget.value)}
            onChange={(e) => setTime(e.target.value)}
          />
        </label>
        <fieldset className="staff-picker full">
          <legend>Assign team · {c.region}</legend>
          {staff
            .filter((s) => s.region === c.region)
            .map((s) => (
              <label key={s.id}>
                <input
                  type="checkbox"
                  checked={assigned.includes(s.id)}
                  onChange={(e) =>
                    setAssigned(
                      e.target.checked ? [...assigned, s.id] : assigned.filter((id) => id !== s.id),
                    )
                  }
                />
                <Avatar small name={s.name} />
                {s.name}
              </label>
            ))}
        </fieldset>
        <label className="field full">
          Service address
          <input
            list="saved-addresses"
            value={address}
            required
            onChange={(e) => setAddress(e.target.value)}
          />
          <datalist id="saved-addresses">
            {(c.addresses ?? [c.address]).map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </label>
        <label className="field full">
          Booking notes <span className="optional">Optional</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Access instructions, special requests..."
          />
        </label>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="form-actions">
        <span>
          <Clock3 size={14} />
          {s?.duration ?? '—'} min <span>·</span>{' '}
          <strong>
            {!s
              ? 'No matching package'
              : live && !store.vehicles.find((v) => v.id === vehicleId)?.size
                ? 'Set vehicle size first'
                : money(tariff(s, store.vehicles.find((v) => v.id === vehicleId)!.size))}
          </strong>
        </span>
        <button className="btn primary" type="submit" disabled={!s}>
          <Plus size={15} />
          Create booking
        </button>
      </div>
    </form>
  )
}

function CreateCustomer({ onCreate }: { onCreate: (c: Customer, v: Vehicle) => void }) {
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const d = new FormData(e.currentTarget),
      get = (k: string) => String(d.get(k) ?? '').trim(),
      id = crypto.randomUUID()
    const address = get('address'),
      contact = get('contact') || get('name')
    onCreate(
      {
        id,
        name: get('name'),
        type: get('type') as Customer['type'],
        region: get('region') as Region,
        email: get('email'),
        phone: get('phone'),
        contact,
        contacts: [contact],
        address,
        addresses: address ? [address] : [],
        notes: get('notes'),
        whatsappOptIn: false,
      },
      {
        id: crypto.randomUUID(),
        customerId: id,
        model: get('model'),
        plate: get('plate'),
        color: '',
        size: get('size'),
        notes: '',
      },
    )
  }
  return (
    <form className="booking-form" onSubmit={submit}>
      <h2>New customer</h2>
      <div className="form-grid">
        <label className="field">
          Customer name
          <input required name="name" autoComplete="off" />
        </label>
        <label className="field">
          Type
          <FormSelect
            name="type"
            label="Customer type"
            initial="Private"
            options={['Private', 'Business']}
          />
        </label>
        <label className="field">
          Region
          <FormSelect
            name="region"
            label="Customer region"
            initial="Geneva"
            options={['Geneva', 'Ticino']}
          />
        </label>
        <label className="field">
          Contact name
          <input name="contact" />
        </label>
        <label className="field">
          Email
          <input name="email" type="email" />
        </label>
        <label className="field">
          Phone
          <input name="phone" type="tel" placeholder="+41 …" />
        </label>
        <label className="field full">
          Service address
          <input name="address" />
        </label>
        <label className="field">
          Vehicle make and model
          <input required name="model" placeholder="e.g. Porsche Cayenne" />
        </label>
        <label className="field">
          Registration
          <input name="plate" />
        </label>
        <label className="field">
          Vehicle size
          <FormSelect
            name="size"
            label="Vehicle size"
            initial=""
            options={['', 'Compact', 'Sedan', 'SUV']}
          />
        </label>
        <label className="field full">
          Internal notes
          <textarea name="notes" />
        </label>
      </div>
      <div className="form-actions">
        <button className="btn primary">Add customer</button>
      </div>
    </form>
  )
}

function FormSelect({
  name,
  label,
  initial,
  options,
}: {
  name: string
  label: string
  initial: string
  options: string[]
}) {
  const [value, setValue] = useState(
    initial === 'Estate' && options.includes('Sedan') ? 'Sedan' : initial,
  )
  return (
    <Select name={name} aria-label={label} value={value} onChange={(e) => setValue(e.target.value)}>
      {options.map((x) => (
        <option key={x} value={x}>
          {sizeLabels[x] ?? (x || 'Not set')}
        </option>
      ))}
    </Select>
  )
}
