const AppError = require('../utils/appError');
const express = require('express');
const router = express.Router();
const multer = require('multer');

// controllers
const musicController = require('../controllers/music.controller');

// middleware
const authMiddleware = require('../middlewares/auth.middleware');
const {
   streamLimiter,
   uploadLimiter,
   searchLimiter
} = require("../middlewares/rateLimit.middleware");

const {
   requireVerifiedArtist
} = require('../middlewares/permission.middleware');

const {
   allowDownload,
   allowPlay
} = require('../middlewares/access.middleware');
const {
   logDownload
} = require('../middlewares/downloadAudit.middleware');

const { checkDailyLimit } = require('../middlewares/usage.middleware');
const {
   verifyMediaAccess
} = require('../middlewares/mediaAccess.middleware');
// validators
const {
   createSongValidation,
   updateSongValidation,
   songIdValidator,
   albumIdValidator
} = require('../validators/music.validator');

const validateAudioFile = require('../validators/file.validator');
const {
   createAlbumValidation,
   updateAlbumValidation
} = require('../validators/album.validator');
const validate = require('../middlewares/validate.middleware');

// upload config
const upload = multer({
   storage: multer.memoryStorage(),

   limits: { fileSize: 10 * 1024 * 1024 }, // adjust if needed

   fileFilter: (req, file, cb) => {
      /**
       * 🔒 SECURITY: restrict file types
       */

      // avatar → images only
      if (file.fieldname === 'avatar') {
         if (!file.mimetype.startsWith('image/')) {
            return cb(new AppError('Only image files allowed', 400), false);
         }
      }

      // music → audio only
      if (file.fieldname === 'music') {
         if (!file.mimetype.startsWith('audio/')) {
            return cb(new AppError('Only audio files allowed', 400), false);
         }
      }

      cb(null, true);
   }
});


// =====================================
// 🌍 PUBLIC ROUTES
// =====================================

/**
 * @openapi
 * /music/all-songs:
 *   get:
 *     summary: List all public songs (paginated)
 *     tags: [Music]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200: { description: Songs fetched successfully }
 */
router.get('/all-songs', musicController.getAllSongs);

/**
 * @openapi
 * /music/all-albums:
 *   get:
 *     summary: List all public albums (paginated)
 *     tags: [Music]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200: { description: Albums fetched successfully }
 */
router.get('/all-albums', musicController.getAllAlbums);

/**
 * @openapi
 * /music/albums/{albumId}:
 *   get:
 *     summary: Get a single album by ID
 *     tags: [Music]
 *     parameters:
 *       - in: path
 *         name: albumId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Album fetched successfully }
 *       400: { description: Invalid albumId }
 *       404: { description: Album not found }
 */
router.get(
   '/albums/:albumId',
   albumIdValidator,
   validate,
   musicController.getAlbumById
);

/**
 * @openapi
 * /music/search/songs:
 *   get:
 *     summary: Search public songs by title
 *     tags: [Music]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Matching songs }
 *       400: { description: Search query required }
 */
router.get('/search/songs', searchLimiter, musicController.searchSongs);

/**
 * @openapi
 * /music/search/artists:
 *   get:
 *     summary: Search artists by username
 *     tags: [Music]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Matching artists }
 *       400: { description: Search query required }
 */
router.get('/search/artists', searchLimiter, musicController.searchArtists);

/**
 * @openapi
 * /music/trending:
 *   get:
 *     summary: Get the top 20 trending public songs by play count
 *     tags: [Music]
 *     responses:
 *       200: { description: Trending songs }
 */
router.get('/trending', musicController.getTrendingSongs);

router.get(
   '/artist/:artistId/songs',
   authMiddleware,
   musicController.getSongsByArtist
);

// =====================================
// 👤 USER ROUTES
// =====================================

/**
 * @openapi
 * /music/play/{songId}:
 *   post:
 *     summary: Register a play (increments play count, adds to history)
 *     tags: [Music]
 *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: songId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Song played }
 *       403: { description: Account banned or access denied }
 *       404: { description: Song not found }
 */
router.post(
   '/play/:songId',
   authMiddleware,
   songIdValidator,   // ✅ validate first
   validate,
   allowPlay,         // ✅ then access control
   musicController.playSong
);

router.get(
   '/can-stream/:songId',
   streamLimiter,
   authMiddleware,
   songIdValidator,
   validate,
   allowPlay,
   verifyMediaAccess('stream'),
   (req, res, next) => {
      req.isStreamAuthorization = true;
      next();
   },
   checkDailyLimit,
   musicController.canStreamSong
);

