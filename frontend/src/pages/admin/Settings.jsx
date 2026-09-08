import AdminLayout from './components/AdminLayout'
import AdminPageHeader from './components/AdminPageHeader'

export default function Settings() {
  return (
    <AdminLayout>
      <div className="admin-section">
        <AdminPageHeader eyebrow="System" title="Settings" description="Configure platform settings, site notices, and admin preferences." meta="Configuration" />
        <section className="admin-settings-list">
          <article><span className="admin-setting-icon">01</span><span><strong>Platform settings</strong><small>Core playback and catalog behavior</small></span><span className="admin-setting-arrow">-&gt;</span></article>
          <article><span className="admin-setting-icon">02</span><span><strong>Site notices</strong><small>Announcements and operational messaging</small></span><span className="admin-setting-arrow">-&gt;</span></article>
          <article><span className="admin-setting-icon">03</span><span><strong>Admin preferences</strong><small>Personal workspace defaults</small></span><span className="admin-setting-arrow">-&gt;</span></article>
        </section>
      </div>
    </AdminLayout>
  )
}
