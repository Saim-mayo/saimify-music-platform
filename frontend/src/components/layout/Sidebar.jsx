import { useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import useNavItems from '@/hooks/useNavItems'
import { useNotificationStore } from '@/store'
import { Skeleton } from '@/components/common'
import { getActiveRoute } from '@/utils/navigation'
import { Icon } from '@/components/ui'
import { usePlaylistsList } from '@/features/user/usePlaylistsList'

export default function Sidebar() {
  const { sidebarItems, accountItems, isAuthenticated } = useNavItems()
  const { unreadCount, refreshUnreadCount } = useNotificationStore()
  const { playlists, loading: loadingPlaylists, error: playlistError, total: playlistCount, reload: loadPlaylists } = usePlaylistsList()

  useEffect(() => {
    if (isAuthenticated) {
      refreshUnreadCount().catch(() => {})
    }
  }, [isAuthenticated, refreshUnreadCount])

  const location = useLocation()
  const visibleItems = sidebarItems.filter((item) => item.to !== '/player' || isAuthenticated)
  const activePath = getActiveRoute(location.pathname)
  const badgeText = unreadCount > 99 ? '99+' : unreadCount > 9 ? '9+' : String(unreadCount || '')

  return (
    <aside className="sidebar" aria-label="Sidebar navigation">
      <div className="sidebar-section">
        <span className="eyebrow">Browse</span>
        <nav className="sidebar-nav">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              className={() => `sidebar-link${activePath === item.to ? ' active' : ''}`}
              to={item.to}
            >
              <Icon name={item.icon} className="sidebar-icon" size={18} />
              <span className="sidebar-link-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="sidebar-section">
        <span className="eyebrow">Artist & account</span>
        <nav className="sidebar-nav">
          {accountItems.map((item) => {
            const isNotifications = item.to === '/notifications'
            return (
              <NavLink key={item.to} className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`} to={item.to}>
                <Icon name={item.icon} className="sidebar-icon" size={18} />
                <span className="sidebar-link-label">{item.label}</span>
                {isNotifications && unreadCount ? <span className="sidebar-badge">{badgeText}</span> : null}
              </NavLink>
            )
          })}
        </nav>
      </div>

      <div className="sidebar-section">
        <span className="eyebrow">Your playlists</span>
        <div className="sidebar-playlists">
          {loadingPlaylists ? <Skeleton lines={3} /> : null}
          {!loadingPlaylists && playlistError ? <button type="button" className="btn btn-ghost btn-compact" onClick={loadPlaylists}>Retry playlists</button> : null}
          {!loadingPlaylists && !playlistError && playlists.map((playlist) => (
            <NavLink
              key={playlist._id || playlist.id}
              className={({ isActive }) => `sidebar-playlist-link${isActive ? ' active' : ''}`}
              to={`/playlists/${playlist._id || playlist.id}`}
            >
              {location.pathname === `/playlists/${playlist._id || playlist.id}` ? <span className="sidebar-playlist-dot" aria-label="Currently viewing this playlist" /> : null}
              <span className="sidebar-playlist-label">{playlist.title || playlist.name || 'Untitled playlist'}</span>
            </NavLink>
          ))}
          {!loadingPlaylists && !playlistError && !playlists.length ? <p className="subtitle">You don't have any playlists yet. Create one from the library to save tracks.</p> : null}
          {!loadingPlaylists && !playlistError && playlistCount > playlists.length ? (
            <NavLink to="/library" className="sidebar-link sidebar-link--small">See all playlists →</NavLink>
          ) : null}
        </div>
      </div>
      <div className="sidebar-footer">
        <div>
          <span className="eyebrow">Saimify</span>
          <p className="subtitle">Your music, playlists, and account tools in one calm column.</p>
        </div>
      </div>
    </aside>
  )
}
