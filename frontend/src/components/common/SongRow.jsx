import PlaylistPicker from './PlaylistPicker'
import QueueButton from './QueueButton'
import { usePlayerStore } from '@/store'
import { Artwork } from '@/components/ui'
import useSongActions from '@/features/user/useSongActions'
import { showToast } from '@/utils/toast'
import { getArtistName } from '@/domain/media'

export default function SongRow({ song, compact }) {
  const { currentTrack, isPlaying, togglePlay } = usePlayerStore()
  const songId = song?._id || song?.id
  const { liked, totalLikes, loadingLike, handleLikeToggle, handlePlay } = useSongActions(song)

  const isActive = Boolean(songId && currentTrack && String(songId) === String(currentTrack?._id || currentTrack?.id))
  const handleTogglePlayback = async () => {
    if (isActive) {
      togglePlay()
      return
    }
    await handlePlay()
  }

  const handleAddToPlaylist = (message) => {
    showToast({ message: message || 'Added to playlist.', tone: 'success' })
  }

  const handlePlaylistError = (message) => {
    showToast({ message: message || 'Unable to add this song to the playlist.', tone: 'error' })
  }

  return (
    <article className={`song-card${compact ? ' song-card--compact' : ''}`}>
      <Artwork item={song} size={compact ? 'small' : 'medium'} />
      <div className="song-card-body">
        <div className="song-card-heading">
          <div>
            <h3 title={song?.title || 'Untitled track'}>{song?.title || 'Untitled track'}</h3>
            <p>{getArtistName(song)}</p>
          </div>
          <button type="button" className="icon-button" onClick={handleLikeToggle} disabled={loadingLike} aria-label={liked ? 'Unlike song' : 'Like song'} title={liked ? 'Tap to unlike' : 'Tap to like'}>
            {liked ? '♥' : '♡'}
          </button>
        </div>
        <div className="song-card-footer">
          <span className="like-count">{totalLikes} likes</span>
          <div className="row-actions">
            <QueueButton songId={songId} className="search-queue-button" title="Add to queue" />

            {/* Compact add-to-playlist icon for quicker access in search/trending */}
            <PlaylistPicker
              songId={songId}
              buttonLabel="＋"
              buttonClassName="icon-button"
              buttonTitle="Add to playlist"
              disabled={!songId}
              onSuccess={handleAddToPlaylist}
              onError={handlePlaylistError}
            />

            {/* Play / Pause toggle reflects current player state */}
            <button type="button" className={`btn btn-compact${isActive && isPlaying ? ' is-active' : ''}`} onClick={handleTogglePlayback} aria-label={isActive && isPlaying ? 'Pause' : 'Play'}>
              {isActive && isPlaying ? 'Pause' : 'Play'}
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}
