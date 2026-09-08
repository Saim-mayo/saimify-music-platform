import AdminLayout from './components/AdminLayout'
import AdminPageHeader from './components/AdminPageHeader'

export default function Analytics() {
  return (
    <AdminLayout>
      <div className="admin-section">
        <AdminPageHeader eyebrow="Insights" title="Analytics" description="View platform usage, growth trends, and revenue metrics." meta="Data workspace" />
        <section className="admin-placeholder-grid">
          <article><span className="section-kicker">Listening</span><strong>Usage trends</strong><p>Playback and discovery metrics will surface here.</p></article>
          <article><span className="section-kicker">Growth</span><strong>Audience health</strong><p>Track account and artist growth in one view.</p></article>
          <article><span className="section-kicker">Revenue</span><strong>Plan performance</strong><p>Compare subscription movement over time.</p></article>
        </section>
      </div>
    </AdminLayout>
  )
}
