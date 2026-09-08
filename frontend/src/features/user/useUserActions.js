import { useCallback } from 'react'
import { addSongToPlaylist, createPlaylist, deletePlaylist, downloadSong, getSongsByArtist, getSongLikes, getUserPlaylists, likeSong, playSong, recordPlay, replaceQueue, setPassword, unlikeSong, updateProfile, uploadAvatar } from '@/api'

export default function useUserActions() {
  return {
    playSong: useCallback((songId) => playSong(songId), []),
    recordPlay: useCallback((songId) => recordPlay(songId), []),
    replaceQueue: useCallback((payload) => replaceQueue(payload), []),
    createPlaylist: useCallback((payload) => createPlaylist(payload), []),
    deletePlaylist: useCallback((playlistId) => deletePlaylist(playlistId), []),
    getUserPlaylists: useCallback((page, limit) => getUserPlaylists(page, limit), []),
    addSongToPlaylist: useCallback((payload) => addSongToPlaylist(payload), []),
    getSongLikes: useCallback((songId) => getSongLikes(songId), []),
    likeSong: useCallback((payload) => likeSong(payload), []),
    unlikeSong: useCallback((payload) => unlikeSong(payload), []),
    downloadSong: useCallback((songId) => downloadSong(songId), []),
    getSongsByArtist: useCallback((artistId) => getSongsByArtist(artistId), []),
    setPassword: useCallback((payload) => setPassword(payload), []),
    updateProfile: useCallback((payload) => updateProfile(payload), []),
    uploadAvatar: useCallback((formData) => uploadAvatar(formData), [])
  }
}
