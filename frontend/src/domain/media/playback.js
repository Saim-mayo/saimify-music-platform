export const isTrackActive = (track, currentTrack) => {
  const trackId = track?._id || track?.id
  const currentTrackId = currentTrack?._id || currentTrack?.id
  return Boolean(trackId && currentTrackId && String(trackId) === String(currentTrackId))
}
