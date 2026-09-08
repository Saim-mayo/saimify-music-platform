export const publicPaths = [
  '/welcome',
  '/login',
  '/register',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
  '/auth/google/callback',
]

export const navItems = [
  { to: '/home', label: 'Home', icon: 'home' },
  { to: '/search', label: 'Search', icon: 'search' },
  { to: '/library', label: 'Library', icon: 'library' },
]

export const accountItemsFor = ({ isArtist, isAdmin, isAuthenticated }) => {
  const items = []

  if (isArtist) {
    items.push({ to: '/artist', label: 'Artist Studio', icon: 'artist' })
  }

  if (isAuthenticated) {
    items.push({ to: '/notifications', label: 'Notifications', icon: 'bell' })
    items.push({ to: '/billing', label: 'Billing', icon: 'billing' })
  }

  if (isAdmin) {
    items.push({ to: '/admin', label: 'Admin', icon: 'admin' })
  }

  return items
}

export const isInnerPagePath = (pathname) => {
  return [
    '/home',
    '/search',
    '/library',
    '/profile',
    '/player',
    '/billing',
    '/notifications',
    '/artist',
    '/admin',
    '/albums',
  ].some((path) => pathname.startsWith(path))
}

export const getActiveRoute = (pathname) => {
  if (pathname.startsWith('/albums')) return '/albums'
  if (pathname.startsWith('/library')) return '/library'
  if (pathname.startsWith('/playlists')) return '/library'
  if (pathname.startsWith('/search')) return '/search'
  if (pathname.startsWith('/profile')) return '/profile'
  if (pathname.startsWith('/player')) return '/player'
  if (pathname.startsWith('/billing')) return '/billing'
  if (pathname.startsWith('/notifications')) return '/notifications'
  if (pathname.startsWith('/artist')) return '/artist'
  if (pathname.startsWith('/admin')) return '/admin'
  if (pathname === '/' || pathname === '') return '/home'
  return pathname
}

