import { useAdminPayments } from '@/features/admin/useAdminData'
import AdminLayout from './components/AdminLayout'
import AdminPageHeader from './components/AdminPageHeader'

export default function Payments() {
  const { history, loading } = useAdminPayments()

  return (
    <AdminLayout>
      <div className="admin-payments">
        <AdminPageHeader eyebrow="Revenue operations" title="Payments" description="Monitor payment activity and spot billing issues early." meta={`${history.length} loaded records`} />
        {loading ? <p>Loading…</p> : null}
        <div className="table-scroll admin-data-panel">
          <table className="table">
            <thead><tr><th>Date</th><th>User</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>
              {history.map((h) => (
                <tr key={h._id}><td>{h.createdAt ? new Date(h.createdAt).toLocaleString() : '—'}</td><td>{h.user?.email || 'Unknown user'}</td><td>{h.amount} {h.currency || ''}</td><td><span className={`admin-status admin-status--${h.status || 'pending'}`}>{h.status || 'pending'}</span></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  )
}
