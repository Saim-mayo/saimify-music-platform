const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const likeController = require('../controllers/like.controller');

const {
   likeSongValidator,
   unlikeSongValidator,
   getSongLikesValidator
} = require('../validators/like.validator');

/**
 * @openapi
 * /likes/like:
 *   post:
 *     summary: Like a song
 *     tags: [Likes]
 *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [songId]
 *             properties:
 *               songId: { type: string }
 *     responses:
 *       200: { description: Song liked }
 *       404: { description: Song not found }
 */
// ❤️ like song
router.post(
   '/like',
   authMiddleware,
   likeSongValidator,
   validate,
   likeController.likeSong
);

/**
 * @openapi
 * /likes/unlike:
 *   post:
 *     summary: Unlike a previously liked song
 *     tags: [Likes]
 *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [songId]
 *             properties:
 *               songId: { type: string }
 *     responses:
 *       200: { description: Song unliked }
 *       404: { description: Song not found, or not previously liked }
 */
// 💔 unlike song
router.post(
   '/unlike',
   authMiddleware,
   unlikeSongValidator,
   validate,
   likeController.unlikeSong
);

/**
 * @openapi
 * /likes/user:
 *   get:
 *     summary: Get the current user's liked songs
 *     tags: [Likes]
 *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
 *     responses:
 *       200: { description: List of liked songs }
 */
// 📄 get my liked songs
router.get(
   '/user',
   authMiddleware,
   likeController.getMyLikedSongs
);

/**
 * /likes/likes/{songId}:
 *   get:
 *     summary: Get the like count (and whether the current user liked it) for a song
 *     tags: [Likes]
 *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: songId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Like info for the song }
 *       404: { description: Song not found }
 */
// 📊 get likes
router.get(
   '/likes/:songId',
   authMiddleware,
   getSongLikesValidator,
   validate,
   likeController.getSongLikes
);

module.exports = router;
