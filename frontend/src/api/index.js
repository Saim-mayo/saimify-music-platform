export {
	approveArtist,
	banUser,
	cancelUserSubscription,
	deleteAlbumAdmin,
	deletePlaylistAdmin,
	deleteSongAdmin,
	getAdminAlbums,
	getAdminPlaylists,
	getAdminSongs,
	getAuditLog,
	getPendingArtists,
	getUsers,
	rejectArtist,
	unbanUser,
} from './admin.api'
export { createArtistAlbum, uploadArtistTrack } from './artist.api'
export {
	exchangeOAuthCode,
	refreshAccessToken,
	forgotPassword,
	getMe,
	getMyFeatures,
	login,
	logout,
	register,
	requestArtistVerification,
	resendVerification,
	resetPassword,
	setPassword,
	updateProfile,
	uploadAvatar,
	verifyEmail,
} from './auth.api'
export { default as apiClient } from './client'
export { getApiErrorMessage, getApiFieldErrors } from './errors'
export { getMyLikedSongs, getSongLikes, likeSong, unlikeSong } from './like.api'
export {
	createAlbum,
	deleteAlbum,
	deleteSong,
	downloadSong,
	getAlbumById,
	getAllAlbums,
	getAllSongs,
	getHistory,
	getMyAlbums,
	getMySongs,
	getSongsByArtist,
	getTrending,
	playSong,
	recordPlay,
	searchArtists,
	searchSongs,
	streamSong,
	updateAlbum,
	updateSong,
	uploadSong,
} from './music.api'
export { getNotifications, getUnreadCount, markAllNotificationsAsRead, markNotificationAsRead } from './notification.api'
export {
	cancelSubscription,
	changeSubscriptionPlan,
	checkoutPlan,
	getPaymentHistory,
	getPlans,
	getSubscriptionStatus,
	openBillingPortal,
	resumeSubscription,
} from './payment.api'
export {
	addSongToPlaylist,
	createPlaylist,
	deletePlaylist,
	getPlaylistById,
	getUserPlaylists,
	removeSongFromPlaylist,
	updatePlaylist,
} from './playlist.api'
export { addToQueue, clearQueue, getCurrentQueue, getFullQueue, nextQueueSong, previousQueueSong, replaceQueue, toggleRepeat, toggleShuffle } from './queue.api'
export { unwrapCollection, unwrapEntity } from './response'
