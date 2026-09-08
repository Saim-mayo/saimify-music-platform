export const getPlaylistActionMessage = (error, fallbackMessage, playlistName = '') => {
  const status = error?.response?.status
  const responseMessage = error?.response?.data?.message

  if (status === 409 || /already/i.test(String(responseMessage || ''))) {
    return playlistName ? `This track is already in ${playlistName}.` : 'This track is already in that playlist.'
  }

  if (responseMessage) {
    return responseMessage
  }

  return fallbackMessage || 'Unable to update the playlist.'
}
