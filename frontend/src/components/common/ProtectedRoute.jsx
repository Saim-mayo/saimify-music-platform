import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store'
import LoadingSpinner from './LoadingSpinner'

export default function ProtectedRoute({ children }) {
  const location = useLocation()
  const { isAuthenticated, initialized } = useAuthStore()

  if (!initialized) {
    return <LoadingSpinner label="Loading your session…" />
  }

  if (!isAuthenticated) {
    return <Navigate to="/welcome" replace state={{ from: location }} />
  }

  return children
}
