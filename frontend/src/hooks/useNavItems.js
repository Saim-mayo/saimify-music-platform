import { useMemo } from 'react'
import { useAuthStore } from '@/store'
import { navItems, accountItemsFor } from '@/utils/navigation'
import { isAdmin, isArtistApproved } from '@/utils/authValidation'

export default function useNavItems() {
  const { user, isAuthenticated } = useAuthStore()
  const isArtist = isArtistApproved(user)
  const admin = isAdmin(user)

  const sidebarItems = useMemo(() => navItems, [])

  const accountItems = useMemo(() => accountItemsFor({ isArtist, isAdmin: admin, isAuthenticated }), [admin, isArtist, isAuthenticated])

  return {
    isArtist,
    isAdmin: admin,
    isAuthenticated,
    sidebarItems,
    accountItems,
  }
}
