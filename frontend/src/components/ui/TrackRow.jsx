import Artwork from './Artwork'
import { getArtistName } from '@/domain/media'

export default function TrackRow({ song, index, isActive = false, isActivePlaying = false, onPlay, onTogglePlayback, trailing }) {
  const title = song?.title || 'Untitled track'
  const artist = getArtistName(song)

  const handleMainClick = (event) => {
    if (isActivePlaying) {
      onTogglePlayback?.(event)
      return
    }
    onPlay?.(event)
  }

  return (
    <article className={`track-row${isActive ? ' track-row--active' : ''}`}>
      <button type="button" className="track-main" onClick={handleMainClick} aria-label={isActivePlaying ? `Pause ${title}` : `Play ${title}`}>
        <span className={`track-index${isActivePlaying ? ' track-index--active' : ''}`} aria-hidden="true">
          <span className="track-index-number">{index + 1}</span>
          <span className="track-index-icon">{isActivePlaying ? '⏸' : '▶'}</span>
        </span>
        <Artwork item={song} size="small" />
        <span className="track-copy">
          <strong title={title}>{title}</strong>
          <small>{artist}</small>
        </span>
      </button>
      <div className="track-row-actions">
        {trailing || <span className="track-more" aria-hidden="true">•••</span>}
      </div>
    </article>
  )
}
