import { Link } from 'react-router-dom'

export default function AdminNavbar() {
  return (
    <header className="admin-navbar">
      <div className="admin-navbar-left">
        <Link to="/admin/dashboard" className="admin-logo">Admin Panel</Link>
      </div>
      <div className="admin-navbar-right">
        <Link to="/">Return to App</Link>
      </div>
    </header>
  )
}
