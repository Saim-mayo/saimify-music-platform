import { useAdminArtists } from '@/features/admin/useAdminData'
import AdminLayout from './components/AdminLayout'
import AdminPageHeader from './components/AdminPageHeader'

export default function Artists() {
  const { items: pending, page, setPage, loading, error, pagination, decideArtist } = useAdminArtists()

  return (
    <AdminLayout>
      <div className="admin-artists">
        <AdminPageHeader
          eyebrow="People & access"
          title="Artist approvals"
          description="Give new artists a thoughtful review before they enter the catalog."
          meta={`${pagination.totalItems || 0} requests`}
        />
        {loading ? <p>Loading…</p> : null}
        {error ? <p className="error-banner">{error}</p> : null}
        <ul className="admin-approval-list">
          {pending.map((u) => (
            <li key={u._id}>
              <div>{u.username || 'Unknown'} — {u.email || 'No email'}</div>
              <div className="subtitle">Status: {u.artistVerification?.status || 'none'}</div>
              <div>
                <button type="button" onClick={() => decideArtist(u._id, true)}>Approve</button>
                <button type="button" onClick={() => decideArtist(u._id, false)}>Reject</button>
              </div>
            </li>
          ))}
          {!loading && pending.length === 0 ? <li>No pending artist requests.</li> : null}
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
      </div>
    </AdminLayout>
  )
}
