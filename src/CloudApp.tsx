import { WasherWorkspace } from './WasherWorkspace'
import { authErrorMessage, retryConnectionOnce, retryPasswordSignIn } from './connectionRecovery'
import { PasswordSetup } from './PasswordSetup'
import { createClient } from '@supabase/supabase-js'
import type { Session } from '@supabase/supabase-js'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, LogOut, RefreshCw } from 'lucide-react'
import App from './App'
import { loadSnapshot, snapshotToStore, storeChanges } from './cloudRepository'
import type { Snapshot } from './cloudRepository'
import type { Store } from './model'
import { createTabAuthStorage } from './authStorage'

// Read only the flow label before the SDK consumes the URL fragment. Never log tokens.
const entryFlow = new URLSearchParams(window.location.hash.slice(1)).get('type')
// getSession() does not return URL-initialization errors. Capture only a safe
// error classification before the SDK processes the callback, never its tokens.
const callbackParams = new URLSearchParams(window.location.hash.slice(1))
const callbackFailed = ['error', 'error_code', 'error_description'].some((key) =>
  callbackParams.has(key),
)
const callbackError = callbackFailed
  ? callbackParams.get('error_code') === 'otp_expired'
    ? 'This sign-in link has expired or has already been used. Ask your administrator for a new invitation, then open the newest email to set your password.'
    : 'This sign-in link could not be verified. Ask your administrator for a new invitation and open the newest email.'
  : ''
const config = import.meta.env
const emailAuthEnabled = config.VITE_EMAIL_AUTH_ENABLED === 'true'
// Only the public API key is allowed here. No customer records are persisted
// in browser storage; session tokens live only in this tab's sessionStorage.
const client =
  config.VITE_SUPABASE_URL && config.VITE_SUPABASE_PUBLISHABLE_KEY
    ? createClient(config.VITE_SUPABASE_URL, config.VITE_SUPABASE_PUBLISHABLE_KEY, {
        auth: {
          ...createTabAuthStorage(),
          persistSession: true,
          flowType: 'implicit',
        },
      })
    : null
