import { useAdminSubscriptions } from '@/features/admin/useAdminData'
import AdminLayout from './components/AdminLayout'
import AdminPageHeader from './components/AdminPageHeader'

export default function Subscriptions() {
  const { plans, loading } = useAdminSubscriptions()

  return (
    <AdminLayout>
      <div className="admin-subscriptions">
        <AdminPageHeader eyebrow="Revenue operations" title="Subscription plans" description="Understand which plans are available and ready for customers." meta={`${plans.length} plans`} />
        {loading ? <p>Loading…</p> : null}
        <ul className="admin-plan-list">
          {plans.map((p) => (
            <li key={p.id}>
              <span className="admin-plan-icon" aria-hidden="true">+</span>
              <span><strong>{p.name}</strong><small>Plan configuration</small></span>
              <span className={`admin-status admin-status--${p.active ? 'active' : 'inactive'}`}>{p.active ? 'Active' : 'Inactive'}</span>
            </li>
          ))}
          {!loading && !plans.length ? <li className="admin-empty-state"><strong>No plans available</strong><span>Plans will appear here when the catalog is connected.</span></li> : null}
        </ul>
      </div>
    </AdminLayout>
  )
}
