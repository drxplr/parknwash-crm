import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
const CloudApp = lazy(() => import('./CloudApp'))
import './styles.css'
import './refinements.css'
const cloudMode =
  (import.meta.env.VITE_CRM_MODE ?? (import.meta.env.PROD ? 'cloud' : 'demo')) === 'cloud'
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
        {cloudMode ? <CloudApp /> : <App />}
      </Suspense>
    )}
  </React.StrictMode>,
)
