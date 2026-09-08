const MUSIC_GENRES = ['Pop', 'Hip-Hop', 'Rock', 'Electronic', 'R&B', 'Indie', 'Classical', 'Jazz', 'Folk', 'Other']

const normalizeGenre = (value) => {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const match = MUSIC_GENRES.find((genre) => genre.toLowerCase() === trimmed.toLowerCase())
  return match || null
}

module.exports = {
  MUSIC_GENRES,
  normalizeGenre,
}
