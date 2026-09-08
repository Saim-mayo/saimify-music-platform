import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { usePlayerStore } from '@/store'
import { showToast, dispatchErrorToast } from '@/utils/toast'
import { Artwork, Icon } from '@/components/ui'
import useSongActions from '@/features/user/useSongActions'
import { formatDuration, formatRemainingTime } from '@/utils/formatDuration'
import { getArtistName } from '@/domain/media'

export default function BottomPlayer() {
  const audioRef = useRef(null)
  const prevTrackIdRef = useRef(null)
  const location = useLocation()
  const navigate = useNavigate()
  const [isSeeking, setIsSeeking] = useState(false)
  const [seekPosition, setSeekPosition] = useState(0)
  const {
    currentTrack, isPlaying, isQueueOpen, queue, progress, duration,
    repeatEnabled, shuffleEnabled, volume, muted,
    togglePlay, toggleRepeat, toggleShuffle, refreshQueue,
    setDuration, setProgress, seekTo, skipBy, skipNext, skipPrevious,
    registerAudioElement, setVolume, toggleMute,
  } = usePlayerStore()
  const { liked: isLiked, handleLikeToggle } = useSongActions(currentTrack)

  // The audio element's own duration can be briefly 0/NaN/Infinity while
  // chunked/range streaming is still resolving metadata. Fall back to the
  // track's known duration so the bar and time labels don't get stuck.
  const safeDuration = Number.isFinite(duration) && duration > 0
    ? duration
    : (Number(currentTrack?.duration) || 0)

  // IMPORTANT: this component returns `null` (renders no DOM at all) until
  // `currentTrack` is set — see the early return below. That means on first
  // load there is no <audio> element in the DOM yet. A `useEffect` keyed on
  // `registerAudioElement` only runs ONCE on mount, and back then there was
  // nothing to register — the store's `audioElement` was permanently stuck
  // at null even after a track started playing and the tag finally
  // appeared. That's why duration/progress never updated and the seek bar
  // stayed dead. A callback ref fixes this because React invokes it exactly
  // when the DOM node is created (or torn down), whenever that happens.
  const setAudioRef = useCallback((el) => {
    if (el) {
      el.crossOrigin = 'use-credentials'
    }
    audioRef.current = el
    registerAudioElement(el)
  }, [registerAudioElement])

  useEffect(() => {
    refreshQueue().catch(() => {})
  }, [refreshQueue])

  useEffect(() => {
    const trackId = currentTrack?._id
    
    // Only reset when track ID actually changes (new track), not just when object reference changes
    if (trackId && trackId !== prevTrackIdRef.current) {
      prevTrackIdRef.current = trackId
      setProgress(0)
      setDuration(0)
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      }
    } else if (!trackId) {
      // Reset when no track
      prevTrackIdRef.current = null
      if (audioRef.current) {
        audioRef.current.currentTime = 0
      }
    }
  }, [currentTrack?._id, setDuration, setProgress])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.crossOrigin = 'use-credentials'
    if (!currentTrack?.streamUrl) {
      audio.pause()
      return
    }
  }, [currentTrack?.streamUrl])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentTrack?.streamUrl) return

    if (isPlaying) {
      // Just call play - don't check audio.src since it might be empty initially
      audio.play().catch(err => {
        console.error('[BottomPlayer] Play error:', err)
      })
    } else {
      audio.pause()
    }
  }, [isPlaying, currentTrack?.streamUrl])

  // Playback event handling (timeupdate/loadedmetadata/ended) is centralized
  // in the player store via registerAudioElement. Seeking is handled below
  // through a single set of pointer handlers on the range input — do not
  // add duplicate mouseup/touchend handlers here. Previously onPointerUp,
  // onMouseUp, and onTouchEnd were ALL bound to the same commit handler, so
  // a single drag release fired seekTo() 2-3 times back-to-back, racing
  // against itself and making the bar feel unresponsive/broken.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = volume
    audio.muted = muted
  }, [volume, muted])

  const isFullPlayer = location.pathname.startsWith('/player')
  if (!currentTrack) return null

  const handleSeekStart = () => {
    usePlayerStore.getState().setUserSeeking(true)
    setSeekPosition(progress)
    setIsSeeking(true)
  }

  const handleSeekCommit = (event) => {
    if (!isSeeking) return
    const nextValue = Number(event.target.value)
    usePlayerStore.getState().setUserSeeking(false)
    setSeekPosition(nextValue)
    seekTo(nextValue)
    setIsSeeking(false)
  }

  const handleProgressChange = (event) => {
    const nextValue = Number(event.target.value)
    // While dragging, only update local UI state. Commit to the store on release.
    setSeekPosition(nextValue)
  }

  const handleSkip = (seconds) => {
    skipBy(seconds)
  }

  const handleExpandPlayer = () => {
    navigate('/player', { state: { from: location.pathname } })
  }

  const handleAddToLibrary = async () => {
    if (!currentTrack?._id) return
    try {
      await handleLikeToggle()
      if (isLiked) {
        showToast({ message: `Removed "${currentTrack.title}" from library`, tone: 'success' })
      } else {
        showToast({ message: `Added "${currentTrack.title}" to library`, tone: 'success' })
      }
    } catch (error) {
      dispatchErrorToast(error, isLiked ? 'Failed to remove track from library' : 'Failed to add track to library')
    }
  }

  const artistName = getArtistName(currentTrack)

  if (isFullPlayer) {
    // keep the audio element mounted so playback isn't interrupted when opening full player
    return (
      <div style={{ display: 'none' }} aria-hidden="true">
        <audio ref={setAudioRef} preload="auto" crossOrigin="use-credentials" />
      </div>
    )
  }

  return (
    <div className="player-bar">
      <audio ref={setAudioRef} preload="auto" crossOrigin="use-credentials" />
      <Link className="player-track-info" to="/player" state={{ from: location.pathname }}>
        <Artwork item={currentTrack} size="small" />
        <span className="player-track-copy">
          <strong>{currentTrack.title}</strong>
          <span>{artistName}</span>
        </span>
      </Link>
      <div className="player-center">
        <div className="player-controls">
          <button type="button" className="btn btn-tertiary btn-skip-back" onClick={() => handleSkip(-10)} aria-label="Rewind 10 seconds" title="Back 10s">-10</button>
          <button type="button" className="btn btn-secondary btn-prev" onClick={skipPrevious} aria-label="Previous track" title="Previous track"><Icon name="previous" size={18} strokeWidth={1.8} /></button>
          <button type="button" className="btn btn-primary btn-play" onClick={togglePlay} aria-label={isPlaying ? 'Pause track' : 'Play track'} title={isPlaying ? 'Pause track' : 'Play track'}>{isPlaying ? <Icon name="pause" size={18} strokeWidth={1.8} /> : <Icon name="play" size={18} strokeWidth={1.8} style={{ transform: 'translateX(1px)' }} />}</button>
          <button type="button" className="btn btn-secondary btn-next" onClick={skipNext} aria-label="Next track" title="Next track"><Icon name="next" size={18} strokeWidth={1.8} /></button>
          <button type="button" className="btn btn-tertiary btn-skip-forward" onClick={() => handleSkip(30)} aria-label="Skip forward 30 seconds" title="Forward 30s">+30</button>
          <button type="button" className={`btn btn-secondary btn-shuffle${shuffleEnabled ? ' is-active' : ''}`} onClick={toggleShuffle} aria-label={shuffleEnabled ? 'Disable shuffle' : 'Enable shuffle'} title={shuffleEnabled ? 'Disable shuffle' : 'Enable shuffle'}><Icon name="shuffle" size={18} strokeWidth={1.8} /></button>
          <button type="button" className={`btn btn-tertiary btn-repeat${repeatEnabled ? ' active-control' : ''}`} onClick={toggleRepeat} aria-label="Toggle repeat" title="Toggle repeat"><Icon name="repeat" size={18} strokeWidth={1.8} /></button>
          <button
            type="button"
            className={`btn btn-tertiary btn-add${isLiked ? ' is-active' : ''}`}
            onClick={handleAddToLibrary}
            aria-label={isLiked ? 'Remove from library' : 'Add to library'}
            title={isLiked ? 'Remove from library' : 'Add to library'}
          >
            {isLiked ? '♥' : '♡'}
          </button>
          <button type="button" className="btn btn-tertiary btn-expand" onClick={handleExpandPlayer} aria-label="Expand player" title="Expand player"><Icon name="expand" size={18} strokeWidth={1.8} /></button>
        </div>
        <div className="player-progress">
          <span className="time-pill">{formatDuration(isSeeking ? seekPosition : progress)}</span>
          <input
            type="range"
            min="0"
            max={safeDuration || 0}
            step="1"
            value={isSeeking ? Math.min(seekPosition, safeDuration || 0) : safeDuration > 0 ? Math.min(progress, safeDuration) : 0}
            disabled={safeDuration <= 0}
            onPointerDown={handleSeekStart}
            onChange={handleProgressChange}
            onPointerUp={handleSeekCommit}
            aria-label="Seek"
          />
          <span className="time-pill">-{formatRemainingTime(safeDuration, isSeeking ? seekPosition : progress)}</span>
        </div>
      </div>
      <div className="player-volume-controls">
        <button type="button" className="btn btn-ghost" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>{muted || volume === 0 ? '🔇' : '🔉'}</button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={muted ? 0 : volume}
          onChange={(event) => setVolume(Number(event.target.value))}
          aria-label="Volume"
        />
      </div>
      {isQueueOpen ? (
        <div className="queue-drawer">
          {queue.length ? queue.map((track, index) => (
            <div key={track._id || `${track.title}-${index}`} className={`queue-item${track._id === currentTrack?._id ? ' is-active' : ''}`}>
              <Artwork item={track} size="small" className="queue-item-artwork" />
              <div className="queue-item-copy">
                <strong>{track.title || 'Untitled track'}</strong>
                <small>{getArtistName(track)}</small>
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
    </div>
  )
}