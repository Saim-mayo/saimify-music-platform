import { useCallback, useEffect, useRef, useState } from 'react'
import { PlaylistPicker, QueueButton, SongRow } from '@/components/common'
import { Artwork } from '@/components/ui'
import { usePlayerStore } from '@/store'
import { showToast } from '@/utils/toast'
import { useLocation, useNavigate } from 'react-router-dom'
import { SEARCH_FOCUS_EVENT, SEARCH_FOCUS_STORAGE_KEY } from '@/store'
import { runtime } from '@/config/runtime'
import useDebouncedValue from '@/hooks/useDebouncedValue'
import useLocalStorageState from '@/hooks/useLocalStorageState'
import { useSearchData } from '@/features/user/useSearchData'
import { getArtistName } from '@/domain/media'

const genreCategories = [
  { label: 'Pop', mood: 'Bright, familiar hooks', icon: '✦', accent: '#ff6b81', available: true },
  { label: 'Hip-Hop', mood: 'Beats and bold flow', icon: '◉', accent: '#7c90ff', available: true },
  { label: 'Rock', mood: 'Guitars and energy', icon: '⌁', accent: '#ff8a3d', available: true },
  { label: 'Electronic', mood: 'Synths and movement', icon: '⌬', accent: '#4fd7c7', available: true },
  { label: 'R&B', mood: 'Smooth, soulful vocals', icon: '♡', accent: '#ffd166', available: true },
  { label: 'Indie', mood: 'Fresh, left-of-center', icon: '✧', accent: '#b0c4ff', available: true },
  { label: 'Classical', mood: 'Orchestral and composed', icon: '♬', accent: '#a8cf4f', available: true },
  { label: 'Jazz', mood: 'Cool improvisation', icon: '◒', accent: '#b56cff', available: true },
  { label: 'Folk', mood: 'Warm acoustic stories', icon: '⌂', accent: '#ffd58c', available: true },
  { label: 'Other', mood: 'Something unexpected', icon: '◇', accent: '#999', available: true },
]

const TABS = [
  { key: 'songs', label: 'Songs' },
  { key: 'artists', label: 'Artists' },
]

