import { buildStreamUrl } from '@/config/runtime'

export const getTrackId = (track) => track?._id || track?.id || track?.song?._id || track?.song?.id || ''

const isObjectId = (value) => /^[a-f0-9]{24}$/i.test(String(value || '').trim())

export const getArtistName = (track) => {
  const song = track?.song || track
  if (!song) return 'Unknown artist'
  if (song.artistName && !isObjectId(song.artistName)) return song.artistName
  if (typeof song.artist === 'object') return song.artist.username || song.artist.name || 'Unknown artist'
  if (typeof song.artist === 'string' && !isObjectId(song.artist)) return song.artist
  if (typeof song.uploadedBy === 'object') return song.uploadedBy.username || song.uploadedBy.name || 'Unknown artist'
  if (typeof song.user === 'object') return song.user.username || song.user.name || 'Unknown artist'
  return 'Unknown artist'
}

export const normalizeTrack = (track) => {
  if (!track) return null
  const song = track.song || track
  const id = getTrackId(song)
  return {
    ...song,
    _id: id,
    title: song.title || 'Untitled track',
    artistName: getArtistName(song),
    streamUrl: buildStreamUrl(id),
  }
}
