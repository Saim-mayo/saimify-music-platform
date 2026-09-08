import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { PlaylistPicker, Toast } from '@/components/common'
import { Artwork, Icon } from '@/components/ui'
import { usePlayerStore } from '@/store'
import { beginPlayerSeek, endPlayerSeek } from '@/utils/playerSeek'
import useUserActions from '@/features/user/useUserActions'
import { formatDuration, formatRemainingTime } from '@/utils/formatDuration'
import { getArtistName as getTrackArtistName } from '@/domain/media'

const getArtistId = (track) => {
  if (!track) return null
  if (typeof track.artist === 'object' && track.artist) {
    return track.artist._id || track.artist.id || null
  }
  if (typeof track.artist === 'string') return track.artist
  return track.artistId || null
}

const getArtistName = (track) => {
  return getTrackArtistName(track)
}

const getArtistInitials = (track) => {
  const name = getArtistName(track)
  const trimmed = String(name).trim()
  if (!trimmed) return 'P'
  const source = trimmed.includes('@') ? trimmed.split('@')[0] : trimmed
  const parts = source.split(/\s+|\.|-|_/).filter(Boolean)
  if (!parts.length) return 'P'
  const initials = parts.slice(0, 2).map((word) => word[0]?.toUpperCase() || '')
  return initials.join('') || 'P'
}

