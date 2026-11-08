import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
const CloudApp = lazy(() => import('./CloudApp'))
import './styles.css'
import './refinements.css'
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Suspense
      fallback={
        <main className="auth-page">
          <p role="status">Opening workspace…</p>
        </main>
      }
    >
      {(import.meta.env.VITE_CRM_MODE ?? (import.meta.env.PROD ? 'cloud' : 'demo')) === 'cloud' ? <CloudApp /> : <App />}
    </Suspense>
  </React.StrictMode>,
)
