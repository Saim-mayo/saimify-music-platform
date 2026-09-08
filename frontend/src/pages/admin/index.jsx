import { Navigate, Routes, Route } from 'react-router-dom'
import AdminDashboard from './Dashboard'
import UsersPage from './Users'
import ArtistsPage from './Artists'
import SongsPage from './Songs'
import AlbumsPage from './Albums'
import PlaylistsPage from './Playlists'
import AnalyticsPage from './Analytics'
import ReportsPage from './Reports'
import SettingsPage from './Settings'
import PaymentsPage from './Payments'
import SubscriptionsPage from './Subscriptions'

export default function AdminRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="dashboard" replace />} />
      <Route path="dashboard" element={<AdminDashboard />} />
      <Route path="users" element={<UsersPage />} />
      <Route path="artists" element={<ArtistsPage />} />
      <Route path="songs" element={<SongsPage />} />
      <Route path="albums" element={<AlbumsPage />} />
      <Route path="playlists" element={<PlaylistsPage />} />
      <Route path="analytics" element={<AnalyticsPage />} />
      <Route path="reports" element={<ReportsPage />} />
      <Route path="settings" element={<SettingsPage />} />
      <Route path="payments" element={<PaymentsPage />} />
      <Route path="subscriptions" element={<SubscriptionsPage />} />
      <Route path="*" element={<Navigate to="dashboard" replace />} />
    </Routes>
  )
}
