import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { OverflowMenu, PlaylistPicker, Skeleton } from '@/components/common'
import { Artwork } from '@/components/ui'
import { useAuthStore, usePlayerStore } from '@/store'
import useHomeData from '@/features/home/useHomeData'
import useUserActions from '@/features/user/useUserActions'
import { dispatchErrorToast, showToast } from '@/utils/toast'
import { getArtistName } from '@/domain/media'

const buildDisplay = (item) => {
  const title = item?.title || item?.name || item?.album?.name || 'Untitled'
  const subtitle = getArtistName(item) !== 'Unknown artist' ? getArtistName(item) : item?.album?.title || 'Unknown artist'
  return {
    id: item?._id || item?.id,
    title,
    subtitle,
    item,
  }
}

export default function Home() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const { currentTrack, isPlaying, playTrack, togglePlay } = usePlayerStore()
  const enqueueTrack = usePlayerStore((state) => state.enqueueTrack)
  const { playSong } = useUserActions()
  const { history, albums, trending, loading, errors, reload } = useHomeData()
  const [selectedFilter, setSelectedFilter] = useState('all')
  const [openMenuCardId, setOpenMenuCardId] = useState(null)

  // Close menu when clicking outside of cards (important for touch devices)
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openMenuCardId && !event.target.closest('.home-media-card')) {
        setOpenMenuCardId(null)
      }
    }
    if (openMenuCardId) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
    return () => {}
  }, [openMenuCardId])

  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    const userName = user?.name || user?.username || 'there'
    if (hour < 12) return `Good morning, ${userName}`
    if (hour < 18) return `Good afternoon, ${userName}`
    return `Good evening, ${userName}`
  }, [user?.name, user?.username])

  const visibleHistory = useMemo(() => {
    if (selectedFilter === 'podcasts') {
      return history.filter((item) => item?.type === 'podcast')
    }
    if (selectedFilter === 'music') {
      return history.filter((item) => item?.type !== 'podcast')
    }
    return history
  }, [history, selectedFilter])

  const isTrackActive = (item) => {
    const songId = item?._id || item?.id
    return songId && currentTrack?._id === songId
  }

  const isTrackActivePlaying = (item) => isTrackActive(item) && isPlaying

  const handlePlay = async (item) => {
    const songId = item?._id || item?.id
    if (!songId) return

    if (isTrackActivePlaying(item)) {
      togglePlay()
      return
    }

    try {
      await playSong(songId)
      playTrack(item, [item], 0)
    } catch (error) {
      dispatchErrorToast(error)
    }
  }

  const handleQueue = async (item) => {
    const songId = item?._id || item?.id
    if (!songId) return

    try {
      await enqueueTrack(songId)
      showToast({ message: 'Added to queue.', tone: 'success' })
    } catch (error) {
      const message = error?.response?.data?.message || 'Unable to add to queue.'
      showToast({ message, tone: 'error' })
    }
  }

  const handleOpenAlbum = (album) => {
    const albumId = album?._id || album?.id || album?.albumId
    if (!albumId) return
    navigate(`/albums/${encodeURIComponent(albumId)}`)
  }

  const handleCardClick = (cardId, event) => {
    if (event?.target?.closest('.overflow-menu-shell, .overflow-menu-button, .overflow-menu-panel, .overflow-menu-option')) {
      return
    }
    setOpenMenuCardId((current) => (current === cardId ? null : cardId))
  }

  return (
    <div className="content-shell home-shell">
      <section className="hero-panel home-hero">
        <div>
          <div className="home-hero-topline">
            <span className="section-kicker">{greeting}</span>
          </div>
          <h1>Find your next favorite track.</h1>
          <p>Fresh picks, recent listens, and new favorites in one seamless home view.</p>
        </div>
      </section>

      <section className="home-section">
        <div className="home-chip-row" role="tablist" aria-label="Browse filters">
          {['all', 'music', 'podcasts'].map((filter) => (
            <button
              key={filter}
              type="button"
              className={`home-chip${selectedFilter === filter ? ' is-active' : ''}`}
              onClick={() => setSelectedFilter(filter)}
              aria-selected={selectedFilter === filter}
            >
              {filter === 'all' ? 'All' : filter === 'music' ? 'Music' : 'Podcasts'}
            </button>
          ))}
        </div>
        <p className="home-chip-note">Use the filter chips to refine your recent listening and discover matching tracks.</p>
      </section>

      <section className="home-section">
        <div className="section-heading">
          <h2>Recently played</h2>
          <span className="section-link">Replay</span>
        </div>
        {loading.history ? (
          <div className="home-card-row">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="home-media-card home-media-card--skeleton">
                <Skeleton className="home-skeleton-card" lines={3} />
              </div>
            ))}
          </div>
        ) : errors.history ? (
          <div className="error-banner">
            <span>{errors.history}</span>
            <button type="button" className="btn btn-ghost btn-compact" onClick={reload}>Retry</button>
          </div>
        ) : !visibleHistory.length ? (
          <div className="home-empty-state">
            <p>Play something to see it here</p>
          </div>
        ) : (
          <div className="home-card-row">
            {visibleHistory.slice(0, 6).map((item) => {
              const display = buildDisplay(item)
              const cardId = display.id || `${item?.title}-${item?.artist}`
              return (
                <div
                  className={`home-media-card${openMenuCardId === cardId ? ' menu-open' : ''}${isTrackActive(item) ? ' is-playing' : ''}`}
                  key={cardId}
                  onClick={(event) => handleCardClick(cardId, event)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') setOpenMenuCardId(null)
                  }}
                >
                  <button type="button" className="home-media-card-main" onClick={(e) => {
                    e.stopPropagation()
                    handlePlay(item)
                  }}>
                    <Artwork item={item} size="large" className="home-media-art" />
                    <span
                      className="playlist-card-action"
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        handlePlay(item)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          event.stopPropagation()
                          handlePlay(item)
                        }
                      }}
                    >
                      {isTrackActivePlaying(item) ? '⏸' : '▶'}
                    </span>
                    <div className="home-media-copy">
                      <strong title={display.title}>{display.title}</strong>
                      <span>{display.subtitle}</span>
                    </div>
                  </button>
                  <div className="home-media-card-menu-wrap">
                    <OverflowMenu onOpenChange={(open) => setOpenMenuCardId((current) => open ? cardId : current === cardId ? null : current)}>
                      <button type="button" className="overflow-menu-option" onClick={() => handleQueue(item)}>Add to queue</button>
                      <PlaylistPicker
                        songId={item?._id || item?.id}
                        buttonLabel="Add to playlist"
                        buttonClassName="overflow-menu-option overflow-menu-picker"
                        disabled={!item?._id && !item?.id}
                        onSuccess={() => showToast({ message: 'Added to playlist.', tone: 'success' })}
                        onError={(message) => showToast({ message: message || 'Unable to add this song to the playlist.', tone: 'error' })}
                      />
                    </OverflowMenu>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="home-section">
        <div className="section-heading">
          <h2>Made for you</h2>
          <span className="section-link">Fresh picks</span>
        </div>
        {loading.albums ? (
          <div className="home-card-row">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="home-media-card home-media-card--skeleton">
                <Skeleton className="home-skeleton-card" lines={3} />
              </div>
            ))}
          </div>
        ) : errors.albums ? (
          <div className="error-banner">
            <span>{errors.albums}</span>
            <button type="button" className="btn btn-ghost btn-compact" onClick={reload}>Retry</button>
          </div>
        ) : !albums.length ? (
          <div className="home-empty-state">
            <p>No albums available yet.</p>
          </div>
        ) : (
          <div className="home-card-row">
            {albums.slice(0, 6).map((album) => {
              const display = buildDisplay(album)
              const cardId = display.id || `${display.title}-${display.subtitle}`
              return (
                <div
                  className={`home-media-card${openMenuCardId === cardId ? ' menu-open' : ''}${isTrackActive(album) ? ' is-playing' : ''}`}
                  key={cardId}
                  onClick={(event) => handleCardClick(cardId, event)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') setOpenMenuCardId(null)
                  }}
                >
                  <button type="button" className="home-media-card-main" onClick={(e) => {
                    e.stopPropagation()
                    handleOpenAlbum(album)
                  }}>
                    <Artwork item={album} size="large" className="home-media-art" />
                    <span
                      className="playlist-card-action"
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        handleOpenAlbum(album)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          event.stopPropagation()
                          handleOpenAlbum(album)
                        }
                      }}
                    >
                      ▶
                    </span>
                    <div className="home-media-copy">
                      <strong>{display.title}</strong>
                      <span>{display.subtitle}</span>
                    </div>
                  </button>
                  <div className="home-media-card-menu-wrap">
                    <OverflowMenu onOpenChange={(open) => setOpenMenuCardId((current) => open ? cardId : current === cardId ? null : current)}>
                      <button type="button" className="overflow-menu-option" onClick={() => handleOpenAlbum(album)}>Open</button>
                    </OverflowMenu>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="home-section">
        <div className="section-heading">
          <h2>Trending tracks</h2>
          <span className="section-link">Popular</span>
        </div>
        {loading.trending ? (
          <div className="home-card-row">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="home-media-card home-media-card--skeleton">
                <Skeleton className="home-skeleton-card" lines={3} />
              </div>
            ))}
          </div>
        ) : errors.trending ? (
          <div className="error-banner">
            <span>{errors.trending}</span>
            <button type="button" className="btn btn-ghost btn-compact" onClick={reload}>Retry</button>
          </div>
        ) : !trending.length ? (
          <div className="home-empty-state">
            <p>No trending tracks available right now.</p>
          </div>
        ) : (
          <div className="home-card-row">
            {trending.slice(0, 6).map((track) => {
              const display = buildDisplay(track)
              const cardId = display.id || `${display.title}-${display.subtitle}`
              const trackId = track?._id || track?.id
              return (
                <div
                  className={`home-media-card${openMenuCardId === cardId ? ' menu-open' : ''}${isTrackActive(track) ? ' is-playing' : ''}`}
                  key={cardId}
                  onClick={(event) => handleCardClick(cardId, event)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') setOpenMenuCardId(null)
                  }}
                >
                  <button type="button" className="home-media-card-main" onClick={(e) => {
                    e.stopPropagation()
                    handlePlay(track)
                  }}>
                    <Artwork item={track} size="large" className="home-media-art" />
                    <span className="media-card-action playlist-card-action"
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        handlePlay(track)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          event.stopPropagation()
                          handlePlay(track)
                        }
                      }}
                    >
                      {isTrackActivePlaying(track) ? '⏸' : '▶'}
                    </span>
                    <div className="home-media-copy">
                      <strong>{display.title}</strong>
                      <span>{display.subtitle}</span>
                    </div>
                  </button>
                  <div className="home-media-card-menu-wrap">
                    <OverflowMenu onOpenChange={(currentOpen) => setOpenMenuCardId((current) => currentOpen ? cardId : current === cardId ? null : current)}>
                      <button type="button" className="overflow-menu-option" onClick={() => handleQueue(track)}>Add to queue</button>
                      <PlaylistPicker
                        songId={trackId}
                        buttonLabel="Add to playlist"
                        buttonClassName="overflow-menu-option overflow-menu-picker"
                        disabled={!trackId}
                        onSuccess={() => showToast({ message: 'Added to playlist.', tone: 'success' })}
                        onError={(message) => showToast({ message: message || 'Unable to add this song to the playlist.', tone: 'error' })}
                      />
                    </OverflowMenu>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
