import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { PlaylistCard, TrackRow } from '@/components/ui'
import { ConfirmAction, PlaylistPicker, Skeleton } from '@/components/common'
import { useAuthStore, usePlayerStore } from '@/store'
import { dispatchErrorToast, showToast } from '@/utils/toast'
import useLibraryData from '@/features/library/useLibraryData'
import useUserActions from '@/features/user/useUserActions'
import { isArtistApproved } from '@/utils/authValidation'
import { isTrackActive } from '@/domain/media/playback'

export default function Library() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuthStore()
  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayerStore()
  const { createPlaylist, deletePlaylist, recordPlay } = useUserActions()
  const canViewCatalog = isArtistApproved(user)
  const { playlists, songCatalog, likedSongs, loading, error, reload } = useLibraryData({
    canViewCatalog,
    refreshKey: location.key,
  })
  const [playlistName, setPlaylistName] = useState('')
  const [playlistCover, setPlaylistCover] = useState(null)
  const [playlistSearchQuery, setPlaylistSearchQuery] = useState('')
  const [catalogSearchQuery, setCatalogSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('recent')
  const [deleteConfirmPlaylistId, setDeleteConfirmPlaylistId] = useState('')

  // If navigated with a hash (#library-playlists), scroll to the playlists region
  useEffect(() => {
    if (location?.hash === '#library-playlists') {
      const el = document.getElementById('library-playlists')
      if (el) {
        setTimeout(() => {
          try {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' })
          } catch (error) {
            console.warn('Scroll into view failed', error)
          }
        }, 80)
      }
    }
  }, [location?.hash])

  const filteredCatalog = useMemo(() => {
    const normalized = String(catalogSearchQuery || '').trim().toLowerCase()
    if (!normalized) return songCatalog
    return songCatalog.filter((song) => {
      const title = String(song?.title || song?.name || '').toLowerCase()
      const artist = String(song?.artist?.username || song?.artist?.name || song?.artist || '').toLowerCase()
      return title.includes(normalized) || artist.includes(normalized)
    })
  }, [songCatalog, catalogSearchQuery])

  const sortedPlaylists = useMemo(() => {
    const filtered = playlistSearchQuery.trim()
      ? playlists.filter((playlist) => String(playlist?.title || '').toLowerCase().includes(playlistSearchQuery.trim().toLowerCase()))
      : playlists
    const list = [...filtered]
    if (sortBy === 'alphabetical') {
      return list.sort((a, b) => String(a?.title || '').localeCompare(String(b?.title || '')))
    }
    return list.sort((a, b) => {
      const aTime = new Date(a?.createdAt).getTime() || 0
      const bTime = new Date(b?.createdAt).getTime() || 0
      return bTime - aTime
    })
  }, [playlists, playlistSearchQuery, sortBy])

  const playlistCollectionCount = useMemo(() => {
    return 1 + sortedPlaylists.length
  }, [sortedPlaylists])

  const getTrackId = (song) => song?._id || song?.id

  const handleCreatePlaylist = async (event) => {
    event.preventDefault()
    const trimmedTitle = playlistName.trim()
    if (!trimmedTitle) return
    try {
      const payload = { title: trimmedTitle, isPublic: true }
      const data = playlistCover ? await createPlaylist({ ...payload, cover: playlistCover }) : await createPlaylist(payload)
      const nextPlaylist = data?.playlist || data
      void reload()
      setPlaylistName('')
      setPlaylistCover(null)
      showToast({ message: 'Playlist created.', tone: 'success' })
      if (nextPlaylist?._id) {
        navigate(`/playlists/${nextPlaylist._id}`)
      }
    } catch (err) {
      dispatchErrorToast(err)
    }
  }

  const handleDeletePlaylist = async (playlistIdToDelete) => {
    if (!playlistIdToDelete) return
    try {
      await deletePlaylist(playlistIdToDelete)
      void reload()
      setDeleteConfirmPlaylistId('')
      showToast({ message: 'Playlist deleted.', tone: 'success' })
    } catch (err) {
      dispatchErrorToast(err)
    }
  }

  const handlePlaySong = async (song, index = 0) => {
    if (!song) return
    const songId = getTrackId(song)
    if (!songId) return
    try {
      await recordPlay(songId)
      playTrack(song, [song], index)
    } catch (error) {
      dispatchErrorToast(error)
    }
  }

  const handlePlayPlaylist = async (playlist) => {
    const songs = Array.isArray(playlist?.songs) ? playlist.songs : []
    if (!songs.length) return
    const firstSong = songs[0]
    try {
      await recordPlay(firstSong?._id || firstSong?.id)
      playTrack(firstSong, songs, 0)
    } catch (error) {
      dispatchErrorToast(error)
    }
  }

  return (
    <div className="content-shell library-shell">
      {loading ? (
        <>
          <section className="card library-dashboard-header">
            <div className="skeleton" style={{ minHeight: 120 }}>
              <Skeleton lines={4} />
            </div>
          </section>
          <section className="surface-grid library-overview-grid">
            {Array.from({ length: 6 }).map((_, index) => (
              <div className="surface-tile library-stat-card library-stat-card--skeleton" key={index}>
                <Skeleton lines={3} />
              </div>
            ))}
          </section>
        </>
      ) : null}

      {error ? (
        <div className="error-banner">
          <span>{error}</span>
            <button type="button" className="btn btn-ghost btn-compact" onClick={reload}>Retry</button>
        </div>
      ) : null}

      {!loading ? (
        <>
          <section className="card library-dashboard-header">
            <div>
              <span className="section-kicker">Library</span>
              <h1>Your music collection</h1>
              <p className="subtitle">Manage your playlists, view saved songs, and browse your catalog from one workspace.</p>
            </div>
            <div className="row-actions library-dashboard-actions">
              <button type="button" className="btn btn-primary" onClick={() => navigate('/playlists/liked')}>View liked songs</button>
            </div>
          </section>

          <section className="surface-grid library-overview-grid">
            <article className="surface-tile library-stat-card">
              <div>
                <strong>{sortedPlaylists.length}</strong>
                <span>Playlists</span>
              </div>
              <p>All saved playlists in your library.</p>
            </article>
            <article className="surface-tile library-stat-card">
              <div>
                <strong>{likedSongs.length}</strong>
                <span>Liked songs</span>
              </div>
              <p>Tracks you have marked as favourites.</p>
            </article>
            <article className="surface-tile library-stat-card">
              <div>
                <strong>{songCatalog.length}</strong>
                <span>Tracks</span>
              </div>
              <p>All songs available in your catalog.</p>
            </article>
          </section>

          <section className="card library-toolbar">
            <div className="library-toolbar-row">
              <div className="search-field library-search-shell">
                <input
                  className="input"
                  value={playlistSearchQuery}
                  onChange={(event) => setPlaylistSearchQuery(event.target.value)}
                  placeholder="Search playlists"
                />
                {playlistSearchQuery ? (
                  <button type="button" className="library-search-clear" onClick={() => setPlaylistSearchQuery('')} aria-label="Clear playlist search">
                    ×
                  </button>
                ) : null}
              </div>
              <div className="row-actions library-toolbar-actions">
                <label className="field library-field-inline">
                  <span>Sort</span>
                  <select className="input" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                    <option value="recent">Recent</option>
                    <option value="alpha">A → Z</option>
                  </select>
                </label>
                <button type="button" className="btn btn-ghost" onClick={() => setPlaylistSearchQuery('')}>
                  Clear filters
                </button>
              </div>
            </div>

            <form className="library-create-playlist-form" onSubmit={handleCreatePlaylist}>
              <div className="library-create-row">
                <input className="input" placeholder="New playlist name" value={playlistName} onChange={(event) => setPlaylistName(event.target.value)} />
                <button type="submit" className="btn btn-primary">Create playlist</button>
              </div>
              <div className="library-create-row library-create-file-row">
                <label htmlFor="playlist-cover-input" className="field library-field-inline">
                  <span>Cover image</span>
                  <input
                    id="playlist-cover-input"
                    className="input"
                    type="file"
                    accept="image/*"
                    onChange={(event) => setPlaylistCover(event.target.files?.[0] || null)}
                  />
                </label>
              </div>
            </form>
          </section>

          <section className="library-playlist-section">
            <div id="library-playlists" />
            <div className="section-heading">
              <div>
                <h2>Your playlists</h2>
                <p className="subtitle">Browse your saved playlists and open them in a dedicated detail view.</p>
              </div>
              <span className="subtitle">{playlistCollectionCount} collections</span>
            </div>

            <div className="library-playlist-grid">
              <PlaylistCard
                to="/playlists/liked"
                title="Liked Songs"
                subtitle={`${likedSongs.length} songs`}
                coverItem={{ title: 'Liked Songs', artist: { username: 'Liked Songs' } }}
                onPlay={() => handlePlayPlaylist({ songs: likedSongs })}
              />
              {sortedPlaylists.map((playlist) => (
                <PlaylistCard
                  key={playlist._id}
                  to={`/playlists/${playlist._id}`}
                  title={playlist.title || 'Untitled playlist'}
                  subtitle={`${playlist.songs?.length || 0} songs`}
                  coverItem={playlist}
                  onPlay={() => handlePlayPlaylist(playlist)}
                  onDelete={() => setDeleteConfirmPlaylistId(playlist._id)}
                  onRename={() => navigate(`/playlists/${playlist._id}`)}
                  onChangeCover={() => navigate(`/playlists/${playlist._id}`)}
                />
              ))}
            </div>

            {sortedPlaylists.length === 0 ? (
              <div className="home-empty-state">
                <p>You do not have any playlists yet. Start with a fresh collection.</p>
                <button type="button" className="btn btn-primary btn-compact" onClick={() => navigate('/library')}>Create a playlist</button>
              </div>
            ) : null}

            {deleteConfirmPlaylistId ? (() => {
              const playlist = playlists.find((entry) => entry._id === deleteConfirmPlaylistId)
              return (
                <ConfirmAction
                  open={Boolean(deleteConfirmPlaylistId)}
                  title={playlist?.title || 'Untitled playlist'}
                  onConfirm={() => handleDeletePlaylist(deleteConfirmPlaylistId)}
                  onCancel={() => setDeleteConfirmPlaylistId('')}
                  className="playlist-delete-confirm playlist-delete-confirm--inline"
                />
              )
            })() : null}
          </section>

          {canViewCatalog ? (
            <section className="card playlist-detail">
              <div className="section-heading">
                <h2>Add from your catalog</h2>
                <div className="search-field library-search-shell library-catalog-search-shell">
                  <input
                    className="input"
                    value={catalogSearchQuery}
                    onChange={(event) => setCatalogSearchQuery(event.target.value)}
                    placeholder="Search your catalog"
                  />
                  {catalogSearchQuery ? (
                    <button type="button" className="library-search-clear" onClick={() => setCatalogSearchQuery('')} aria-label="Clear catalog search">
                      ×
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="track-list">
                {filteredCatalog.length ? filteredCatalog.map((song, index) => {
                  const songId = getTrackId(song)
                  const isActive = isTrackActive(song, currentTrack)
                  const isActivePlaying = isActive && isPlaying
                  return (
                    <TrackRow
                      key={songId || `${song?.title || 'track'}-${index}`}
                      song={song}
                      index={index}
                      isActive={isActive}
                      isActivePlaying={isActivePlaying}
                      onPlay={() => handlePlaySong(song, index)}
                      onTogglePlayback={() => {
                        if (isActivePlaying) {
                          togglePlay()
                          return
                        }
                        handlePlaySong(song, index)
                      }}
                      trailing={(
                        <div className="track-row-actions">
                          {/* single inline play control + compact picker */}
                          <button type="button" className="btn btn-ghost btn-compact" onClick={(event) => { event.stopPropagation(); if (isActivePlaying) { togglePlay(); } else { handlePlaySong(song, index) } }} aria-label={isActivePlaying ? `Pause ${song?.title || 'track'}` : `Play ${song?.title || 'track'}`}>
                            {isActivePlaying ? 'Pause' : 'Play'}
                          </button>
                          <PlaylistPicker
                            songId={songId}
                            buttonLabel="Add to playlist ▾"
                            buttonClassName="btn btn-primary btn-compact"
                            disabled={false}
                            onError={(message) => showToast({ message, tone: 'error' })}
                            onSuccess={(message) => showToast({ message, tone: 'success' })}
                          />
                        </div>
                      )}
                    />
                  )
                }) : (
                  <div className="home-empty-state">
                    <p>{songCatalog.length
                      ? 'No matching songs in your catalog.'
                      : 'Your catalog is empty right now.'}
                    </p>
                    <button type="button" className="btn btn-primary btn-compact" onClick={() => navigate('/artist')}>Add tracks in Artist Studio</button>
                  </div>
                )}
              </div>
            </section>
          ) : (
            <section className="card playlist-detail">
              <div className="section-heading">
                <h2>Catalog access</h2>
              </div>
              <div className="home-empty-state home-empty-state--artist-prompt">
                <p>Want to publish music? Request artist access to unlock your catalog workspace.</p>
                <button type="button" className="btn btn-primary btn-compact" onClick={() => navigate('/profile')}>Request artist access</button>
              </div>
            </section>
          )}
        </>
      ) : null}
    </div>
  )
}
