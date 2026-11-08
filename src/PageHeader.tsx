import type { ReactNode } from 'react'

// Shared page-level layout. Page-specific controls belong in the slots, not in
// CSS rules that rearrange the parent <main> for individual sections.
export function PageHeader({
  title,
  meta,
  badge,
  filters,
  actions,
}: {
  title: string
  meta?: string
  badge?: string
  filters?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="page-header" aria-label={`${title} section`}>
      <div className="page-header-heading">
        <div className="page-header-title">
          <h1>{title}</h1>
          {badge && <span className="demo-label">{badge}</span>}
        </div>
        {meta && <p className="page-header-meta">{meta}</p>}
      </div>
      <div className="page-header-controls">
        {filters && <div className="page-header-filters">{filters}</div>}
        {actions && <div className="page-header-actions">{actions}</div>}
      </div>
    </header>
  )
}
