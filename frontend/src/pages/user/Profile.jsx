import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { HistoryCard, Skeleton, Toast } from '@/components/common'
import { Artwork } from '@/components/ui'
import { useAuthStore, useSubscriptionStore } from '@/store'
import useProfileData from '@/features/profile/useProfileData'
import { getApiErrorMessage } from '@/api'
import useUserActions from '@/features/user/useUserActions'
import { isAdmin, isArtistApproved } from '@/utils/authValidation'

const getInitialStatus = (profile) => {
  const raw = profile?.artistVerification?.status || profile?.artistVerification?.state || ''
  return String(raw || '').toLowerCase()
}

export default function Profile() {
  const [profileForm, setProfileForm] = useState({ username: '', bio: '' })
  const [passwordForm, setPasswordForm] = useState({ password: '', confirmPassword: '' })
  const [avatarFile, setAvatarFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState({ message: '', tone: 'info' })
  const requestArtistAccess = useAuthStore((state) => state.requestArtistAccess)
  const fetchMe = useAuthStore((state) => state.fetchMe)
  const subscription = useSubscriptionStore((state) => state.subscription)
  const loadSubscriptionStatus = useSubscriptionStore((state) => state.loadSubscriptionStatus)
  const { profile, playlists, history, loading, error: loadError, reload } = useProfileData({ loadSubscriptionStatus })
  const { setPassword, updateProfile, uploadAvatar } = useUserActions()
  const navigate = useNavigate()

  useEffect(() => {
    if (!profile) return
    setProfileForm({ username: profile.username || '', bio: profile.bio || '' })
  }, [profile])

  const handleProfileSave = async (event) => {
    event.preventDefault()
    setBusy(true)
    try {
      const payload = {
        username: profileForm.username.trim(),
        bio: profileForm.bio.trim(),
      }
      await updateProfile(payload)
      const refreshedProfile = await fetchMe()
      await reload()
      setProfileForm({ username: refreshedProfile?.username || profileForm.username.trim(), bio: refreshedProfile?.bio || profileForm.bio.trim() })
      setToast({ message: 'Profile updated.', tone: 'success' })
    } catch (err) {
      setToast({ message: getApiErrorMessage(err, 'Unable to update profile.'), tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const handleAvatarUpload = async (event) => {
    event.preventDefault()
    if (!avatarFile) {
      setToast({ message: 'Choose an image first.', tone: 'error' })
      return
    }

    setBusy(true)
    try {
      const formData = new FormData()
      formData.append('avatar', avatarFile)
      const data = await uploadAvatar(formData)
      await fetchMe()
      await reload()
      setAvatarFile(null)
      setToast({ message: data?.message || 'Avatar updated.', tone: 'success' })
    } catch (err) {
      setToast({ message: getApiErrorMessage(err, 'Unable to update avatar.'), tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const handlePasswordSave = async (event) => {
    event.preventDefault()
    if (passwordForm.password !== passwordForm.confirmPassword) {
      setToast({ message: 'Passwords do not match.', tone: 'error' })
      return
    }

    setBusy(true)
    try {
      const data = await setPassword(passwordForm.password)
      setPasswordForm({ password: '', confirmPassword: '' })
      setToast({ message: data?.message || 'Password set successfully.', tone: 'success' })
    } catch (err) {
      setToast({ message: getApiErrorMessage(err, 'Unable to set password.'), tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const handleArtistRequest = async () => {
    setBusy(true)
    try {
      const data = await requestArtistAccess()
      await reload()
      setToast({ message: data?.message || 'Artist request submitted.', tone: 'success' })
    } catch (err) {
      setToast({ message: getApiErrorMessage(err, 'Unable to submit the artist request.'), tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const artistStatus = getInitialStatus(profile)
  const isArtist = isArtistApproved(profile)
  const isPending = ['pending', 'pending_review', 'submitted', 'requested'].includes(artistStatus)
  const roleLabel = isAdmin(profile) ? 'Admin' : profile?.role === 'artist' ? 'Artist' : 'Listener'

  if (loading) {
    return (
      <div className="content-shell">
        <section className="card auth-form-stack">
          <Skeleton className="profile-skeleton" lines={4} />
        </section>
      </div>
    )
  }

  if (loadError) {
    return <div className="content-shell"><div className="error-banner"><span>{loadError}</span><button type="button" className="btn btn-ghost btn-compact" onClick={() => window.location.reload()}>Retry</button></div></div>
  }

  return (
    <div className="content-shell profile-shell profile-dashboard">
      <section className="card profile-summary-card">
        <div className="profile-summary-main">
          <div className="profile-summary-avatar">
            <Artwork item={{ avatar: profile?.avatar, title: profile?.username || profile?.name || 'Profile' }} size="large" className="profile-avatar profile-avatar--summary" />
          </div>
          <div className="profile-summary-copy">
            <div className="profile-summary-header">
              <div>
                <h1>{profile?.username || 'Your profile'}</h1>
                <p className="subtitle profile-summary-subtitle">{profile?.bio || 'Keep your profile up to date and manage your listening space.'}</p>
              </div>
              <div className="profile-summary-meta">
                <span>{profile?.email || 'No email available.'}</span>
                <span className="status-pill status-pill--neutral">{subscription?.status || 'No active subscription'}</span>
              </div>
            </div>
            <div className="row-actions profile-summary-flags">
              {!isAdmin(profile) ? (
                <span className={`status-pill ${isArtist ? 'status-pill--approved' : isPending ? 'status-pill--pending' : 'status-pill--neutral'}`}>
                  {isArtist ? 'Artist access' : isPending ? 'Pending approval' : 'Standard account'}
                </span>
              ) : null}
              <span className="status-pill status-pill--neutral">{roleLabel}</span>
              <span className="status-pill status-pill--neutral">{subscription?.plan || 'Free'} plan</span>
            </div>
          </div>
          <div className="profile-summary-actions">
            <button type="button" className="btn btn-compact" onClick={() => navigate('/billing')}>View billing</button>
            <p className="subtitle">Renews {subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : 'when the current period ends'}</p>
          </div>
        </div>
      </section>

      <Toast message={toast.message} tone={toast.tone} onClose={() => setToast({ message: '', tone: 'info' })} />

      <div className="profile-grid profile-info-grid">
        <section className="card profile-settings-card">
          <div className="section-heading">
            <h2>Profile information</h2>
            <span className="section-link">Details</span>
          </div>
          <form className="profile-settings-form" onSubmit={handleProfileSave}>
            <div className="field">
              <span>Display name</span>
              <input className="input" value={profileForm.username} onChange={(event) => setProfileForm((current) => ({ ...current, username: event.target.value }))} placeholder="Your username" />
            </div>
            <div className="field">
              <span>Bio</span>
              <input className="input" value={profileForm.bio} onChange={(event) => setProfileForm((current) => ({ ...current, bio: event.target.value }))} placeholder="Tell people a bit about yourself" />
            </div>
            <div className="row-actions">
              <button type="submit" className="btn btn-primary" disabled={busy}>Save profile</button>
            </div>
          </form>
        </section>

        <section className="card profile-avatar-card">
          <div className="section-heading">
            <h2>Avatar</h2>
            <span className="section-link">Profile photo</span>
          </div>
          <p className="subtitle">Upload a fresh profile image for your artist account.</p>
          <form className="profile-avatar-form" onSubmit={handleAvatarUpload}>
            <input type="file" accept="image/*" onChange={(event) => setAvatarFile(event.target.files?.[0] || null)} />
            <div className="row-actions profile-avatar-actions">
              <button type="submit" className="btn btn-primary" disabled={busy}>Upload avatar</button>
            </div>
          </form>
        </section>
      </div>

      <div className="profile-grid profile-action-grid">
        <section className="card profile-password-card">
          <div className="section-heading">
            <h2>Set password</h2>
            <span className="section-link">Security</span>
          </div>
          <p className="subtitle">Create a local password so you can sign in with email and password too.</p>
          <form className="profile-password-form" onSubmit={handlePasswordSave}>
            <div className="field">
              <span>Password</span>
              <input className="input" type="password" value={passwordForm.password} onChange={(event) => setPasswordForm((current) => ({ ...current, password: event.target.value }))} placeholder="Choose a secure password" />
            </div>
            <div className="field">
              <span>Confirm password</span>
              <input className="input" type="password" value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))} placeholder="Confirm password" />
            </div>
            <div className="row-actions">
              <button type="submit" className="btn btn-primary" disabled={busy}>Set password</button>
            </div>
          </form>
        </section>

        {!isAdmin(profile) ? (
          <section className="card profile-artist-card">
            <div className="section-heading">
              <h2>Artist access</h2>
              <span className="section-link">Creator tools</span>
            </div>
            <p className="subtitle">Submit a request to upload music, manage releases, and unlock the artist workflow.</p>
            {isArtist ? (
              <div className="artist-status-card">
                <span className="status-pill status-pill--approved">Artist access active</span>
                <p className="subtitle">You can upload music, manage releases, and access artist controls.</p>
              </div>
            ) : (
              <div className="artist-action-stack">
                {isPending ? <p className="subtitle">Your artist request is pending review. You can still send it again if needed.</p> : null}
                <button type="button" className="btn btn-primary" onClick={handleArtistRequest} disabled={busy}>
                  {busy ? 'Working…' : isPending ? 'Send request again' : 'Request artist access'}
                </button>
              </div>
            )}
          </section>
        ) : null}
      </div>

      <div className="profile-grid profile-playlist-overview">
        <section className="card profile-playlist-summary-card">
          <div className="section-heading">
            <h2>Your playlists</h2>
            <Link className="section-link" to="/library">View all</Link>
          </div>
          <div className="profile-playlist-grid">
            {playlists.length ? playlists.slice(0, 4).map((playlist) => (
              <Link key={playlist._id} to={`/playlists/${playlist._id}`} className="card playlist-card profile-playlist-card-item profile-playlist-card-link">
                <h3>{playlist.title}</h3>
                <p>{playlist.songs?.length || 0} songs</p>
              </Link>
            )) : <p className="subtitle">No playlists yet.</p>}
          </div>
        </section>
      </div>

      <section className="card profile-history-card">
        <div className="section-heading">
          <h2>Recent listening history</h2>
          <span className="section-link">Latest plays</span>
        </div>
        <div className="profile-history-grid song-grid">
          {history.length ? history.map((item) => (
            <HistoryCard key={item._id || item?.song?._id || item?.song?.id} entry={item} />
          )) : <p className="subtitle">No history yet.</p>}
        </div>
      </section>
    </div>
  )
}
