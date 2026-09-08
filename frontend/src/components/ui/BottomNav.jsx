import { useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import useNavItems from '@/hooks/useNavItems'
import MobileNavDrawer from './MobileNavDrawer'
import Icon from './Icon'
import { getActiveRoute } from '@/utils/navigation'

export default function BottomNav() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const triggerRef = useRef(null)
  const location = useLocation()
  const { sidebarItems, accountItems, isAuthenticated } = useNavItems()

  const coreBottomRoutes = new Set(['/home', '/search', '/library', '/profile'])
  // Build bottom nav visible items from the single source of truth (sidebarItems + accountItems)
  const visibleItems = sidebarItems.filter((item) => coreBottomRoutes.has(item.to))
  if (isAuthenticated) {
    const profileItem = accountItems.find((it) => it.to === '/profile')
    if (profileItem && !visibleItems.some((it) => it.to === '/profile')) visibleItems.push(profileItem)
  }
  const drawerItems = [
    ...sidebarItems.filter((item) => !coreBottomRoutes.has(item.to)),
    ...accountItems,
  ]
  const showMoreButton = drawerItems.length > 0

  const activePath = getActiveRoute(location.pathname)

  return (
    <>
      <nav className="bottom-nav" aria-label="Primary navigation">
        {visibleItems.map((item) => {
          const isActive = activePath === item.to
          return (
            <NavLink key={item.to} to={item.to} className={() => `bottom-nav-item${isActive ? ' is-active' : ''}`}>
              <Icon name={item.icon} className="bottom-nav-icon" size={18} />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
        {showMoreButton ? (
          <button type="button" ref={triggerRef} className="bottom-nav-item bottom-nav-item--button" onClick={() => setDrawerOpen(true)} aria-label="Open more navigation options">
            <span className="bottom-nav-icon" aria-hidden="true">☰</span>
            <span>More</span>
          </button>
        ) : null}
      </nav>
      <MobileNavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} triggerRef={triggerRef} location={location} items={drawerItems} />
    </>
  )
}
