import { useState } from 'react'
import AdminLayout from './components/AdminLayout'
import AdminPageHeader from './components/AdminPageHeader'
import { useAdminUsers } from '@/features/admin/useAdminData'

export default function Users() {
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')
  const { items: users, page, setPage, loading, error, pagination, reload, toggleBan, cancelSubscription } = useAdminUsers({ search, role, status })

  return (
    <AdminLayout>
      <div className="admin-users">
        <AdminPageHeader
          eyebrow="People & access"
          title="Users"
          description="Review account access, roles, and subscription status from one place."
          meta={`${pagination.totalItems || 0} accounts`}
        />
        <div className="admin-filters">
          <input className="input" placeholder="Search by email or username" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">All roles</option>
            <option value="user">User</option>
            <option value="artist">Artist</option>
            <option value="admin">Admin</option>
          </select>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Any status</option>
            <option value="false">Active</option>
            <option value="true">Banned</option>
          </select>
          <button type="button" className="btn btn-ghost" onClick={() => { setPage(1); void reload() }}>Search</button>
        </div>
        {loading ? <p>Loading…</p> : null}
        {error ? <p className="error-banner">{error}</p> : null}
        <div className="table-scroll">
          <table className="table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Email</th>
              <th>Role</th>
              <th>Subscription</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u._id}>
                <td>{u.username || '—'}</td>
                <td>{u.email || '—'}</td>
                <td>{u.role || 'user'}</td>
                <td>{u.subscription?.plan || 'free'} / {u.subscription?.status || 'free'}</td>
                <td>{u.isBanned ? 'Banned' : 'Active'}</td>
                <td>
                  <button type="button" onClick={() => toggleBan(u)}>{u.isBanned ? 'Unban' : 'Ban'}</button>
                  <button type="button" onClick={() => cancelSubscription(u)} disabled={!u.subscription?.stripeSubscriptionId}>Cancel Subscription</button>
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>

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
