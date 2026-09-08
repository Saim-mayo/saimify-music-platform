import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAdminAuditLog } from '@/features/admin/useAdminData'
import AdminLayout from './components/AdminLayout'

export default function Dashboard() {
  const { items: logs, page, setPage, loading, error, pagination } = useAdminAuditLog()
  const actionSummary = useMemo(() => {
    const summary = new Map()
    logs.forEach((log) => summary.set(log.action, (summary.get(log.action) || 0) + 1))
    return [...summary.entries()].sort(([, firstCount], [, secondCount]) => secondCount - firstCount).slice(0, 3)
  }, [logs])

  const quickActions = [
    { label: 'Review users', detail: 'Manage access and subscriptions', to: '/admin/users', tone: 'mint' },
    { label: 'Artist requests', detail: 'Approve or reject new artists', to: '/admin/artists', tone: 'coral' },
    { label: 'Moderate songs', detail: 'Inspect the latest catalog uploads', to: '/admin/songs', tone: 'gold' },
    { label: 'Manage playlists', detail: 'Keep shared content organized', to: '/admin/playlists', tone: 'blue' },
  ]

  return (
    <AdminLayout>
      <div className="admin-dashboard">
        <header className="admin-dashboard-hero">
          <div>
            <span className="section-kicker">Control room</span>
            <h1>Good evening, admin.</h1>
            <p className="subtitle">Keep the catalog healthy, the community moving, and every decision visible.</p>
          </div>
          <div className="admin-dashboard-pulse" aria-label="Audit status">
            <span className="admin-pulse-dot" aria-hidden="true" />
            <span>Live audit feed</span>
          </div>
        </header>

        <section className="admin-stat-grid" aria-label="Audit summary">
          <article className="admin-stat-card admin-stat-card--accent">
            <span className="admin-stat-label">Total audit records</span>
            <strong>{pagination.totalItems || 0}</strong>
            <span className="admin-stat-note">Across all admin actions</span>
          </article>
          <article className="admin-stat-card">
            <span className="admin-stat-label">Visible this page</span>
            <strong>{logs.length}</strong>
            <span className="admin-stat-note">Latest activity window</span>
          </article>
          <article className="admin-stat-card">
            <span className="admin-stat-label">Top action</span>
            <strong className="admin-stat-value-text">{actionSummary[0]?.[0] || 'Waiting'}</strong>
            <span className="admin-stat-note">{actionSummary[0]?.[1] || 0} recent records</span>
          </article>
        </section>

        <section className="admin-quick-actions">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Shortcuts</span>
              <h2>Jump into a workspace</h2>
            </div>
            <span className="subtitle">Your most common admin actions</span>
          </div>
          <div className="admin-action-grid">
            {quickActions.map((action) => (
              <Link key={action.to} to={action.to} className={`admin-action-card admin-action-card--${action.tone}`}>
                <span className="admin-action-index" aria-hidden="true">+</span>
                <span className="admin-action-copy">
                  <strong>{action.label}</strong>
                  <span>{action.detail}</span>
                </span>
                <span className="admin-action-arrow" aria-hidden="true">-&gt;</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="admin-audit-panel">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Accountability</span>
              <h2>Recent audit</h2>
            </div>
            <span className="subtitle">{pagination.totalItems || 0} records tracked</span>
          </div>
          {loading ? <div className="admin-loading-bar" aria-label="Loading audit activity" /> : null}
        {error ? <p className="error-banner">{error}</p> : null}
          {logs.length === 0 ? (
            <div className="admin-empty-state">
              <strong>No recent audit activity</strong>
              <span>Admin actions will appear here as the team works.</span>
            </div>
          ) : (
            <>
              <ul className="admin-audit-list">
                {logs.map((it) => (
                  <li key={it._id}>
                    <span className="admin-audit-mark" aria-hidden="true" />
                    <span className="admin-audit-copy">
                      <strong>{it.action}</strong>
                      <span>{it.targetUsername || it.targetUserId || 'Unknown target'}</span>
                    </span>
                    <time dateTime={it.createdAt}>{new Date(it.createdAt).toLocaleString()}</time>
                  </li>
                ))}
              </ul>
              <div className="admin-pagination">
                <button
                  type="button"
                  className="btn btn-ghost btn-compact"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >Previous</button>
                <span className="subtitle">Page {pagination.currentPage || page} / {pagination.totalPages || 1}</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-compact"
                  disabled={page >= (pagination.totalPages || 1)}
                  onClick={() => setPage((current) => current + 1)}
                >Next</button>
              </div>
            </>
          )}
        </section>
      </div>
    </AdminLayout>
  )
}