export default function Search() {
  const location = useLocation()
  const navigate = useNavigate()
  const heroInputRef = useRef(null)
  const mountedRef = useRef(false)
  const [q, setQ] = useState('')
  const [selectedGenre, setSelectedGenre] = useState('')
  const debouncedQuery = useDebouncedValue(q.trim(), runtime.searchDebounceMs)
  const [activeTab, setActiveTab] = useState('songs')
  const { playTrack } = usePlayerStore()
  const [recentSearches, setRecentSearches] = useLocalStorageState('recentSearches', [])
  const [songPage, setSongPage] = useState(1)
  const [searchRetryKey, setSearchRetryKey] = useState(0)
  const SONGS_PER_PAGE = 30
  const recordRecentSearch = useCallback((query) => {
    setRecentSearches((previous) => {
      const next = [query, ...previous.filter((item) => item.toLowerCase() !== query.toLowerCase())]
      return next.slice(0, runtime.maxRecentSearches)
    })
  }, [setRecentSearches])
  const {
    songs,
    artists,
    loading,
    error,
    trending,
    trendingLoading,
    trendingError,
    reloadTrending,
    setSongs,
    setArtists,
    setError,
    setLoading,
    recordPlay
  } = useSearchData(debouncedQuery, selectedGenre, searchRetryKey, recordRecentSearch)

  useEffect(() => {
    const nextQuery = new URLSearchParams(location.search).get('q') || ''
    const frame = window.requestAnimationFrame(() => {
      setQ((current) => (current === nextQuery ? current : nextQuery))
    })

    return () => window.cancelAnimationFrame(frame)
  }, [location.search])

  const focusHeroInput = () => {
    if (!heroInputRef.current) return
    const input = heroInputRef.current
    const frame = window.requestAnimationFrame(() => {
      input.focus()
      input.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    return () => window.cancelAnimationFrame(frame)
  }

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    const onSearchFocus = () => {
      if (location.pathname === '/search') {
        focusHeroInput()
      }
    }

    window.addEventListener(SEARCH_FOCUS_EVENT, onSearchFocus)
    const pendingRequest = window.sessionStorage.getItem(SEARCH_FOCUS_STORAGE_KEY)
    const cleanup = () => {
      window.removeEventListener(SEARCH_FOCUS_EVENT, onSearchFocus)
    }

    if (pendingRequest) {
      const frame = window.requestAnimationFrame(() => {
        focusHeroInput()
        window.sessionStorage.removeItem(SEARCH_FOCUS_STORAGE_KEY)
      })
      return () => {
        cleanup()
        window.cancelAnimationFrame(frame)
      }
    }

    return cleanup
  }, [location.pathname])

  const trimmedQuery = q.trim()
  const songCount = songs.length
  const artistCount = artists.length
  const showEmptyState = !loading && !error && trimmedQuery && !songCount && !artistCount
  const showDiscovery = !trimmedQuery

  const handleSearchSelect = (value, genre = '') => {
    const sanitizedValue = value.trim()
    setQ(sanitizedValue)
    setSelectedGenre(genre)
    setActiveTab('songs')
    setSongPage(1)
    const nextPath = sanitizedValue ? `/search?q=${encodeURIComponent(sanitizedValue)}` : '/search'
    navigate(nextPath, { replace: true })
  }

  const handleQueryChange = (event) => {
    const nextValue = event.target.value
    setQ(nextValue)
    setSelectedGenre('')
    setActiveTab('songs')
    setSongPage(1)
  }

  const handleClearSearch = () => {
    setQ('')
    setSelectedGenre('')
    setActiveTab('songs')
    setSongPage(1)
    setSongs([])
    setArtists([])
    setError('')
    setLoading(false)
    navigate('/search', { replace: true })
  }

  const handlePlayItem = async (item) => {
    if (!item) return
    const songId = item?._id || item?.id
    if (!songId) return

    try {
      await recordPlay(songId)
      playTrack(item, [item], 0)
    } catch (error) {
      console.error(error)
    }
  }

  const handleAddToPlaylist = (message) => {
    showToast({ message: message || 'Added to playlist.', tone: 'success' })
  }

  const handlePlaylistError = (message) => {
    showToast({ message: message || 'Unable to add this song to the playlist.', tone: 'error' })
  }

  return (
    <div className="content-shell search-shell">
      <section className="search-hero">
        <div className="search-hero-copy">
          <span className="section-kicker">Find it faster</span>
          <h1>Search</h1>
          <p className="subtitle">Discover songs, artists, albums, and playlists with a single search.</p>
        </div>

        <label className="search-box search-box--hero search-box--wide">
          <span aria-hidden="true">⌕</span>
          <input ref={heroInputRef} value={q} onChange={handleQueryChange} placeholder="What do you want to listen to?" aria-label="Search songs and artists" />
          {q ? (
            <button type="button" className="icon-button search-clear-button" aria-label="Clear search" onClick={handleClearSearch}>
              ×
            </button>
          ) : null}
        </label>

        <div className="search-pills-row">
          <div className="search-pill-group">
            {recentSearches.length ? <span className="section-kicker">Recent</span> : null}
            <div className="pill-row">
              {recentSearches.map((search) => (
                <button key={search} type="button" className="pill pill-recent" onClick={() => handleSearchSelect(search)} title={search}>
                  {search}
                </button>
              ))}
            </div>
          </div>
          <div className="search-pill-group">
            <span className="section-kicker">Quick filters</span>
            <div className="pill-row">
              {genreCategories.map((category) => (
                <button key={category.label} type="button" className="pill pill-secondary" onClick={() => handleSearchSelect(category.label, category.label)}>
                  {category.label}
                </button>
              ))}
            </div>
          </div>
          {selectedGenre ? (
            <div className="search-pill-group">
              <span className="section-kicker">Genre</span>
              <div className="pill-row">
                <button type="button" className="pill pill-primary" onClick={() => setSelectedGenre('')}>
                  {selectedGenre} ×
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {showDiscovery ? (
        <section className="search-section search-discovery">
          <div className="search-discovery-grid">
            <div className="card search-discovery-card">
              <div className="section-heading" style={{ marginBottom: 10 }}>
                <h2>Trending</h2>
                <button type="button" className="btn btn-ghost btn-compact" onClick={reloadTrending}>Refresh</button>
              </div>
              <div className="search-discovery-list">
                {trendingLoading ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="search-skeleton-card">
                      <div className="skeleton-line skeleton-line--title" />
                      <div className="skeleton-line skeleton-line--short" />
                    </div>
                  ))
                ) : trendingError ? (
                  <div className="error-banner">
                    <span>{trendingError}</span>
                  </div>
                ) : trendingError ? (
                  <div className="error-banner">
                    <span>{trendingError}</span>
                    <button type="button" className="btn btn-ghost btn-compact" onClick={reloadTrending}>Retry</button>
                  </div>
                ) : trending.length ? (
                  trending.slice(0, 5).map((item) => {
                    const itemId = item._id || item.id
                    const title = item.title || item.name || item.username || 'Trending track'
                    const subtitle = getArtistName(item) !== 'Unknown artist' ? getArtistName(item) : item.genre || 'Music discovery'

                    return (
                      <article key={itemId || title} className="search-trending-card">
                        <Artwork item={item} size="small" className="search-trending-artwork" />
                        <div className="search-trending-body">
                          <div>
                            <strong>{title}</strong>
                            <p className="subtitle">{subtitle}</p>
                          </div>
                          <div className="search-trending-card-actions">
                            <button type="button" className="btn btn-ghost btn-compact" onClick={() => handlePlayItem(item)} title={`Play ${title}`}>
                              Play
                            </button>
                            <QueueButton songId={itemId} className="icon-button" title="Add to queue" />
                            <PlaylistPicker
                              songId={itemId}
                              buttonLabel="＋"
                              buttonClassName="icon-button"
                              buttonTitle="Add to playlist"
                              disabled={!itemId}
                              onSuccess={handleAddToPlaylist}
                              onError={handlePlaylistError}
                            />
                          </div>
                        </div>
                      </article>
                    )
                  })
                ) : (
                  <p className="subtitle">No trending items available.</p>
                )}
              </div>
            </div>

            <div className="card search-discovery-card">
              <div className="section-heading" style={{ marginBottom: 10 }}>
                <h2>Browse genres</h2>
              </div>
              <div className="browse-grid browse-grid--compact">
                {genreCategories.map((category) => (
                  <button
                    key={category.label}
                    type="button"
                    className="browse-card browse-card--compact"
                    onClick={() => handleSearchSelect(category.label, category.label)}
                    style={{ '--genre-accent': category.accent }}
                  >
                    <span className="browse-card-icon" aria-hidden="true">{category.icon}</span>
                    <span className="browse-card-copy">
                      <strong>{category.label}</strong>
                      <span>{category.mood}</span>
                    </span>
                    <span className="browse-card-arrow" aria-hidden="true">→</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}


      {trimmedQuery ? (
        <section className="search-section">
          <div className="search-tabs" role="tablist" aria-label="Search result type">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                className={`tab-button ${activeTab === tab.key ? 'tab-button--active' : ''}`}
                onClick={() => { setActiveTab(tab.key); setSongPage(1) }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {loading && !songCount && !artistCount ? (
            <div className="search-results-loading">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="search-skeleton-card">
                  <div className="skeleton-line skeleton-line--title" />
                  <div className="skeleton-line skeleton-line--short" />
                </div>
              ))}
            </div>
          ) : null}

          {loading && (songCount || artistCount) ? <div className="search-refreshing" role="status">Updating results…</div> : null}

          {error ? (
            <div className="error-banner">
              <span>{error}</span>
              <button type="button" className="btn btn-ghost btn-compact" onClick={() => { setSongs([]); setArtists([]); setSearchRetryKey((value) => value + 1) }}>Retry</button>
            </div>
          ) : null}

          {showEmptyState ? (
            <div className="home-empty-state">
              <p>No matches found for “{trimmedQuery}”. Try another artist, track, or playlist keyword.</p>
            </div>
          ) : null}

          {!loading && !error && activeTab === 'songs' ? (
            <>
              {songCount ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                  <div className="search-results-count">{songCount === 1 ? '1 result' : `${songCount} results`}</div>
                  {Math.ceil(songCount / SONGS_PER_PAGE) > 1 ? (
                    <div className="pagination-controls" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button type="button" className="btn btn-ghost btn-compact" disabled={songPage <= 1} onClick={() => setSongPage((p) => Math.max(1, p - 1))}>← Previous</button>
                      <span className="subtitle" style={{ minWidth: '80px', textAlign: 'center' }}>Page {songPage} of {Math.ceil(songCount / SONGS_PER_PAGE)}</span>
                      <button type="button" className="btn btn-ghost btn-compact" disabled={songPage > Math.ceil(songCount / SONGS_PER_PAGE) - 1} onClick={() => setSongPage((p) => Math.min(Math.ceil(songCount / SONGS_PER_PAGE), p + 1))}>Next →</button>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="search-results-grid">
                {songs.length > 0
                  ? songs
                    .slice((songPage - 1) * SONGS_PER_PAGE, songPage * SONGS_PER_PAGE)
                    .map((song) => <SongRow key={song._id || song.id} song={song} compact />)
                  : <p className="subtitle">No songs found.</p>}
              </div>
            </>
          ) : null}

          {!loading && !error && activeTab === 'artists' ? (
            <>
              {artistCount ? <div className="search-results-count">{artistCount === 1 ? '1 result' : `${artistCount} results`}</div> : null}
              <div className="search-results-grid search-results-grid--artists">
                {artists.length ? artists.map((artist) => (
                  <article className="artist-card card" key={artist._id || artist.id}>
                    <Artwork item={artist} size="medium" />
                    <div className="artist-card-body">
                      <div>
                        <h3>{artist.username || artist.name || 'Unknown artist'}</h3>
                        <p className="subtitle">{artist.bio || artist.email || 'Artist profile'}</p>
                      </div>
                      <div className="row-actions">
                        <button type="button" className="btn btn-ghost btn-compact">Play</button>
                      </div>
                    </div>
                  </article>
                )) : <p className="subtitle">No artists found.</p>}
              </div>
            </>
          ) : null}

        </section>
      ) : null}
    </div>
  )
}
