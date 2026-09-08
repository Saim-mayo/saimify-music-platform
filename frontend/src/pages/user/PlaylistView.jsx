import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PlaylistHero, TrackRow } from '@/components/ui'
import { ConfirmAction, QueueButton, Skeleton } from '@/components/common'
import { useAuthStore, usePlayerStore } from '@/store'
import { dispatchErrorToast } from '@/utils/toast'
import { usePlaylistData } from '@/features/user/usePlaylistData'
import { isArtistApproved } from '@/utils/authValidation'
import { isTrackActive } from '@/domain/media/playback'

export default function PlaylistView() {
  const { playlistId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const userIsArtist = isArtistApproved(user)
  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayerStore()
  const { playlist, likedSongs, loading, error, setError, removeSong, toggleLike, rename, changeCover, removePlaylist } = usePlaylistData(playlistId, user)
  const likedTrackIds = useMemo(() => new Set((likedSongs || []).map((song) => song?._id || song?.id).filter(Boolean)), [likedSongs])
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [songPage, setSongPage] = useState(1)
  const SONGS_PER_PAGE = 20

  const isLikedPlaylist = playlistId === 'liked'


  const allSongs = useMemo(() => Array.isArray(playlist?.songs) ? playlist.songs : [], [playlist])
  const totalSongs = allSongs.length
  const totalPages = Math.ceil(totalSongs / SONGS_PER_PAGE)
  const playlistSongs = useMemo(() => {
    const start = (songPage - 1) * SONGS_PER_PAGE
    return allSongs.slice(start, start + SONGS_PER_PAGE)
  }, [allSongs, songPage])

  const getTrackId = (song) => song?._id || song?.id
  const handlePlayPlaylist = async () => {
    if (!allSongs.length) return
    const firstSong = allSongs[0]
    try {
      await playTrack(firstSong, allSongs, 0)
    } catch (error) {
      dispatchErrorToast(error)
    }
  }

  const handlePlaySong = async (song, index) => {
    if (!song) return
    const actualIndex = ((songPage - 1) * SONGS_PER_PAGE) + index
    try {
      await playTrack(song, allSongs, actualIndex)
    } catch (error) {
      dispatchErrorToast(error)
    }
  }

  const handleRemoveSong = async (songId) => {
    if (!playlist || isLikedPlaylist) return
    try {
      await removeSong(songId)
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to remove track from playlist.')
    }
  }

  const handleLikeToggle = async (song) => {
    const songId = getTrackId(song)
    if (!songId) return
    try {
      await toggleLike(song)
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to update liked status.')
    }
  }

  const handleRename = async (newTitle) => {
    if (!playlist || isLikedPlaylist || !newTitle.trim()) return
    try {
      await rename(newTitle.trim())
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to rename playlist.')
    }
  }

  const handleConfirmDelete = () => {
    if (!playlist || isLikedPlaylist) return
    setDeleteConfirm((current) => !current)
  }

  const handleDeletePlaylist = async () => {
    if (!playlist || isLikedPlaylist) return
    try {
      await removePlaylist()
      setDeleteConfirm(false)
      setError('')
      navigate('/library')
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to delete playlist.')
    }
  }

  const handleChangeCover = async (file) => {
    if (!playlist || isLikedPlaylist || !file) return
    try {
      await changeCover(file)
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to update playlist cover.')
    }
  }

  const ownerLabel = isLikedPlaylist ? user?.username || 'You' : playlist?.owner?.username || 'You'

  if (loading) {
    return (
      <div className="content-shell playlist-shell">
        <div className="card playlist-hero playlist-hero--loading">
          <Skeleton lines={3} />
        </div>
        <section className="card track-list">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} lines={2} />
          ))}
        </section>
      </div>
    )
  }

  if (error) {
    return (
      <div className="content-shell playlist-shell">
        <div className="error-banner">
          <span>{error}</span>
          <div className="row-actions">
            <button type="button" className="btn btn-ghost btn-compact" onClick={() => navigate('/library')}>Back to Library</button>
          </div>
        </div>
      </div>
    )
  }

  if (!playlist || (!isLikedPlaylist && !playlist._id)) {
    return (
      <div className="content-shell playlist-shell">
        <div className="error-banner">
          <span>Playlist not found.</span>
          <button type="button" className="btn btn-primary btn-compact" onClick={() => navigate('/library')}>Back to Library</button>
        </div>
      </div>
    )
  }

  return (
    <div className="content-shell playlist-shell">
      <PlaylistHero
        playlist={playlist}
        isLiked={isLikedPlaylist}
        onPlay={handlePlayPlaylist}
        onShuffle={() => handlePlayPlaylist()}
        onChangeCover={isLikedPlaylist ? null : handleChangeCover}
        onRename={isLikedPlaylist ? null : handleRename}
        onDelete={isLikedPlaylist ? null : handleConfirmDelete}
        ownerLabel={ownerLabel}
      />

      <ConfirmAction
        open={deleteConfirm && !isLikedPlaylist}
        title={playlist?.title || 'Untitled playlist'}
        onConfirm={handleDeletePlaylist}
        onCancel={() => setDeleteConfirm(false)}
        className="card playlist-delete-confirm-panel"
      />

      <section className="card track-list">
        <div className="section-heading">
          <h2>Tracks</h2>
          <div className="row-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="subtitle">{totalSongs ? `${totalSongs} songs total` : 'This playlist has no tracks yet.'}</span>
            {totalPages > 1 ? (
              <div className="pagination-controls" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button type="button" className="btn btn-ghost btn-compact" disabled={songPage <= 1} onClick={() => setSongPage((p) => Math.max(1, p - 1))}>← Previous</button>
                <span className="subtitle" style={{ minWidth: '80px', textAlign: 'center' }}>Page {songPage} of {totalPages}</span>
                <button type="button" className="btn btn-ghost btn-compact" disabled={songPage >= totalPages} onClick={() => setSongPage((p) => Math.min(totalPages, p + 1))}>Next →</button>
              </div>
            ) : null}
          </div>
        </div>
        {playlistSongs.length ? playlistSongs.map((song, index) => {
          const trackId = getTrackId(song)
          const liked = likedTrackIds.has(trackId)
          const isActive = isTrackActive(song, currentTrack)
          const isActivePlaying = isActive && isPlaying
          return (
            <TrackRow
              key={trackId || `${song?.title || 'track'}-${index}`}
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
                  <button type="button" className="icon-button" onClick={(event) => { event.stopPropagation(); handleLikeToggle(song) }} aria-label={liked ? 'Unlike track' : 'Like track'} title={liked ? 'Tap to unlike' : 'Tap to like'}>
                    {liked ? '♥' : '♡'}
                  </button>
                  <QueueButton songId={trackId} className="btn btn-ghost btn-compact" title="Add this track to the queue">＋</QueueButton>
                  {!isLikedPlaylist ? (
                    <button type="button" className="btn btn-ghost btn-compact" onClick={(event) => { event.stopPropagation(); handleRemoveSong(trackId) }}>
                      Remove
                    </button>
                  ) : null}
                </div>
              )}
            />
          )
        }) : (
          <div className="home-empty-state">
            <p>{isLikedPlaylist ? 'You have not liked any songs yet.' : 'This playlist is empty. Add songs from the library or your catalog to get started.'}</p>
            {!isLikedPlaylist ? (
              <div className="home-empty-actions">
                {userIsArtist ? (
                  <button type="button" className="btn btn-primary btn-compact" onClick={() => navigate('/artist')}>Add tracks in Artist Studio</button>
                ) : (
                  <button type="button" className="btn btn-primary btn-compact" onClick={() => navigate('/search')}>Browse music to add songs</button>
                )}
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  )
}
