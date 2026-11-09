import { useState } from 'react'
import { CalendarDays, CreditCard, MessageSquare, Plus } from 'lucide-react'
import type { Activity } from './model'

export function ActivityHistory({
  activities,
  addNote,
  readOnly = false,
}: {
  activities: Activity[]
  addNote: (text: string) => void
  readOnly?: boolean
}) {
  const [draft, setDraft] = useState(''),
    [activityKind, setActivityKind] = useState('All activity'),
    [composing, setComposing] = useState(false)
  return (
    <>
      {!readOnly &&
        (composing ? (
          <form
            className="add-note"
            onSubmit={(e) => {
              e.preventDefault()
              if (draft.trim()) {
                addNote(draft.trim())
                setDraft('')
                setComposing(false)
              }
            }}
          >
            <label htmlFor="activity-note">Add a note</label>
            <textarea
              autoFocus
              rows={2}
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
              <button type="button" className="btn small-btn" onClick={() => setComposing(false)}>
                Cancel
              </button>
              <button className="btn primary small-btn" disabled={!draft.trim()}>
                <Plus size={13} />
                Add note
              </button>
            </div>
          </form>
        ) : (
          <button className="btn small-btn activity-compose" onClick={() => setComposing(true)}>
            <Plus size={14} />
            Add note
          </button>
        ))}
      <div className="activity-filters selection-tabs" role="group" aria-label="Filter activity">
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
        {!activities.some((a) => activityKind === 'All activity' || a.kind === activityKind) && (
          <p className="activity-empty">No activity of this type yet.</p>
        )}
      </div>
    </>
  )
}
