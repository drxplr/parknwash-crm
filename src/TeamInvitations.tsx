import { useEffect, useState } from 'react'

type InvitationState = {
  ready: boolean
  missing: string[]
  accounts: { user_id: string; email: string; role: string; pending: boolean }[]
}
export type TeamInvitationsApi = {
  load: () => Promise<InvitationState>
  resend: (userId: string, requestId: string) => Promise<{ status: string }>
}

export function TeamInvitations({ api }: { api: TeamInvitationsApi }) {
  const [state, setState] = useState<InvitationState | null>(null)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  // Reuse a request ID after an ambiguous response; a second click must not send twice.
  const [requests] = useState(() => new Map<string, string>())
  const [attempted, setAttempted] = useState<string[]>([])
  useEffect(() => {
    let active = true
    void api
      .load()
      .then((next) => {
        if (active) setState(next)
      })
      .catch(() => {
        if (active) setError('Could not load invitations. Reload this page to try again.')
      })
    return () => {
      active = false
    }
  }, [api])
  async function resend(userId: string) {
    if (busy) return
    setBusy(userId)
    setMessage('')
    setError('')
    const requestId = requests.get(userId) ?? crypto.randomUUID()
    requests.set(userId, requestId)
    try {
      const result = await api.resend(userId, requestId)
      setAttempted((ids) => [...ids, userId])
      if (result.status === 'accepted')
        setMessage(
          'Invitation accepted for email delivery. Ask your teammate to open the newest email and set a password. Inbox delivery and sign-in are not yet confirmed.',
        )
      else
        setError(
          'Delivery was not confirmed. Ask an administrator to check Auth email delivery before trying again.',
        )
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Invitation request interrupted. Check delivery before retrying.',
      )
    } finally {
      setBusy('')
    }
  }
  return (
    <section className="operations settings-content" aria-busy={!!busy || !state}>
      <h2>Team invitations</h2>
      <p>Resend an invitation to an existing team account that has not confirmed its email.</p>
      {state && !state.ready && (
        <p className="form-error" role="status">
          Invitation delivery needs administrator setup. Check the private invitation setup guide.
        </p>
      )}
      {!state && !error && <p role="status">Loading team accounts…</p>}
      {state?.accounts.map((account) => (
        <div key={account.user_id} className="settings-row">
          <p>
            <strong>{account.email}</strong> · {account.role} ·{' '}
            {account.pending ? 'Pending activation' : 'Email confirmed'}
          </p>
          {account.pending && (
            <button
              type="button"
              className="btn"
              disabled={!state.ready || !!busy || attempted.includes(account.user_id)}
              onClick={() => void resend(account.user_id)}
            >
              {busy === account.user_id
                ? 'Sending…'
                : attempted.includes(account.user_id)
                  ? 'Request recorded'
                  : 'Resend invitation'}
            </button>
          )}
        </div>
      ))}
      {message && <p role="status">{message}</p>}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
