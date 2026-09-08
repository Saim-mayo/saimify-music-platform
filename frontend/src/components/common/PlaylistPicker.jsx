import { useEffect, useState, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { getPlaylistActionMessage } from '@/utils/playlistActions'
import useUserActions from '@/features/user/useUserActions'

function PlaylistPickerPortal({ children }) {
  const target = useMemo(() => (typeof document !== 'undefined' ? document.body : null), [])
  return target ? createPortal(children, target) : null
}

export default function PlaylistPicker({
  songId,
  buttonLabel = 'Add to playlist ▾',
  buttonClassName = 'btn btn-primary btn-compact',
  buttonTitle,
  disabled = false,
  onSuccess,
  onError,
}) {
  const navigate = useNavigate()
  const [playlists, setPlaylists] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const { getUserPlaylists, addSongToPlaylist } = useUserActions()

  useEffect(() => {
    if (!open) return

    let cancelled = false
    const loadPlaylists = async () => {
      setLoading(true)
      try {
        const data = await getUserPlaylists(1, 50)
        if (!cancelled) {
          setPlaylists(data?.playlists || [])
        }
      } catch {
        if (!cancelled) {
          setPlaylists([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadPlaylists()
    return () => {
      cancelled = true
    }
  }, [getUserPlaylists, open])

  // Ensure only one PlaylistPicker menu is open at a time across the page.
  useEffect(() => {
    const handler = (e) => {
      const otherId = e?.detail
      if (!otherId) return
      if (otherId !== songId) setOpen(false)
    }
    window.addEventListener('playlist-picker-open', handler)
    return () => window.removeEventListener('playlist-picker-open', handler)
  }, [songId])

  const shellRef = useRef(null)
  const dialogRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    const previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.body.style.touchAction = 'none'
    dialogRef.current?.focus()

    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }

    const onTouchMove = (e) => {
      if (!dialogRef.current?.contains(e.target)) {
        e.preventDefault()
      }
    }

    document.addEventListener('keydown', onKey)
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.body.style.touchAction = ''
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('touchmove', onTouchMove)
    }
  }, [open])

  const handleToggle = (event) => {
    if (disabled) return
    event?.stopPropagation?.()
    setOpen((value) => {
      const next = !value
      if (next) {
        // notify other pickers to close
        try { window.dispatchEvent(new CustomEvent('playlist-picker-open', { detail: songId })) } catch {
          // ignore old browser support issues
        }
      }
      return next
    })
  }

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPlaylistIds, setSelectedPlaylistIds] = useState([])
  const [submitting, setSubmitting] = useState(false)

  const filteredPlaylists = playlists.filter((playlist) => {
    const title = String(playlist?.title || '').toLowerCase()
    const query = searchTerm.toLowerCase().trim()
    return !query || title.includes(query)
  })

  const toggleSelection = (playlistId) => {
    setSelectedPlaylistIds((current) => {
      if (current.includes(playlistId)) {
        return current.filter((id) => id !== playlistId)
      }
      return [...current, playlistId]
    })
  }

  const handleSubmit = async () => {
    if (!songId || !selectedPlaylistIds.length) return

    setSubmitting(true)
    const selectedPlaylists = playlists.filter((playlist) => selectedPlaylistIds.includes(playlist._id))
    try {
      const results = await Promise.all(selectedPlaylistIds.map((playlistId) => addSongToPlaylist({ playlistId, songId })))
      const playlistTitles = selectedPlaylists.map((playlist) => playlist.title || 'Untitled playlist')
      const successMessage = playlistTitles.length === 1
        ? `Added to ${playlistTitles[0]}.`
        : `Added to ${playlistTitles.length} playlists.`
      onSuccess?.(successMessage, selectedPlaylistIds, results)
      setOpen(false)
      setSearchTerm('')
      setSelectedPlaylistIds([])
    } catch (error) {
      const message = getPlaylistActionMessage(error, 'Unable to add this track to the selected playlists.', '')
      onError?.(message, error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = (event) => {
    event?.stopPropagation?.()
    setOpen(false)
    setSearchTerm('')
    setSelectedPlaylistIds([])
  }

  return (
    <div className={`playlist-picker-shell${open ? ' is-open' : ''}`} ref={shellRef}>
      <button type="button" className={buttonClassName} onClick={handleToggle} disabled={disabled} title={buttonTitle} aria-label={buttonTitle || buttonLabel}>
        {buttonLabel}
      </button>
      {open ? (
        <PlaylistPickerPortal>
          <div className="playlist-picker-overlay" role="presentation">
            <div className="playlist-picker-backdrop" onClick={handleClose} />
            <div
              className="playlist-picker-dialog"
              role="dialog"
              aria-modal="true"
              aria-label="Add song to playlist"
              tabIndex={-1}
              ref={dialogRef}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="playlist-picker-header">
                <div>
                  <strong>Add to playlist</strong>
                  <p className="playlist-picker-subtitle">Select playlists and confirm the action.</p>
                </div>
                <button type="button" className="playlist-picker-close" onClick={handleClose} aria-label="Close playlist menu">✕</button>
              </div>
              <div className="playlist-picker-menu-content">
                <label htmlFor="playlist-picker-search" className="playlist-picker-search-label">
                  <span className="visually-hidden">Filter playlists</span>
                  <input
                    id="playlist-picker-search"
                    type="search"
                    value={searchTerm}
                    placeholder="Filter playlists…"
                    className="playlist-picker-search"
                    onChange={(event) => setSearchTerm(event.target.value)}
                    disabled={loading || submitting}
                  />
                </label>
                {loading ? <p className="playlist-picker-empty">Loading playlists…</p> : null}
                {!loading && !playlists.length ? (
                  <div className="playlist-picker-empty">
                    <p>You don’t have any playlists yet.</p>
                    <Link className="playlist-picker-link" to="/library" onClick={() => setOpen(false)}>
                      Create one in the library
                    </Link>
                  </div>
                ) : null}
                {!loading && playlists.length && !filteredPlaylists.length ? (
                  <div className="playlist-picker-empty">
                    <p>No playlists match that filter.</p>
                  </div>
                ) : null}
                {!loading && filteredPlaylists.length ? (
                  <div className="playlist-picker-list">
                    {filteredPlaylists.map((playlist) => {
                      const checked = selectedPlaylistIds.includes(playlist._id)
                      return (
                        <label key={playlist._id} className="playlist-picker-item">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSelection(playlist._id)}
                            disabled={submitting}
                            className="playlist-picker-checkbox"
                          />
                          <div className="playlist-picker-item-copy">
                            <strong>{playlist.title || 'Untitled playlist'}</strong>
                            {playlist.description ? <span>{playlist.description}</span> : null}
                          </div>
                        </label>
                      )
                    })}
                  </div>
                ) : null}
              </div>
              <div className="playlist-picker-actions">
                <button type="button" className="playlist-picker-cancel" onClick={handleClose} disabled={submitting}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="playlist-picker-confirm btn btn-primary"
                  onClick={handleSubmit}
                  disabled={!selectedPlaylistIds.length || submitting}
                >
                  {submitting ? 'Adding…' : `Add to ${selectedPlaylistIds.length || 1} playlist${selectedPlaylistIds.length === 1 ? '' : 's'}`}
                </button>
                <button
                  type="button"
                  className="playlist-picker-link"
                  onClick={(e) => {
                    e.preventDefault()
                    setOpen(false)
                    setSearchTerm('')
                    setSelectedPlaylistIds([])
                    const pathname = (typeof window !== 'undefined' && window.location && window.location.pathname) ? window.location.pathname : ''
                    if (pathname === '/library') {
                      setTimeout(() => {
                        const el = document.getElementById('library-playlists')
                        if (el) {
                          try { el.scrollIntoView({ behavior: 'smooth', block: 'start' }) } catch { window.location.hash = '#library-playlists' }
                        } else {
                          window.location.hash = '#library-playlists'
                        }
                      }, 80)
                      return
                    }
                    navigate('/library#library-playlists')
                  }}
                >
                  Manage playlists
                </button>
              </div>
            </div>
          </div>
        </PlaylistPickerPortal>
      ) : null}
    </div>
  )
}
