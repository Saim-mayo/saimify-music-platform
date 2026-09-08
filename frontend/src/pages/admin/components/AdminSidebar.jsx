import { NavLink } from 'react-router-dom'

const links = [
  ['Dashboard', '/admin/dashboard'],
  ['Users', '/admin/users'],
  ['Artist requests', '/admin/artists'],
  ['Songs', '/admin/songs'],
  ['Albums', '/admin/albums'],
  ['Playlists', '/admin/playlists'],
  ['Analytics', '/admin/analytics'],
  ['Reports', '/admin/reports'],
  ['Payments', '/admin/payments'],
  ['Subscriptions', '/admin/subscriptions'],
  ['Settings', '/admin/settings'],
]

export default function AdminSidebar() {
  return (
    <aside className="admin-sidebar">
      <div className="admin-brand-block">
        <div className="admin-brand">Admin</div>
        <span className="admin-brand-note">Workspace</span>
      </div>
      <nav>
        {links.map(([label, path]) => (
          <NavLink key={path} to={path} className={({ isActive }) => `admin-link ${isActive ? 'is-active' : ''}`}>
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
