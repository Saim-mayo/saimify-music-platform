const playlistPalette = [
  ['#1ed760', '#0f7d39'],
  ['#2e8b57', '#123922'],
  ['#1ed760', '#123922'],
  ['#3ddc84', '#0a2e1a'],
]

export const getPlaylistGradient = (title) => {
  const seed = String(title || 'library').toLowerCase()
  const index = seed.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % playlistPalette.length
  return playlistPalette[index]
}

export const getPlaylistGradientStyle = (title) => {
  const [start, end] = getPlaylistGradient(title)
  return { background: `linear-gradient(135deg, ${start}, ${end})` }
}
