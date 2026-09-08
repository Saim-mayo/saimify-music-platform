import AdminSidebar from './AdminSidebar'
import AdminNavbar from './AdminNavbar'

export default function AdminLayout({ children }) {
  return (
    <div className="admin-frame">
      <AdminNavbar />
      <div className="admin-layout">
        <AdminSidebar />
        <main className="admin-content">{children}</main>
      </div>
    </div>
  )
}
