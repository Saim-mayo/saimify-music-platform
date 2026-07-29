const asyncHandler = require('../utils/asyncHandler');
const { validationResult } = require('express-validator');
const {
   likeSongService,
   unlikeSongService,
   getSongLikesService,
   getMyLikedSongsService
} = require('../services/like.service');

const likeSong = asyncHandler(async (req, res) => {

   const errors = validationResult(req);
   if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
   }

   const like = await likeSongService(
      req.user.userId,
      req.body.songId
   );

   return res.status(201).json({
      message: 'Song liked successfully',
      like
   });
});

const unlikeSong = asyncHandler(async (req, res) => {

   const errors = validationResult(req);
   if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
   }

   await unlikeSongService(
      req.user.userId,
      req.body.songId
   );

   return res.status(200).json({
      message: 'Song unliked successfully'
   });
});

const getSongLikes = asyncHandler(async (req, res) => {

   const errors = validationResult(req);
   if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
   }

   const result = await getSongLikesService(req.params.songId);

   return res.status(200).json({
      message: 'Song likes fetched successfully',
      songId: req.params.songId,
      totalLikes: result.totalLikes,
      hasLikes: result.hasLikes
   });
});

const getMyLikedSongs = asyncHandler(async (req, res) => {
   const songs = await getMyLikedSongsService(req.user.userId);

   return res.status(200).json({
      message: 'Liked songs fetched successfully',
      songs
   });
});

module.exports = {
   likeSong,
   unlikeSong,
   getSongLikes,
   getMyLikedSongs
};