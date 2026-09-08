import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { Artwork, TrackRow } from '@/components/ui'
import { PlaylistPicker, QueueButton, Skeleton } from '@/components/common'
import { usePlayerStore } from '@/store'
import { useAlbumData } from '@/features/user/useAlbumData'
import useUserActions from '@/features/user/useUserActions'
import { dispatchErrorToast } from '@/utils/toast'
import { formatDuration } from '@/utils/formatDuration'
import { getArtistName } from '@/domain/media'

export default function AlbumDetail() {
  const { albumId } = useParams()
  const { playTrack } = usePlayerStore()
  const { replaceQueue } = useUserActions()
  const { album, likedTrackIds, loading, error, setError, reload: loadAlbum, toggleLike, recordPlay } = useAlbumData(albumId)

  const tracks = useMemo(() => Array.isArray(album?.musics) ? album.musics : Array.isArray(album?.songs) ? album.songs : [], [album])
  const totalDuration = useMemo(() => tracks.reduce((sum, track) => sum + Number(track?.duration || 0), 0), [tracks])

  const handlePlayAlbum = async () => {
    if (!tracks.length) return
    const firstTrack = tracks[0]
    const firstTrackId = firstTrack?._id || firstTrack?.id
    const queueIds = tracks.map((track) => track?._id || track?.id).filter(Boolean)
    if (queueIds.length) {
      try {
        await replaceQueue({ queue: queueIds, currentIndex: 0 })
      } catch {
        // fallback to local playback if queue sync fails
      }
    }
    if (!firstTrackId) return

    try {
      await recordPlay(firstTrackId)
      playTrack(firstTrack, tracks, 0)
    } catch (error) {
      dispatchErrorToast(error)
    }
  }

  const handlePlayTrack = async (track, index = 0) => {
    if (!track) return
    const trackId = track?._id || track?.id
    if (!trackId) return

    try {
      await recordPlay(trackId)
      playTrack(track, [track], index)
    } catch (error) {
      dispatchErrorToast(error)
    }
  }

  const handlePlaylistError = (message) => {
    setError(message || 'Unable to add the track to the playlist.')
  }

  const handleLikeToggle = async (track) => {
    const trackId = track?._id || track?.id
    if (!trackId) return

    await toggleLike(track)
  }

  if (loading) return <div className="content-shell"><section className="card"><Skeleton className="profile-skeleton" lines={5} /></section><section className="card"><Skeleton className="profile-skeleton" lines={6} /></section></div>
  if (error) return <div className="content-shell"><div className="error-banner"><span>{error}</span><button type="button" className="btn btn-ghost btn-compact" onClick={loadAlbum}>Retry</button></div></div>
  if (!album) return <div className="content-shell"><div className="home-empty-state"><p>We could not find that album. Return to Home and choose another release.</p></div></div>

  const albumTitle = album.title || album.name || 'Album'
  const artistName = getArtistName(album)

  return (
    <div className="content-shell">
      <section className="playlist-hero section-hero">
        <Artwork item={album} size="medium" />
        <div className="playlist-hero-copy">
          <span className="section-kicker">Album</span>
          <h1>{albumTitle}</h1>
          <p className="subtitle">{artistName} • {tracks.length} tracks • {formatDuration(totalDuration)}</p>
          <div className="row-actions">
            <button type="button" className="btn btn-primary" onClick={handlePlayAlbum} disabled={!tracks.length}>
              Play album
            </button>
            <PlaylistPicker
              songId={tracks[0]?._id || tracks[0]?.id}
              buttonLabel="Add to playlist"
              buttonClassName="btn btn-ghost"
              disabled={!tracks.length}
              onSuccess={() => setError('')}
              onError={handlePlaylistError}
            />
          </div>
        </div>
      </section>

      <section className="card playlist-detail">
        <div className="section-heading">
          <h2>Tracks</h2>
        </div>
        <div className="track-list">
          {tracks.length ? tracks.map((track, index) => {
            const trackId = track?._id || track?.id
            const liked = likedTrackIds.has(trackId)
            return (
              <TrackRow
                key={trackId || `${track?.title || 'track'}-${index}`}
                song={track}
                index={index}
                onPlay={() => handlePlayTrack(track, index)}
                trailing={(
                  <div className="track-row-actions">
                    <button type="button" className="icon-button" onClick={(event) => { event.stopPropagation(); handleLikeToggle(track) }} aria-label={liked ? 'Unlike track' : 'Like track'} title={liked ? 'Tap to unlike' : 'Tap to like'}>
                      {liked ? '♥' : '♡'}
                    </button>
                    <QueueButton songId={trackId} className="btn btn-ghost btn-compact" title="Add this track to the queue">＋</QueueButton>
                    <PlaylistPicker
                      songId={trackId}
                      buttonLabel="Add"
                      buttonClassName="btn btn-primary btn-compact"
                      disabled={!trackId}
                      onSuccess={() => setError('')}
                      onError={handlePlaylistError}
                    />
                  </div>
                )}
              />
            )
          }) : <div className="home-empty-state"><p>No tracks available for this album yet.</p></div>}
        </div>
      </section>
    </div>
  )
}
