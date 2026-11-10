import { useState } from 'react'
import type { FormEvent } from 'react'

export function PasswordSetup({
  email,
  onSave,
  onSignOut,
}: {
  email: string
  onSave: (password: string) => Promise<void>
  onSignOut: () => void
}) {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    if (password !== confirmation) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 12) {
      setError('Use at least 12 characters.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await onSave(password)
      setPassword('')
      setConfirmation('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your password. Try again.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand">
          <span>
            <img src={`${import.meta.env.BASE_URL}brand-mark.svg`} alt="" aria-hidden="true" />
          </span>
          park n wash
        </div>
        <div className="auth-heading">
          <p>Team account</p>
          <h1>Set your password</h1>
          <p>{email}</p>
        </div>
        <form onSubmit={submit} aria-busy={busy}>
          <input type="email" autoComplete="username" value={email} readOnly hidden />
          <label className="field">
            New password
            <input
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
              value={password}
              disabled={busy}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label className="field">
            Confirm password
            <input
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
              value={confirmation}
              disabled={busy}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </label>
          <p className="auth-footnote">
            Use at least 12 characters. You’ll use this password to sign in again.
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="btn primary auth-submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save password & continue'}
          </button>
          <button type="button" className="auth-method" disabled={busy} onClick={onSignOut}>
            Sign out
          </button>
        </form>
      </section>
    </main>
  )
}
