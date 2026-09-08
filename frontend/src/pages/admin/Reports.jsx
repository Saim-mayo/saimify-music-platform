import AdminLayout from './components/AdminLayout'
import AdminPageHeader from './components/AdminPageHeader'

export default function Reports() {
  return (
    <AdminLayout>
      <div className="admin-section">
        <AdminPageHeader eyebrow="Insights" title="Reports" description="Export reports, audit activity, and get insight into system health." meta="Export center" />
        <section className="admin-tool-panel">
          <div><span className="section-kicker">Report center</span><h2>Choose a report to prepare</h2><p className="subtitle">Your export tools will appear here as report sources are connected.</p></div>
          <button type="button" className="btn btn-ghost" disabled>Prepare export</button>
        </section>
      </div>
    </AdminLayout>
  )
}
