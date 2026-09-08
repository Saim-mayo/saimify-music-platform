import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store'
import LoadingSpinner from './LoadingSpinner'

const isEntitled = (subscription = {}) => {
  const status = subscription?.status
  if (!status) return false
  if (status === 'active' || status === 'trialing') {
    if (subscription?.expiresAt && new Date(subscription.expiresAt) < new Date()) return false
    return true
  }
  return false
}

export default function RoleGuard({
  children,
  allow = [],
  requireArtistApproval = false,
  requireSubscription = false,
  requiredPlan = null,
}) {
  const user = useAuthStore((state) => state.user)
  const loading = useAuthStore((state) => state.loading)

  if (loading) return <LoadingSpinner label="Loading your access…" />
  if (!user) return <Navigate to="/login" replace />

  if (user.isBanned) {
    return <div className="page-state">Your account has been suspended.</div>
  }

  if (allow.length > 0 && !allow.includes(user.role)) {
    return <div className="page-state">You do not have access to this page.</div>
  }

  if (requireArtistApproval) {
    const approvalStatus = user.artistVerification?.status || 'none'

    if (user.role !== 'artist' || approvalStatus !== 'approved') {
      return <div className="page-state">Artist access is required for this page.</div>
    }
  }

  if (requireSubscription) {
    const subscription = user.subscription || {}
    if (!isEntitled(subscription)) {
      return <div className="page-state">A paid subscription is required to access this area.</div>
    }
  }

  if (requiredPlan) {
    const subscription = user.subscription || {}
    const plan = String(subscription.plan || 'free').toLowerCase()
    if (plan !== String(requiredPlan).toLowerCase() || !isEntitled(subscription)) {
      return <div className="page-state">This feature requires the {requiredPlan} plan.</div>
    }
  }

  return children || <Outlet />
}
