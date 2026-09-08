import { useEffect, useRef, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { ProtectedRoute, RoleGuard, LoadingSpinner, Toast } from '@/components/common'
import { BottomPlayer, Navbar, Sidebar } from '@/components/layout'
import Home from '@/pages/user/Home'
import Login from '@/pages/auth/Login'
import Register from '@/pages/auth/Register'
import Search from '@/pages/user/Search'
import Profile from '@/pages/user/Profile'
import Library from '@/pages/user/Library'
import PlaylistView from '@/pages/user/PlaylistView'
import ArtistUpload from '@/pages/artist/ArtistUpload'
import AlbumDetail from '@/pages/user/AlbumDetail'
import BillingPage from '@/pages/user/BillingPage'
import NotificationsPage from '@/pages/user/NotificationsPage'
import AdminRoutes from '@/pages/admin'
import VerifyEmail from '@/pages/auth/VerifyEmail'
import ForgotPassword from '@/pages/auth/ForgotPassword'
import ResetPassword from '@/pages/auth/ResetPassword'
import OAuthCallback from '@/pages/auth/OAuthCallback'
import MusicPlayer from '@/pages/user/MusicPlayer'
import Welcome from '@/pages/auth/Welcome'
import { BottomNav } from '@/components/ui'
import { useAuthStore } from '@/store'
import useSessionRefresh from '@/hooks/useSessionRefresh'
import { publicPaths } from '@/utils/navigation'
import { runtime } from '@/config/runtime'

function AppFrame() {
  const location = useLocation()
  const navigate = useNavigate()
  const [toast, setToast] = useState({ message: '', tone: 'info', actionLabel: null, action: null })
  const isPublic = publicPaths.some((path) => location.pathname.startsWith(path))
  const isAdminRoute = location.pathname.startsWith('/admin')

  useEffect(() => {
    const handleToast = (event) => {
      const detail = event?.detail || {}
      if (!detail.message) return
      setToast({
        message: detail.message,
        tone: detail.tone || 'info',
        actionLabel: detail.actionLabel || null,
        action: detail.action || null
      })
    }
    window.addEventListener('toast', handleToast)
    return () => window.removeEventListener('toast', handleToast)
  }, [])

  const handleToastAction = () => {
    if (toast.action?.type === 'navigate' && typeof toast.action.to === 'string') {
      navigate(toast.action.to)
    }
    setToast({ message: '', tone: 'info', actionLabel: null, action: null })
  }

  if (isAdminRoute) {
    return (
      <div className={`app-frame admin-route`}>
        {toast.message ? (
          <Toast
            message={toast.message}
            tone={toast.tone}
            actionLabel={toast.actionLabel}
            onAction={toast.action ? handleToastAction : undefined}
            onClose={() => setToast({ message: '', tone: 'info', actionLabel: null, action: null })}
          />
        ) : null}
        <Routes>
          <Route path="/admin/*" element={<ProtectedRoute><RoleGuard allow={['admin']}><AdminRoutes /></RoleGuard></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
        </Routes>
      </div>
    )
  }

  return (
    <div className={`app-frame${isPublic ? ' is-public' : ''}`}>
      {toast.message ? (
        <Toast
          message={toast.message}
          tone={toast.tone}
          actionLabel={toast.actionLabel}
          onAction={toast.action ? handleToastAction : undefined}
          onClose={() => setToast({ message: '', tone: 'info', actionLabel: null, action: null })}
        />
      ) : null}
      {!isPublic ? <Navbar /> : null}
      <div className="main-layout">
        {!isPublic ? <Sidebar /> : null}
        <main className="content-area">
          <Routes>
            <Route path="/welcome" element={<Welcome />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/auth/google/callback" element={<OAuthCallback />} />
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="/search" element={<ProtectedRoute><Search /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/library" element={<ProtectedRoute><Library /></ProtectedRoute>} />
            <Route path="/playlists" element={<Navigate to="/library" replace />} />
            <Route path="/playlists/:playlistId" element={<ProtectedRoute><PlaylistView /></ProtectedRoute>} />
            <Route path="/player" element={<ProtectedRoute><MusicPlayer /></ProtectedRoute>} />
            <Route path="/artist" element={<ProtectedRoute><RoleGuard requireArtistApproval><ArtistUpload /></RoleGuard></ProtectedRoute>} />
            <Route path="/albums/:albumId" element={<ProtectedRoute><AlbumDetail /></ProtectedRoute>} />
            <Route path="/billing" element={<ProtectedRoute><BillingPage /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
      {!isPublic ? <BottomNav /> : null}
      {!isPublic ? <BottomPlayer /> : null}
    </div>
  )
}

export default function App() {
  const fetchMe = useAuthStore((s) => s.fetchMe)
  const refreshAccessToken = useAuthStore((s) => s.refreshAccessToken)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const loading = useAuthStore((s) => s.loading)
  const hasFetchedMe = useRef(false)

  const refreshDelayMs = Math.max(runtime.accessTokenExpiresMs - runtime.accessTokenRefreshLeadMs, runtime.minimumRefreshDelayMs)

  useEffect(() => {
    if (hasFetchedMe.current) return
    hasFetchedMe.current = true
    fetchMe()
  }, [fetchMe])

  useSessionRefresh({ isAuthenticated, refresh: refreshAccessToken, delayMs: refreshDelayMs })

  if (
    loading &&
    !publicPaths.some((path) => window.location.pathname.startsWith(path))
  ) {
    return <LoadingSpinner label="Preparing your listening space…" />
  }

  return <BrowserRouter><AppFrame /></BrowserRouter>
}
