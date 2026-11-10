import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
const CloudApp = lazy(() => import('./CloudApp'))
import './styles.css'
import './refinements.css'
import './ux.css'
import './PageHeader.css'
import './CustomerProfile.css'
const cloudMode = import.meta.env.PROD || (import.meta.env.VITE_CRM_MODE ?? 'demo') === 'cloud'
const demo = import.meta.env.DEV && new URLSearchParams(location.search).get('demo') === '1'
if (import.meta.env.PROD) {
  // The owner's demo cleanup never touches Auth sessions or live customer data.
  try {
    for (const key of Object.keys(localStorage))
      if (key.startsWith('parknwash-crm-demo-')) localStorage.removeItem(key)
  } catch {
    /* Storage may be disabled. */
  }
  const url = new URL(location.href)
  if (url.searchParams.has('demo')) {
    url.searchParams.delete('demo')
    history.replaceState(null, '', url.pathname + url.search + url.hash)
  }
}
const embedded = import.meta.env.PROD && cloudMode && window.top !== window.self
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {embedded ? (
      <main className="auth-page">
        <section className="auth-card">
          <h1>Open Park n Wash</h1>
          <p>Open your workspace in its own browser tab.</p>
          <a className="btn primary" href={location.href} target="_blank" rel="noreferrer">
            Open workspace
          </a>
        </section>
      </main>
    ) : (
      <Suspense
        fallback={
          <main className="auth-page">
            <p role="status">Opening workspace…</p>
          </main>
        }
      >
        {cloudMode && !demo ? <CloudApp /> : <App />}
      </Suspense>
    )}
  </React.StrictMode>,
)

import './Settings.css'
import './OperationalPolish.css'

import './SelectionTabs.css'
