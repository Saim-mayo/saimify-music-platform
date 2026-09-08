const asyncHandler = require('../utils/asyncHandler');
const { validationResult } = require('express-validator');

const {
   createPlaylistService,
   addSongToPlaylistService,
   removeSongFromPlaylistService,
   getMyPlaylistsService,
   getPlaylistByIdService,
   updatePlaylistService,
   removePlaylistService
} = require('../services/playlist.service');

const createPlaylist = asyncHandler(async (req, res) => {

   const errors = validationResult(req);
   if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
   }

   const coverFile = req.files?.cover?.[0] || req.file || req.body.cover;

   const playlist = await createPlaylistService({
      title: req.body.title,
      userId: req.user.userId,
      isPublic: req.body.isPublic,
      cover: coverFile
   });

   return res.status(201).json({
      message: 'Playlist created',
      playlist
   });
});

const addSongToPlaylist = asyncHandler(async (req, res) => {

   const errors = validationResult(req);
   if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
   }

   const playlist = await addSongToPlaylistService({
      playlistId: req.body.playlistId,
      songId: req.body.songId,
      userId: req.user.userId
   });

   return res.status(200).json({
      message: 'Song added to playlist',
      playlist
   });
});

const removeSongFromPlaylist = asyncHandler(async (req, res) => {

   const errors = validationResult(req);
   if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
   }

   const playlist = await removeSongFromPlaylistService({
      playlistId: req.body.playlistId,
      songId: req.body.songId,
      userId: req.user.userId
   });

   return res.status(200).json({
      message: 'Song removed from playlist',
      playlist
   });
});

const getMyPlaylists = asyncHandler(async (req, res) => {
   const page = parseInt(req.query.page, 10) || 1;
   const limit = parseInt(req.query.limit, 10) || 20;

   const result = await getMyPlaylistsService(req.user.userId, page, limit);

   return res.status(200).json({
      total: result.pagination.totalItems,
      playlists: result.playlists,
      pagination: result.pagination
   });
});

const getPlaylistById = asyncHandler(async (req, res) => {

   const playlist = await getPlaylistByIdService(req.params.playlistId, req.user.userId   );

   return res.status(200).json({
      playlist
   });
});

const updatePlaylist = asyncHandler(async (req, res) => {

   const coverFile = req.files?.cover?.[0] || req.file || req.body.cover;

   const playlist = await updatePlaylistService({
      playlistId: req.params.playlistId,
      userId: req.user.userId,
      title: req.body.title,
      cover: coverFile
   });

   return res.status(200).json({
      message: 'Playlist updated successfully',
      playlist
   });
});

const removePlaylist = asyncHandler(async (req, res) => {

await removePlaylistService(
   req.params.playlistId,
   req.user.userId,
   req.user.role
);

   return res.status(200).json({
      message: 'Playlist deleted successfully'
   });
});

module.exports = {
   createPlaylist,
   addSongToPlaylist,
   removeSongFromPlaylist,
   getMyPlaylists,
   getPlaylistById,
   updatePlaylist,
   removePlaylist
};