export default function CloudApp() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false),
    [workspaceLoading, setWorkspaceLoading] = useState(false)
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    [version, setVersion] = useState(0)
  const [error, setError] = useState(''),
    [email, setEmail] = useState(''),
    [sent, setSent] = useState(false)
  const [signingIn, setSigningIn] = useState(false)
  const authAttempt = useRef(0),
    loginPending = useRef(false)
  const [password, setPassword] = useState('')
  const [linkError, setLinkError] = useState(callbackError)
  const [passwordFlow, setPasswordFlow] = useState(
    entryFlow === 'invite' || entryFlow === 'recovery',
  )
  const [method, setMethod] = useState<'password' | 'link'>('password')
  const [updatesAvailable, setUpdatesAvailable] = useState(false)
  const sequence = useRef(0),
    snapshotRef = useRef<Snapshot | null>(null)
  const activeUser = useRef<string | null>(null),
    signedOut = useRef(false)
  snapshotRef.current = snapshot
  useEffect(() => {
    if (!client) {
      setReady(true)
      return
    }
    let active = true
    const acceptSession = (next: Session | null) => {
      if (!active || (signedOut.current && next)) return
      const id = next?.user.id ?? null
      if (!next || activeUser.current !== id) {
        sequence.current++
        snapshotRef.current = null
        setSnapshot(null)
        setWorkspaceLoading(false)
        setUpdatesAvailable(false)
        setError('')
      }
      // This user-editable marker only controls onboarding UI, never authorization.
      if (next?.user.invited_at && next.user.user_metadata?.crm_password_set !== true)
        setPasswordFlow(true)
      activeUser.current = id
      setSession(next)
      setReady(true)
    }
    const initialSequence = sequence.current
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, next) => {
      if (event === 'PASSWORD_RECOVERY') setPasswordFlow(true)
      acceptSession(next)
    })
    void client.auth
      .getSession()
      .then(({ data, error }) => {
        if (active && initialSequence === sequence.current) {
          acceptSession(data.session)
          setError(error ? authErrorMessage(error, 'sign-in') : '')
        }
      })
      .catch((error: unknown) => {
        if (active && initialSequence === sequence.current) {
          setReady(true)
          setError(authErrorMessage(error, 'sign-in'))
        }
      })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])
  async function load() {
    if (!client || !session || activeUser.current !== session.user.id) return
    const seq = ++sequence.current
    setWorkspaceLoading(true)
    setError('')
    try {
      const userId = session.user.id
      const next = await retryConnectionOnce(
        async () => {
          const accepted = await client.rpc('crm_accept_access')
          if (accepted.error) throw accepted.error
          const { data, error } = await client
            .from('crm_members')
            .select('workspace_id')
            .eq('user_id', userId)
          if (error) throw error
          if (data?.length !== 1)
            throw new Error(
              'Your account has no active workspace access. Ask an administrator to check your access.',
            )
          return loadSnapshot(client, data[0].workspace_id)
        },
        () => seq === sequence.current && activeUser.current === userId,
      )
      if (seq === sequence.current) {
        setSnapshot(next)
        setVersion((v) => v + 1)
      }
    } catch (e) {
      if (seq === sequence.current) {
        setSnapshot(null)
        setError(authErrorMessage(e, 'workspace'))
      }
    } finally {
      if (seq === sequence.current) setWorkspaceLoading(false)
    }
  }
  useEffect(() => {
    void load()
  }, [session?.user.id])
  useEffect(() => {
    if (!client || !session || !snapshot) return
    const ws = snapshot.workspace.id
    const user = session.user.id
    let active = true
    const timer = setInterval(() => {
      void client
        .from('crm_workspaces')
        .select('revision')
        .eq('id', ws)
        .maybeSingle()
        .then(({ data, error, status }) => {
          if (!active || activeUser.current !== user || snapshotRef.current?.workspace.id !== ws)
            return
          if (error) {
            if (status === 401 || status === 403) {
              sequence.current++
              snapshotRef.current = null
              setSnapshot(null)
              setError('Your session is no longer authorized. Sign in again.')
            }
            return
          }
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
    if (!client || loginPending.current) return
    loginPending.current = true
    const attempt = ++authAttempt.current
    signedOut.current = false
    setSigningIn(true)
    setLinkError('')
    setError('')
    setSent(false)
    try {
      const result =
        method === 'password'
          ? await retryPasswordSignIn(
              () => client.auth.signInWithPassword({ email: email.trim(), password }),
              () => attempt === authAttempt.current,
            )
          : await client.auth.signInWithOtp({
              email: email.trim(),
              options: {
                shouldCreateUser: false,
                emailRedirectTo: location.origin + location.pathname,
              },
            })
      if (attempt !== authAttempt.current) return
      if (result.error) throw result.error
      setPassword('')
      if (method !== 'password') setSent(true)
    } catch (e) {
      if (attempt === authAttempt.current) setError(authErrorMessage(e, 'sign-in'))
    } finally {
      if (attempt === authAttempt.current) {
        loginPending.current = false
        setSigningIn(false)
      }
    }
  }
  async function signOut() {
    authAttempt.current++
    loginPending.current = false
    setSigningIn(false)
    signedOut.current = true
    activeUser.current = null
    // Clear customer state before awaiting the network, including offline logout.
    sequence.current++
    setSnapshot(null)
    snapshotRef.current = null
    setSession(null)
    setWorkspaceLoading(false)
    setUpdatesAvailable(false)
    setPassword('')
    setPasswordFlow(false)
    setError('')
    try {
      const result = await client?.auth.signOut({ scope: 'local' })
      if (result?.error) setError('Signed out of this tab. Server sign-out could not be confirmed.')
    } catch {
      setError('Could not finish sign-out. Close this tab to clear its session.')
    }
  }
  async function commit(before: Store, after: Store): Promise<Store> {
    const base = snapshotRef.current
    if (!client || !base) throw new Error('Sign in again before saving.')
    const seq = sequence.current
    const user = activeUser.current
    if (!user || user !== session?.user.id) throw new Error('Sign in again before saving.')
    const changes = storeChanges(base, before, after)
    if (!changes.length) return before
    const { error } = await client.rpc('crm_commit', {
      ws: base.workspace.id,
      expected_revision: base.workspace.revision,
      changes,
    })
    if (seq !== sequence.current || activeUser.current !== user)
      throw new Error('Session changed. Sign in again.')
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
  async function washStatus(id: string, status: 'In progress' | 'Completed'): Promise<Store> {
    const base = snapshotRef.current
    if (!client || !session || !base || activeUser.current !== session.user.id)
      throw new Error('Sign in again.')
    const seq = sequence.current
    const { error } = await client.rpc('crm_wash_status', {
      ws: base.workspace.id,
      job: id,
      next_status: status,
      expected_revision: base.workspace.revision,
    })
    if (error) throw error
    const next = await loadSnapshot(client, base.workspace.id)
    if (seq !== sequence.current) throw new Error('Session changed. Sign in again.')
    snapshotRef.current = next
    setSnapshot(next)
    return snapshotToStore(next)
  }
  if (session && client && passwordFlow)
    return (
      <PasswordSetup
        email={session.user.email ?? ''}
        onSave={async (newPassword) => {
          const result = await client.auth.updateUser({
            password: newPassword,
            data: { crm_password_set: true },
          })
          if (result.error) throw result.error
          setPasswordFlow(false)
        }}
        onSignOut={() => void signOut()}
      />
    )
  if (
    snapshot &&
    session &&
    !workspaceLoading &&
    snapshot.can_manage === false &&
    snapshot.is_washer &&
    snapshot.staff_id
  )
    return (
      <WasherWorkspace
        store={snapshotToStore(snapshot)}
        staffId={snapshot.staff_id}
        onStatus={async (id, status) => {
          await washStatus(id, status)
        }}
        onReload={load}
        onSignOut={() => void signOut()}
      />
    )
  if (
    snapshot &&
    session &&
    !workspaceLoading &&
    snapshot.can_manage === false &&
    !snapshot.is_washer &&
    !snapshot.staff.some(
      (s) =>
        s.id === snapshot.staff_id &&
        s.active === true &&
        Array.isArray(s.roles) &&
        s.roles.includes('manager'),
    )
  )
    return (
      <main className="auth-page">
        <section className="auth-card">
          <h1>Team roles need setup</h1>
          <p>Ask an administrator to link your account and confirm your active team roles.</p>
          <div className="auth-actions">
            <button className="btn" onClick={() => void load()}>
              Reload access
            </button>
            <button className="btn" onClick={() => void signOut()}>
              Sign out
            </button>
          </div>
        </section>
      </main>
    )
  if (snapshot && session && !workspaceLoading)
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
            role: snapshot.can_manage === false ? 'viewer' : snapshot.role,
            washerStaffId: snapshot.is_washer ? (snapshot.staff_id ?? undefined) : undefined,
            washStatus,
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
        ) : !ready || signingIn || workspaceLoading || (session && !snapshot && !error) ? (
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
          <form onSubmit={login} aria-busy={signingIn}>
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
            <button className="btn primary auth-submit" disabled={signingIn || !ready}>
              {signingIn
                ? 'Signing in…'
                : method === 'password'
                  ? 'Sign in'
                  : 'Email me a sign-in link'}
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
        {!session && linkError && (
          <p role="alert" className="form-error">
            {linkError}
          </p>
        )}
        <p className="auth-footnote">Access is limited to authorized team members.</p>
        <a className="demo-switch" href="?demo=1">
          Explore with fictional demo data <ArrowRight size={14} />
        </a>
      </section>
    </main>
  )
}
