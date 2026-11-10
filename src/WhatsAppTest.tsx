import { useEffect, useRef, useState } from 'react'
import { MessageSquare, RefreshCw, Send } from 'lucide-react'
import './WhatsAppTest.css'

export interface WhatsAppTestMessage {
  id: string
  created_at: string
  dispatch_state: 'pending' | 'accepted' | 'failed' | 'unknown'
  delivery_status: 'sent' | 'delivered' | 'read' | 'failed' | null
  error_code: string | null
  meta_message_id: string | null
}
export interface WhatsAppTestState {
  ready: boolean
  missing: string[]
  recipient: string | null
  template: string
  language: string
  messages: WhatsAppTestMessage[]
}
export interface WhatsAppTestApi {
  load: () => Promise<WhatsAppTestState>
  send: (requestId: string) => Promise<void>
}
const labels: Record<string, string> = {
  pending: 'Awaiting result',
  accepted: 'Accepted by Meta',
  failed: 'Failed',
  unknown: 'Delivery unknown',
  sent: 'Sent',
  delivered: 'Delivered',
  read: 'Read',
}
export function WhatsAppTest({ api }: { api?: WhatsAppTestApi }) {
  const [state, setState] = useState<WhatsAppTestState | null>(null)
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true)
  const [error, setError] = useState(''),
    [notice, setNotice] = useState('')
  const sending = useRef(false),
    mounted = useRef(true)
  async function reload() {
    if (!api) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const next = await api.load()
      if (mounted.current) setState(next)
    } catch (e) {
      if (mounted.current)
        setError(e instanceof Error ? e.message : 'Could not load test settings.')
    } finally {
      if (mounted.current) setLoading(false)
    }
  }
  useEffect(() => {
    mounted.current = true
    void reload()
    return () => {
      mounted.current = false
    }
  }, [api])
  async function send() {
    if (!api || !state?.ready || sending.current) return
    sending.current = true
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await api.send(crypto.randomUUID())
      if (mounted.current) setNotice('Request recorded. Refresh the log for delivery updates.')
    } catch (e) {
      if (mounted.current)
        setError(
          e instanceof Error
            ? e.message
            : 'Request interrupted. Check the log before sending again.',
        )
    } finally {
      sending.current = false
      if (mounted.current) {
        setBusy(false)
        await reload()
      }
    }
  }
  return (
    <section className="operations settings-content whatsapp-test" aria-label="WhatsApp test">
      <div className="settings-pane">
        <header className="settings-pane-header">
          <h2>
            WhatsApp <span className="wa-test-badge">Test mode</span>
          </h2>
          <p>One verified test recipient. No customer messages.</p>
        </header>
        {!api ? (
          <p className="wa-muted">
            Open your live administrator account to configure and send a test.
          </p>
        ) : (
          <>
            <div className="wa-test-summary">
              <span className="wa-test-icon">
                <MessageSquare size={22} />
              </span>
              <div>
                <strong>{state?.recipient ?? 'Test recipient not configured'}</strong>
                <p>
                  {state?.template ?? 'hello_world'} · {state?.language ?? 'en_US'}
                </p>
              </div>
              <button
                type="button"
                className="btn primary"
                disabled={busy || loading || !state?.ready}
                onClick={() => void send()}
              >
                <Send size={15} />
                {busy ? 'Sending…' : 'Send test'}
              </button>
            </div>
            {state && !state.ready && (
              <div className="wa-setup">
                <strong>Finish server setup</strong>
                <p>Add these values in Supabase → Edge Functions → Secrets.</p>
                <ul>
                  {state.missing.map((name) => (
                    <li key={name}>
                      <code>{name}</code>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            {notice && (
              <p role="status" className="wa-notice">
                {notice}
              </p>
            )}
            <div className="wa-log-heading">
              <h3>Test deliveries</h3>
              <button
                type="button"
                className="btn"
                disabled={loading || busy}
                onClick={() => {
                  setError('')
                  void reload()
                }}
              >
                <RefreshCw size={14} />
                {loading ? 'Loading…' : 'Refresh'}
              </button>
            </div>
            <p className="wa-muted">
              Accepted by Meta is not delivered. Delivery and read statuses come from the webhook.
            </p>
            {state?.messages.length ? (
              <div className="wa-log">
                {state.messages.map((m) => {
                  const status = m.delivery_status ?? m.dispatch_state
                  return (
                    <article key={m.id}>
                      <div>
                        <strong>hello_world</strong>
                        <time>
                          {new Date(m.created_at).toLocaleString(undefined, {
                            timeZone: 'Europe/Zurich',
                          })}
                        </time>
                      </div>
                      <span className={`wa-status wa-${status}`}>{labels[status]}</span>
                      {m.error_code && <small>Code: {m.error_code}</small>}
                    </article>
                  )
                })}
              </div>
            ) : (
              !loading && <p className="wa-empty">No test messages yet.</p>
            )}
            <p className="wa-muted">
              Maximum 1 test per minute and 10 per 24 hours. Geneva and Ticino numbers are
              unchanged.
            </p>
          </>
        )}
      </div>
    </section>
  )
}
