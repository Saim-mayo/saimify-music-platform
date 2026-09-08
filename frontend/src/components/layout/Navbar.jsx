import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { requestSearchFocus, useAuthStore, useNotificationStore, useThemeStore } from '@/store'
import SaimifyLogo from '@/components/SaimifyLogo'
import { Icon } from '@/components/ui'
import { isInnerPagePath } from '@/utils/navigation'
import { runtime } from '@/config/runtime'
import { isAdmin } from '@/utils/authValidation'

const getInitials = (value = '') => {
    const normalized = String(value || '').trim()
    if (!normalized) return 'P'
    const source = normalized.includes('@') ? normalized.split('@')[0] : normalized
    const words = source.split(/\s+|\.|-|_/).filter(Boolean)
  const initials = words.slice(0, 2).map((word) => word[0]?.toUpperCase() || '')
  return initials.join('') || 'P'
}

export default function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isAuthenticated, logout } = useAuthStore()
  const { unreadCount, refreshUnreadCount } = useNotificationStore()
  const { theme, toggleTheme } = useThemeStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const [avatarFailed, setAvatarFailed] = useState(false)
  const menuRef = useRef(null)
  const isInnerPage = isInnerPagePath(location.pathname)

  useEffect(() => {
    if (isAuthenticated) {
      refreshUnreadCount().catch(() => {})
      const interval = window.setInterval(() => refreshUnreadCount().catch(() => {}), runtime.unreadRefreshMs)
      return () => window.clearInterval(interval)
    }
    return undefined
  }, [isAuthenticated, refreshUnreadCount])

  useEffect(() => {
    const handlePointerDown = (event) => {
      const ref = menuRef.current
      if (ref && ref.contains(event.target)) {
        return
      }
      setMenuOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
    setAvatarFailed(false)
  }, [location.pathname])

  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }, [])

  const badgeText = unreadCount > 99 ? '99+' : unreadCount > 9 ? '9+' : String(unreadCount || '')

  const avatarSource = user?.avatar && !avatarFailed ? user.avatar : ''

  const userIsAdmin = isAdmin(user)
  const canGoBack = typeof window !== 'undefined' ? (window.history.state?.idx ?? 0) > 0 : false

  const handleBack = () => {
    if (canGoBack) {
      navigate(-1)
      return
    }
    navigate('/home')
  }

  const handleForward = () => navigate(1)

  if (!isAuthenticated) {
    return (
      <header className="topbar">
        <Link className="brand" to="/home" aria-label="Saimify home">
          <SaimifyLogo size={40} className="brand-mark" aria-hidden="true" />
          <span className="brand-copy">
            <span className="brand-title">Saimify</span>
            <span className="brand-owner">by Saim Khan</span>
          </span>
        </Link>
        <div className="topbar-actions">
          <button type="button" className="icon-button" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
          </button>
          <Link to="/login" className="topbar-login">Log in</Link>
          <Link to="/register" className="btn btn-primary btn-compact">Join</Link>
        </div>
      </header>
    )
  }

  const avatarAlt = user?.name || user?.username || 'User'

  const displayTitle = isInnerPage ? 'Saimify' : greeting

  return (
    <header className="topbar">
      <div className="topbar-left">
        {isInnerPage ? (
          <div className="topbar-left-inner" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button type="button" className={`icon-button${canGoBack ? '' : ' is-disabled'}`} onClick={handleBack} aria-label="Go back" disabled={!canGoBack}>
              <Icon name="back" />
            </button>
            <button type="button" className="icon-button" onClick={handleForward} aria-label="Go forward" title="Go forward">
              <Icon name="forward" />
            </button>
            <Link className="brand" to="/home" aria-label="Saimify home">
              <SaimifyLogo size={28} className="brand-mark" aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <Link className="brand" to="/home" aria-label="Saimify home">
            <SaimifyLogo size={40} className="brand-mark" aria-hidden="true" />
            <span className="brand-copy">
              <span className="brand-title">Saimify</span>
              <span className="brand-owner">by Saim Khan</span>
            </span>
          </Link>
        )}
        <div className="topbar-title">{displayTitle}</div>
      </div>

      <div className="topbar-actions">
        <button type="button" className="icon-button" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>
        <button type="button" className="icon-button topbar-search-button" onClick={() => {
          navigate('/search')
          requestSearchFocus()
        }} aria-label="Open search">
          <Icon name="search" />
        </button>
        <button type="button" className="icon-button" onClick={() => navigate('/notifications')} aria-label="Open notifications">
          <Icon name="bell" />
          {unreadCount ? <span className="badge">{badgeText}</span> : null}
        </button>
        <div ref={menuRef} className="topbar-menu-shell">
          <button type="button" className="avatar-button" onClick={() => setMenuOpen((open) => !open)} aria-label="Open user menu" aria-expanded={menuOpen}>
            {avatarSource ? (
              <img src={avatarSource} alt={avatarAlt} className="avatar-image" onError={() => setAvatarFailed(true)} />
            ) : (
              <span className="avatar-placeholder">{getInitials(user?.name || user?.username)}</span>
            )}
          </button>
          {menuOpen ? (
            <div className="user-menu">
              <Link to="/profile" onClick={() => setMenuOpen(false)}>Profile</Link>
              {userIsAdmin ? <Link to="/admin" onClick={() => setMenuOpen(false)}>Admin panel</Link> : null}
              <button type="button" onClick={() => { logout().catch(() => {}); setMenuOpen(false) }}>Log out</button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}
