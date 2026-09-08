import { useState } from 'react'
import Artwork from './Artwork'

export default function PlaylistHero({
  playlist,
  isLiked = false,
  onPlay,
  onShuffle,
  onRename,
  onChangeCover,
  onDelete,
  isLoading = false,
  ownerLabel,
}) {
  const title = playlist?.title || (isLiked ? 'Liked Songs' : 'Untitled playlist')
  const label = isLiked ? 'Liked songs' : 'Playlist'
  const owner = ownerLabel || playlist?.owner?.username || playlist?.owner?.name || 'You'
  const trackCount = Array.isArray(playlist?.songs) ? playlist.songs.length : 0
  const durationLabel = playlist?.duration ? `${playlist.duration}` : ''
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(title)

  const startTitleEdit = () => {
    setTitleDraft(title)
    setIsEditingTitle(true)
  }

  const saveTitle = async () => {
    const nextTitle = titleDraft.trim()
    if (!nextTitle || !onRename) return
    await onRename(nextTitle)
    setIsEditingTitle(false)
  }

  return (
    <section className={`card playlist-hero${isLoading ? ' playlist-hero--loading' : ''}`}>
      <Artwork item={playlist} size="large" className="playlist-hero-artwork" />
      <div className="playlist-hero-copy">
        <span className="eyebrow playlist-hero-type">{label}</span>
        {isEditingTitle ? (
          <div className="playlist-title-editable-row">
            <input
              className="input playlist-rename-input"
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
              aria-label="Playlist name"
              autoFocus
            />
            <button type="button" className="btn btn-primary btn-compact" onClick={saveTitle}>Save</button>
            <button type="button" className="btn btn-ghost btn-compact" onClick={() => setIsEditingTitle(false)}>Cancel</button>
          </div>
        ) : <h1>{title}</h1>}
        <p className="subtitle playlist-hero-meta">
          {owner ? <span>{owner}</span> : null}
          {trackCount ? <span>{trackCount} {trackCount === 1 ? 'song' : 'songs'}</span> : null}
          {durationLabel ? <span>{durationLabel}</span> : null}
        </p>
        <div className="row-actions playlist-hero-actions">
          {onPlay ? <button type="button" className="btn btn-primary" onClick={onPlay}>Play</button> : null}
          {onShuffle ? <button type="button" className="btn btn-ghost" onClick={onShuffle}>Shuffle</button> : null}
          {onChangeCover ? (
            <label className="btn btn-ghost btn-compact">
              Change cover
              <input type="file" accept="image/*" hidden onChange={(event) => onChangeCover(event.target.files?.[0])} />
            </label>
          ) : null}
          {onRename && !isEditingTitle ? <button type="button" className="btn btn-ghost btn-compact" onClick={startTitleEdit}>Rename</button> : null}
          {onDelete ? <button type="button" className="btn btn-danger btn-compact" onClick={onDelete}>Delete</button> : null}
        </div>
      </div>
    </section>
  )
}
