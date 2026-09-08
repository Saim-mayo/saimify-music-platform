import Toast from './Toast'
import PlaylistPicker from './PlaylistPicker'
import { Artwork } from '@/components/ui'
import { formatDuration } from '@/utils/formatDuration'
import OverflowMenu from './OverflowMenu'
import useSongActions from './useSongActions'
import { getArtistName } from '@/domain/media'

export default function HistoryCard({ entry }) {
  const song = entry?.song || entry
  const playedAt = entry?.playedAt || entry?.createdAt
  const { liked, loadingLike, toastMessage, toastTone, setToastMessage, setToastTone, handleLikeToggle, handleQueue, handleAddToPlaylist, handlePlaylistError } = useSongActions(song)

  const songTitle = String(song?.title || song?.name || song?.trackTitle || song?.songName || entry?.songTitle || entry?.title || 'Untitled track')
  const formattedPlayedAt = playedAt ? new Date(playedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Recently played'
  const albumLabel = String(song?.album?.title || song?.albumTitle || song?.album || 'Unknown album')
  const artistLabel = String(getArtistName(song))
  const durationLabel = song?.duration ? formatDuration(song.duration) : ''

  return (
    <article className="history-card">
      <Toast message={toastMessage} tone={toastTone} onClose={() => { setToastMessage(''); setToastTone('info') }} />
      <div className="history-card-heading">
        <h3 className="history-card-title" title={songTitle}>{songTitle}</h3>
        <div className="history-card-controls">
          <button type="button" className={`icon-button history-card-like${liked ? ' is-liked' : ''}`} onClick={handleLikeToggle} disabled={loadingLike} aria-label={liked ? 'Unlike song' : 'Like song'} title={liked ? 'Unlike song' : 'Like song'}>
            {liked ? '♥' : '♡'}
          </button>
          <OverflowMenu>
            <button type="button" className="overflow-menu-option" onClick={handleQueue}>Add to queue</button>
            <PlaylistPicker
              songId={song?._id || song?.id}
              buttonLabel="Add to playlist"
              buttonClassName="overflow-menu-option overflow-menu-picker"
              disabled={!song?._id && !song?.id}
              onSuccess={handleAddToPlaylist}
              onError={handlePlaylistError}
            />
          </OverflowMenu>
        </div>
      </div>
      <Artwork item={song} size="medium" className="history-card-artwork" />
      <div className="history-card-body">
        <p className="history-card-subtitle" title={artistLabel}>{artistLabel}</p>
        <div className="history-card-meta">
          <span title={albumLabel}>{albumLabel}</span>
          {durationLabel ? <span title={durationLabel}>{durationLabel}</span> : null}
          <span title={formattedPlayedAt}>{formattedPlayedAt}</span>
        </div>

      </div>
    </article>
  )
}