export default function MusicPlayer() {
  const location = useLocation()
  const navigate = useNavigate()
  const {
    currentTrack,
    isPlaying,
    progress,
    duration,
    isQueueOpen,
    queue,
    togglePlay,
    seekTo,
    toggleShuffle,
    shuffleEnabled,
    toggleRepeat,
    repeatEnabled,
    playTrack,
    playbackContext,
    skipBy,
    skipNext,
    skipPrevious,
    openQueue,
    closeQueue,
  } = usePlayerStore()
  const { getSongLikes, likeSong, unlikeSong, downloadSong, getSongsByArtist } = useUserActions()
  const [liked, setLiked] = useState(false)
  const [isSeeking, setIsSeeking] = useState(false)
  const [seekPosition, setSeekPosition] = useState(0)
  const [loadingLike, setLoadingLike] = useState(false)
  const [artistSongs, setArtistSongs] = useState([])
  const [artistSongsLoading, setArtistSongsLoading] = useState(false)
  const [artistAvatarFailed, setArtistAvatarFailed] = useState(false)
  const [toast, setToast] = useState({ message: '', tone: 'info' })

  useEffect(() => {
    if (!currentTrack) return
    const trackId = currentTrack._id || currentTrack.id
    if (!trackId) return
    getSongLikes(trackId)
      .then((data) => {
        setLiked(Boolean(data?.hasLikes))
      })
      .catch(() => setLiked(false))
  }, [currentTrack, getSongLikes])

  useEffect(() => {
    const artistId = getArtistId(currentTrack)
    if (!artistId) {
      const resetTimer = window.setTimeout(() => setArtistSongs([]), 0)
      return () => window.clearTimeout(resetTimer)
    }

    let active = true
    const timer = window.setTimeout(() => {
      setArtistSongsLoading(true)
    }, 0)
    getSongsByArtist(artistId)
      .then((data) => {
        if (!active) return
        const songs = Array.isArray(data?.songs) ? data.songs : []
        const normalizedSongs = songs
          .filter((song) => song && (song._id || song.id))
          .map((song) => ({
            ...song,
            title: typeof song.title === 'string' && song.title.trim() ? song.title.trim() : null,
            artistName: getArtistName(song),
          }))
          .filter((song) => song.title)
        setArtistSongs(normalizedSongs)
      })
      .catch(() => {
        if (active) setArtistSongs([])
      })
      .finally(() => {
        if (active) setArtistSongsLoading(false)
      })

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [currentTrack, getSongsByArtist])

  const handleDismiss = () => {
    const previousPath = location.state?.from || '/home'
    navigate(previousPath, { replace: true })
  }

  const handleLikeToggle = async () => {
    const trackId = currentTrack?._id || currentTrack?.id
    if (!trackId) return
    setLoadingLike(true)
    const wasLiked = liked
    setLiked((value) => !value)
    try {
      if (wasLiked) {
        await unlikeSong({ songId: trackId })
      } else {
        await likeSong({ songId: trackId })
      }
    } catch {
      setLiked(wasLiked)
      setToast({ message: 'Unable to update your like right now.', tone: 'error' })
    } finally {
      setLoadingLike(false)
    }
  }

  const handleToggleQueueView = () => {
    if (isQueueOpen) {
      closeQueue()
      return
    }
    openQueue()
  }

  const handleAddToPlaylist = async (message) => {
    setToast({ message: message || 'Added to your playlist.', tone: 'success' })
  }

  const handlePlaylistError = (message) => {
    setToast({ message: message || 'Unable to add this track to a playlist.', tone: 'error' })
  }

  const handleStopPlayback = async () => {
    try {
      await usePlayerStore.getState().clearPlaybackQueue()
    } catch {
      setToast({ message: 'Unable to stop playback right now.', tone: 'error' })
    }
  }

  const handleDownload = async () => {
    const trackId = currentTrack?._id || currentTrack?.id
    if (!trackId || currentTrack?.allowDownload === false) {
      setToast({ message: 'Downloads require a Pro plan or aren\'t enabled for this track.', tone: 'error' })
      return
    }

    try {
      const blob = await downloadSong(trackId)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      const fileName = `${(currentTrack?.title || 'track').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.mp3`
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      setToast({ message: 'Download started.', tone: 'success' })
    } catch (error) {
      if (error?.response?.status === 403) {
        setToast({ message: 'Downloads require a Pro plan or aren\'t enabled for this track.', tone: 'error' })
      } else {
        setToast({ message: 'Unable to download this track right now.', tone: 'error' })
      }
    }
  }

  const onDragStart = (event) => {
    const bar = event.currentTarget
    if (!bar) return
    const rect = bar.getBoundingClientRect()
    const barDuration = Number.isFinite(duration) && duration > 0
      ? duration
      : (Number(currentTrack?.duration) || 0)
    const startX = (event.clientX || (event.touches && event.touches[0]?.clientX)) - rect.left
    const pct = Math.max(0, Math.min(1, startX / rect.width))
    const next = pct * barDuration
    beginPlayerSeek({ store: usePlayerStore.getState(), setIsSeeking })
    setSeekPosition(next)
    seekTo(next)

    const onMove = (ev) => {
      const moveX = (ev.clientX || (ev.touches && ev.touches[0]?.clientX)) - rect.left
      const movePct = Math.max(0, Math.min(1, moveX / rect.width))
      const moveNext = movePct * barDuration
      setSeekPosition(moveNext)
    }

    const onUp = (ev) => {
      const upX = (ev.clientX || (ev.changedTouches && ev.changedTouches[0]?.clientX)) - rect.left
      const upPct = Math.max(0, Math.min(1, upX / rect.width))
      const upNext = upPct * barDuration
      setSeekPosition(upNext)
      seekTo(upNext)
      endPlayerSeek({ store: usePlayerStore.getState(), setIsSeeking })
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const handleSkip = (seconds) => {
    skipBy(seconds)
  }

  const handleArtistSongSelect = (track, index) => {
    if (!track) return
    playTrack(track, artistSongs, index, { label: `More by ${getArtistName(currentTrack)}`, type: 'artist' })
  }

  const contextLabel = useMemo(() => {
    if (playbackContext?.label) return playbackContext.label
    if (currentTrack?.sourceLabel) return currentTrack.sourceLabel
    return 'Your session'
  }, [playbackContext, currentTrack?.sourceLabel])

  const artistName = getArtistName(currentTrack)
  const releaseYear = currentTrack?.createdAt ? new Date(currentTrack.createdAt).getFullYear() : null
  const releaseDate = currentTrack?.createdAt ? new Date(currentTrack.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null
  // The live <audio> duration can be briefly 0/NaN/Infinity while chunked
  // range-streaming is still resolving metadata — fall back to the track's
  // known duration so the progress bar/time labels don't appear frozen.
  const safeDuration = Number.isFinite(duration) && duration > 0
    ? duration
    : (Number(currentTrack?.duration) || 0)
  const displayDuration = safeDuration || (Number(currentTrack?.duration) || 0)
  const hasDuration = Number.isFinite(displayDuration) && displayDuration > 0
  const displayDurationLabel = hasDuration ? formatDuration(displayDuration) : null
  const remainingDurationLabel = hasDuration
    ? `-${formatRemainingTime(displayDuration, isSeeking ? seekPosition : progress)}`
    : null
  const canDownload = currentTrack?.allowDownload !== false
  const trackStatusLabel = currentTrack?.status === 'active' || currentTrack?.isVerified || currentTrack?.verified || currentTrack?.isActive
  const visualProgress = isSeeking ? seekPosition : progress
  const progressPercent = safeDuration > 0 ? Math.min(100, Math.round((visualProgress / safeDuration) * 100)) : 0

  if (!currentTrack) {
    return (
      <div className="player-page player-page--empty">
        <Link className="section-link" to="/home">Back to home</Link>
        <div className="page-state">
          <h1>Nothing playing</h1>
          <p>Choose a track to start your session.</p>
          <Link className="btn btn-primary" to="/home">Explore music</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="player-page-shell">
      <Toast message={toast.message} tone={toast.tone} onClose={() => setToast({ message: '', tone: 'info' })} />
      <div className="player-page">
        <div className="player-page-topline">
          <button type="button" className="icon-button" onClick={handleDismiss} aria-label="Close player" title="Close player">⌄</button>
          <div className="player-context">
            <span className="player-context-label">PLAYING FROM</span>
            <strong>{contextLabel}</strong>
          </div>
          <div />
        </div>

        <div className="player-hero-band">
          <div className="player-hero-cover">
            <Artwork item={currentTrack} size="large" className="player-art" />
          </div>
          <div className="player-hero-copy">
            <span className="player-hero-chip">{currentTrack?.type === 'album' ? 'Album' : 'Track'}</span>
            <h1>{currentTrack.title}</h1>
            <div className="player-hero-meta">
              <div className="player-hero-artist">
                {typeof currentTrack.artist === 'object' && currentTrack.artist?.avatar && !artistAvatarFailed ? (
                  <img src={currentTrack.artist.avatar} alt={artistName} onError={() => setArtistAvatarFailed(true)} />
                ) : (
                  <span className="player-hero-avatar-fallback">{getArtistInitials(currentTrack)}</span>
                )}
                <span>{artistName}</span>
              </div>
              {releaseYear ? (
                <>
                  <span>•</span>
                  <span>{releaseYear}</span>
                </>
              ) : null}
              {displayDurationLabel ? (
                <>
                  <span>•</span>
                  <span>{displayDurationLabel}</span>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="player-action-row">
          <button type="button" className="icon-button" onClick={skipPrevious} aria-label="Previous track" title="Previous track">⏮</button>
          <button type="button" className="icon-button" onClick={() => handleSkip(-10)} aria-label="Rewind 10 seconds" title="Back 10s">⟲10</button>
          <button type="button" className="player-main-action" onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'} title={isPlaying ? 'Pause' : 'Play'}>{isPlaying ? '❚❚' : '▶'}</button>
          <button type="button" className="icon-button" onClick={() => handleSkip(30)} aria-label="Skip forward 30 seconds" title="Forward 30s">⟳30</button>
          <button type="button" className="icon-button" onClick={skipNext} aria-label="Next track" title="Next track">⏭</button>
          <button type="button" className={`icon-button${canDownload ? '' : ' is-disabled'}`} onClick={handleDownload} aria-label="Download track" title="Download" disabled={!canDownload}>⬇</button>
          <button type="button" className={`icon-button${liked ? ' is-active' : ''}`} onClick={handleLikeToggle} disabled={loadingLike} aria-label={liked ? 'Unlike track' : 'Like track'} title={liked ? 'Unlike track' : 'Like track'}>{liked ? '♥' : '♡'}</button>
          <button type="button" className={`icon-button${shuffleEnabled ? ' is-selected' : ''}`} onClick={() => toggleShuffle()} aria-label={shuffleEnabled ? 'Disable shuffle' : 'Enable shuffle'} title={shuffleEnabled ? 'Disable shuffle' : 'Enable shuffle'}>⇄</button>
          <button type="button" className={`icon-button${repeatEnabled ? ' is-selected' : ''}`} onClick={() => toggleRepeat()} aria-label={repeatEnabled ? 'Disable repeat' : 'Enable repeat'} title={repeatEnabled ? 'Disable repeat' : 'Enable repeat'}><Icon name="repeat" size={20} /></button>
          <PlaylistPicker
            songId={currentTrack?._id || currentTrack?.id}
            buttonLabel="＋"
            buttonClassName="icon-button"
            buttonTitle="Add to playlist"
            disabled={!currentTrack?._id && !currentTrack?.id}
            onSuccess={(message) => handleAddToPlaylist(message)}
            onError={(message) => handlePlaylistError(message)}
          />
          <button type="button" className="icon-button" onClick={handleToggleQueueView} aria-label={isQueueOpen ? 'Hide queue' : 'View queue'} title={isQueueOpen ? 'Hide queue' : 'View queue'}>☰</button>
          <button type="button" className="icon-button" onClick={handleStopPlayback} aria-label="Stop playback" title="Stop playback">■</button>
        </div>

        {isQueueOpen ? (
          <div className="queue-drawer player-queue-drawer">
            {queue.length ? queue.map((track, index) => (
              <div key={track._id || `${track.title}-${index}`} className={`queue-item${track._id === currentTrack?._id ? ' is-active' : ''}`}>
                <Artwork item={track} size="small" className="queue-item-artwork" />
                <div className="queue-item-copy">
                  <strong>{track.title || 'Untitled track'}</strong>
                  <small>{track.artistName || 'Unknown artist'}</small>
                </div>
                <button
                  type="button"
                  className="icon-button queue-item-remove"
                  onClick={(event) => {
                    event.stopPropagation()
                    usePlayerStore.getState().removeFromQueue(track._id || track.id).catch(() => {})
                  }}
                  aria-label="Remove from queue"
                  title="Remove from queue"
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
            )) : <p className="subtitle">No tracks queued yet.</p>}
          </div>
        ) : null}

        <div className="player-progress-section player-progress-compact">
          <div
            className="player-progress-bar"
            aria-hidden="true"
            onPointerDown={onDragStart}
            role="button"
            tabIndex={0}
          >
            <div className="player-progress-filled" style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="player-times">
            <span>{formatDuration(isSeeking ? seekPosition : progress)}</span>
            {remainingDurationLabel ? (
              <span>{remainingDurationLabel}</span>
            ) : (
              <span className="player-time-placeholder" aria-hidden="true" />
            )}
          </div>
        </div>

        <div className="player-track-table">
          <div className="player-track-row player-track-row--header">
            <span>#</span>
            <span>Title</span>
            <span>Plays</span>
            <span>Duration</span>
          </div>
          <div className="player-track-row">
            <span>1</span>
            <div className="player-track-title">
              <strong>{currentTrack.title}</strong>
              <span>{artistName}</span>
            </div>
            <span>{currentTrack.playCount || 0}</span>
            <div className="player-track-status">
              {trackStatusLabel ? <span className="player-track-badge">✓</span> : null}
              <span>{displayDurationLabel || '—'}</span>
            </div>
          </div>
        </div>

        <div className="player-meta-block">
          {releaseDate ? (
            <div>
              <span className="player-meta-label">Release date</span>
              <strong>{releaseDate}</strong>
            </div>
          ) : null}
          {(currentTrack?.label || currentTrack?.copyright) ? (
            <div>
              <span className="player-meta-label">Label</span>
              <strong>{currentTrack.label || currentTrack.copyright}</strong>
            </div>
          ) : null}
        </div>

        <div className="player-artist-row">
          <div className="player-artist-row-header">
            <h2>More by {artistName}</h2>
            <span>{artistSongsLoading ? 'Loading…' : `${artistSongs.length} track${artistSongs.length === 1 ? '' : 's'}`}</span>
          </div>
          <div className="player-artist-scroll">
            {artistSongs.length ? artistSongs.map((song, index) => (
              <button key={song._id || song.id} type="button" className="player-artist-card" onClick={() => handleArtistSongSelect(song, index)}>
                <Artwork item={song} size="small" className="player-artist-card-art" />
                <strong>{song.title}</strong>
              </button>
            )) : (
              <div className="player-artist-empty">No other tracks available right now.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}