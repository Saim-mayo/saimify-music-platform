import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Artwork from './Artwork'

export default function PlaylistCard({
  to,
  title,
  subtitle,
  count,
  coverItem,
  active,
  onPlay,
  onRename,
  onDelete,
  onChangeCover,
  label,
  className = '',
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return undefined
    const closeOnOutsideClick = (event) => {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false)
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [menuOpen])

  const handleAction = (action) => {
    setMenuOpen(false)
    action?.()
  }

  return (
    <article className={`media-card playlist-card ${active ? 'is-active' : ''} ${className}`.trim()}>
      <Link to={to} className="playlist-card-link" aria-label={`Open ${title}`}>
        <Artwork item={coverItem || { title, artist: { username: title } }} size="medium" className="playlist-card-art" />
        <div className="playlist-card-copy">
          <strong>{title}</strong>
          <span className="subtitle">{subtitle || `${count || 0} songs`}</span>
        </div>
      </Link>
      {onPlay ? (
        <button type="button" className="media-card-action playlist-card-action" onClick={onPlay} aria-label={`Play ${title}`}>
          ▶
        </button>
      ) : null}
      {(onRename || onChangeCover || onDelete) ? (
        <div ref={menuRef} className={`media-card-menu-wrap playlist-card-menu-wrap${menuOpen ? ' menu-open' : ''}`}>
          <button type="button" className="icon-button media-card-menu-button playlist-card-menu-button" aria-label={`Open actions for ${title}`} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>⋮</button>
          <div className="media-card-menu playlist-card-menu" hidden={!menuOpen}>
            {onRename ? (
              <button type="button" className="playlist-card-menu-action" onClick={() => handleAction(onRename)}>Rename</button>
            ) : null}
            {onChangeCover ? (
              <button type="button" className="playlist-card-menu-action" onClick={() => handleAction(onChangeCover)}>Change cover</button>
            ) : null}
            {onDelete ? (
              <button type="button" className="playlist-card-menu-action playlist-card-menu-action--danger" onClick={() => handleAction(onDelete)}>Delete</button>
            ) : null}
          </div>
        </div>
      ) : null}
      {label ? <span className="playlist-card-label">{label}</span> : null}
    </article>
  )
}