/**
 * @openapi
 * /music/stream/{songId}:
 *   get:
 *     summary: Stream audio (HTTP range requests, 206 partial content)
 *     tags: [Music]
 *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: songId
 *         required: true
 *         schema: { type: string }
 *       - in: header
 *         name: Range
 *         required: false
 *         schema: { type: string, example: "bytes=0-" }
 *     responses:
 *       200: { description: Full audio stream or initial playback request }
 *       206: { description: Partial audio content }
 *       403: { description: A paid plan is required, or song unavailable }
 *       404: { description: Song not found }
 *       416: { description: Requested range not satisfiable }
 */
router.get(
   '/stream/:songId',
   streamLimiter,
   authMiddleware,
   songIdValidator,
   validate,
   allowPlay,
   verifyMediaAccess('stream'),
   checkDailyLimit,
   musicController.streamSong
);

/**
 * @openapi
 * /music/history:
 *   get:
 *     summary: Get the current user's last 20 played songs
 *     tags: [Music]
 *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
 *     responses:
 *       200: { description: Play history }
 */
router.get(
   '/history',
   authMiddleware,
   musicController.getUserHistory
);

router.get(
   '/my-songs',
   authMiddleware,
   requireVerifiedArtist,
   musicController.getMySongs
);

router.get(
   '/my-albums',
   authMiddleware,
   requireVerifiedArtist,
   musicController.getMyAlbums
);

// =====================================
// 🎤 ARTIST ROUTES
// =====================================

/**
 * @openapi
 * /music/upload:
 *   post:
 *     summary: Upload a new song (verified artists only)
 *     tags: [Music]
 *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [title, music]
 *             properties:
 *               title: { type: string, minLength: 2, maxLength: 120 }
 *               music: { type: string, format: binary, description: "MP3/WAV, max 10MB" }
 *     responses:
 *       201: { description: Music created successfully }
 *       400: { description: Validation error or invalid file type }
 *       403: { description: Artist not approved/verified }
 */
router.post(
   '/upload', uploadLimiter,
   authMiddleware,
   requireVerifiedArtist,
   upload.fields([
      { name: 'music', maxCount: 1 },
      { name: 'cover', maxCount: 1 }
   ]),
   validateAudioFile,
   createSongValidation,
   validate,
   musicController.createSong
);

/**
 * @openapi
 * /music/album:
 *   post:
 *     summary: Create an album from the artist's own existing songs
 *     tags: [Music]
 *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, musics]
 *             properties:
 *               title: { type: string }
 *               musics:
 *                 type: array
 *                 items: { type: string }
 *                 description: Array of song IDs owned by the requesting artist
 *     responses:
 *       201: { description: Album created successfully }
 *       403: { description: You can only add your own songs to an album }
 *       404: { description: One or more songs not found }
 */
router.post(
   '/album',
   authMiddleware,
   requireVerifiedArtist,
   upload.fields([
      { name: 'cover', maxCount: 1 }
   ]),
   createAlbumValidation,
   validate,
   musicController.createAlbum
);

router.patch(
   '/:songId',
   authMiddleware,
   songIdValidator,
   upload.fields([
      { name: 'cover', maxCount: 1 }
   ]),
   updateSongValidation,
   validate,
   musicController.updateSong
);

router.delete(
   '/:songId',
   authMiddleware,
   songIdValidator,
   validate,
   musicController.deleteSong
);

router.patch(
   '/albums/:albumId',
   authMiddleware,
   albumIdValidator,
   upload.fields([
      { name: 'cover', maxCount: 1 }
   ]),
   updateAlbumValidation,
   validate,
   musicController.updateAlbum
);

router.delete(
   '/albums/:albumId',
   authMiddleware,
   albumIdValidator,
   validate,
   musicController.deleteAlbum
);


// =====================================
// 💳 PREMIUM ROUTES
// =====================================

/**
 * @openapi
 * /music/download/{songId}:
 *   get:
 *     summary: Download a song as an attachment (requires a plan with download access)
 *     tags: [Music]
 *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: songId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Audio file stream (Content-Disposition attachment) }
 *       403: { description: Downloads require the Pro plan or higher, or are disabled for this song }
 *       404: { description: Song not found }
 */
router.get(
   '/download/:songId',
   streamLimiter,
   authMiddleware,
   songIdValidator,
   validate,
   allowDownload,
   verifyMediaAccess('download'),
   logDownload,
   musicController.downloadSong
);


module.exports = router;