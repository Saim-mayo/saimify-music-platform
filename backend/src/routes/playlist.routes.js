const express = require('express');
const router = express.Router();
const multer = require('multer');
const AppError = require('../utils/appError');

const playlistController = require('../controllers/playlist.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const {
   createPlaylistValidator,
   updatePlaylistValidator,
   songActionValidator,
   playlistIdParamValidator
} = require('../validators/playlist.validator');

// 🖼️ optional cover upload config (image only, same limits as other cover uploads)
const upload = multer({
   storage: multer.memoryStorage(),
   limits: { fileSize: 10 * 1024 * 1024 },
   fileFilter: (req, file, cb) => {
      if (file.fieldname === 'cover' && !file.mimetype.startsWith('image/')) {
         return cb(new AppError('Only image files allowed for cover', 400), false);
      }
      cb(null, true);
   }
});

/**
 * @openapi
 * /playlists:
 *   post:
 *     summary: Create a new playlist
 *     tags: [Playlists]
 *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title: { type: string, minLength: 2 }
 *               isPublic: { type: boolean }
 *               cover: { type: string, format: binary, description: "Optional playlist cover image" }
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title: { type: string }
 *               isPublic: { type: boolean }
 *     responses:
 *       201: { description: Playlist created }
 *       400: { description: Validation error }
 */
// 🎧 create playlist
router.post(
   '/',
   authMiddleware,
   upload.fields([{ name: 'cover', maxCount: 1 }]),
   createPlaylistValidator,
   validate,
   playlistController.createPlaylist
);

/**
 * @openapi
 * /playlists/add-song:
 *   post:
 *     summary: Add a song to one of the current user's playlists
 *     tags: [Playlists]
 *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [playlistId, songId]
 *             properties:
 *               playlistId: { type: string }
 *               songId: { type: string }
 *     responses:
 *       200: { description: Song added to playlist }
 *       404: { description: Playlist or song not found }
 */
// ➕ add song
router.post(
   '/add-song',
   authMiddleware,
   songActionValidator,
   validate,
   playlistController.addSongToPlaylist
);

/**
 * @openapi
 * /playlists/remove-song:
 *   post:
 *     summary: Remove a song from one of the current user's playlists
 *     tags: [Playlists]
 *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [playlistId, songId]
 *             properties:
 *               playlistId: { type: string }
 *               songId: { type: string }
 *     responses:
 *       200: { description: Song removed from playlist }
 *       404: { description: Playlist or song not found }
 */
router.post(
   '/remove-song',
   authMiddleware,
   songActionValidator,
   validate,
   playlistController.removeSongFromPlaylist
);

/**
 * @openapi
 * /playlists/user:
 *   get:
 *     summary: Get the current user's playlists
 *     tags: [Playlists]
 *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
 *     responses:
 *       200: { description: List of the user's playlists }
 */
// 📄 get my playlists
router.get('/user', authMiddleware, playlistController.getMyPlaylists);

/**
 * @openapi
 * /playlists/{playlistId}:
 *   get:
 *     summary: Get a single playlist by ID
 *     tags: [Playlists]
 *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: playlistId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Playlist details }
 *       404: { description: Playlist not found }
 */
// 📄 get by id
router.put('/:playlistId', authMiddleware, upload.fields([{ name: 'cover', maxCount: 1 }]), updatePlaylistValidator, validate, playlistController.updatePlaylist);
router.get('/:playlistId', authMiddleware,playlistIdParamValidator,validate, playlistController.getPlaylistById);

/**
 * @openapi
 * /playlists/{playlistId}:
 *   delete:
 *     summary: Delete one of the current user's playlists
 *     tags: [Playlists]
 *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: playlistId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Playlist deleted }
 *       404: { description: Playlist not found }
 */
// 🗑 delete
router.delete('/:playlistId', authMiddleware, playlistIdParamValidator,validate, playlistController.removePlaylist);

module.exports = router;