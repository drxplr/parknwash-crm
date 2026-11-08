import { createClient } from '@supabase/supabase-js'
import type { Session } from '@supabase/supabase-js'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, LogOut, RefreshCw } from 'lucide-react'
import App from './App'
import { loadSnapshot, snapshotToStore, storeChanges } from './cloudRepository'
import type { Snapshot } from './cloudRepository'
import type { Store } from './model'

const config = import.meta.env
const emailAuthEnabled = config.VITE_EMAIL_AUTH_ENABLED === 'true'
// Only the public API key is allowed here. No customer records are persisted
// in browser storage; session tokens live only in this tab's sessionStorage.
const client =
  config.VITE_SUPABASE_URL && config.VITE_SUPABASE_PUBLISHABLE_KEY
    ? createClient(config.VITE_SUPABASE_URL, config.VITE_SUPABASE_PUBLISHABLE_KEY, {
        auth: {
          storage: sessionStorage,
          storageKey: 'pnw-pilot-auth',
          persistSession: true,
          flowType: 'implicit',
        },
      })
    : null
export default function CloudApp() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false),
    [loading, setLoading] = useState(false)
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    [version, setVersion] = useState(0)
  const [error, setError] = useState(''),
    [email, setEmail] = useState(''),
    [sent, setSent] = useState(false)
  const [password, setPassword] = useState('')
  const [method, setMethod] = useState<'password' | 'link'>('password')
  const [updatesAvailable, setUpdatesAvailable] = useState(false)
  const sequence = useRef(0),
    snapshotRef = useRef<Snapshot | null>(null)
  snapshotRef.current = snapshot
  useEffect(() => {
    if (!client) {
      setReady(true)
      return
    }
    let active = true
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, next) => {
      if (!active) return
      setSession(next)
      setReady(true)
      if (!next) {
        sequence.current++
        setSnapshot(null)
        snapshotRef.current = null
      }
    })
    void client.auth.getSession().then(({ data, error }) => {
      if (active) {
        setSession(data.session)
        setError(error?.message ?? '')
        setReady(true)
      }
    })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])
  async function load() {
    if (!client || !session) return
    const seq = ++sequence.current
    setLoading(true)
    setError('')
    try {
      const accepted = await client.rpc('crm_accept_access')
      if (accepted.error) throw accepted.error
      const { data, error } = await client
        .from('crm_members')
        .select('workspace_id')
        .eq('user_id', session.user.id)
      if (error) throw error
      if (data?.length !== 1)
        throw new Error(
          'Your account has no active workspace access. Ask an administrator to check your access.',
        )
      const next = await loadSnapshot(client, data[0].workspace_id)
      if (seq === sequence.current) {
        setSnapshot(next)
        setVersion((v) => v + 1)
      }
    } catch (e) {
      if (seq === sequence.current) {
        setSnapshot(null)
        setError(message(e))
      }
    } finally {
      if (seq === sequence.current) setLoading(false)
    }
  }
  useEffect(() => {
    void load()
  }, [session?.user.id])
  useEffect(() => {
    if (!client || !session || !snapshot) return
    const ws = snapshot.workspace.id
    let active = true
    const timer = setInterval(() => {
      void client
        .from('crm_workspaces')
        .select('revision')
        .eq('id', ws)
        .maybeSingle()
        .then(({ data, error }) => {
          if (!active || error) return
          if (!data) {
            sequence.current++
            setSnapshot(null)
            snapshotRef.current = null
            setError('Your workspace access has been removed.')
          } else
            setUpdatesAvailable(Number(data.revision) !== snapshotRef.current?.workspace.revision)
        })
    }, 20000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [session?.user.id, snapshot?.workspace.id])
  async function login(event: FormEvent) {
    event.preventDefault()
    if (!client) return
    setLoading(true)
    setError('')
    setSent(false)
    try {
      const result =
        method === 'password'
          ? await client.auth.signInWithPassword({ email: email.trim(), password })
          : await client.auth.signInWithOtp({
              email: email.trim(),
              options: {
                shouldCreateUser: false,
                emailRedirectTo: location.origin + location.pathname,
              },
            })
      if (result.error) throw result.error
      setPassword('')
      if (method !== 'password') setSent(true)
    } catch (e) {
      setError(message(e))
    } finally {
      setLoading(false)
    }
  }
  async function signOut() {
    // Clear customer state before awaiting the network, including offline logout.
    sequence.current++
    setSnapshot(null)
    snapshotRef.current = null
    setSession(null)
    setError('')
    await client?.auth.signOut({ scope: 'local' })
  }
  async function commit(before: Store, after: Store): Promise<Store> {
    const base = snapshotRef.current
    if (!client || !base) throw new Error('Sign in again before saving.')
    const seq = sequence.current
    const changes = storeChanges(base, before, after)
    if (!changes.length) return before
    const { error } = await client.rpc('crm_commit', {
      ws: base.workspace.id,
      expected_revision: base.workspace.revision,
      changes,
    })
    if (error) {
      if (error.code === '42501') {
        setSnapshot(null)
        throw new Error('Workspace access has changed. Sign in again.')
      }
      if (error.code === '40001')
        throw new Error(
          'Someone else changed this workspace. Reload the latest data, then apply your edit again.',
        )
      if (error.code === '23P01')
        throw new Error('A team member is already booked in this time slot.')
      throw new Error(error.message)
    }
    let next: Snapshot
    try {
      next = await loadSnapshot(client, base.workspace.id)
    } catch {
      throw new Error(
        'The save was accepted, but the refreshed data could not be loaded. Reload before making another change.',
      )
    }
    if (seq !== sequence.current) throw new Error('Session changed. Sign in again.')
    snapshotRef.current = next
    setSnapshot(next)
    return snapshotToStore(next)
  }
  if (snapshot && session && !loading)
    return (
      <>
        {updatesAvailable && (
          <div className="cloud-update" role="status">
            Team updates are available.
            <button
              className="btn small-btn"
              onClick={() => {
                setUpdatesAvailable(false)
                void load()
              }}
            >
              Reload latest data
            </button>
          </div>
        )}
        <App
          key={`${session.user.id}-${version}`}
          cloud={{
            initial: snapshotToStore(snapshot),
            role: snapshot.role,
            label: session.user.email?.split('@')[0] ?? 'Team',
            commit,
            reload: load,
            signOut: () => void signOut(),
          }}
        />
      </>
    )
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
          <p>Team workspace</p>
          <h1>{session ? 'Your workspace' : 'Welcome back'}</h1>
          <p>{session ? 'Loading your team’s workspace.' : 'Sign in with your team account.'}</p>
        </div>
        {!client ? (
          <p role="alert" className="form-error">
            Connection is not configured. Contact the administrator.
          </p>
        ) : !ready || loading ? (
          <p role="status" className="auth-status">
            Connecting securely…
          </p>
        ) : session ? (
          <div className="auth-actions">
            <button className="btn primary" onClick={() => void load()}>
              <RefreshCw size={15} />
              Try again
            </button>
            <button className="btn" onClick={() => void signOut()}>
              <LogOut size={15} />
              Sign out
            </button>
          </div>
        ) : (
          <form onSubmit={login}>
            <label className="field">
              Email
              <input
                autoComplete="username"
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setSent(false)
                }}
                placeholder="you@example.com"
              />
            </label>
            {method !== 'link' && (
              <label className="field">
                Password
                <input
                  autoComplete="current-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
            )}
            <button className="btn primary auth-submit">
              {method === 'password' ? 'Sign in' : 'Email me a sign-in link'}
              <ArrowRight size={16} />
            </button>
            {emailAuthEnabled && (
              <button
                type="button"
                className="auth-method"
                onClick={() => {
                  setMethod(method === 'password' ? 'link' : 'password')
                  setError('')
                  setSent(false)
                }}
              >
                {method === 'password' ? 'Use an email sign-in link' : 'Use a password'}
              </button>
            )}
            {sent && (
              <p role="status">
                If your team account exists, a sign-in link is on its way. Check your inbox.
              </p>
            )}
          </form>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <p className="auth-footnote">Access is limited to authorized team members.</p>
      </section>
    </main>
  )
}
function message(error: unknown) {
  return error && typeof error === 'object' && 'message' in error
    ? String(error.message)
    : 'Unable to connect. Please try again.'
}
