const express = require('express');
const router = express.Router();

const queueController = require('../controllers/queue.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const {
   addToQueueValidator,
   setQueueValidator,
   toggleShuffleValidator,
   toggleRepeatValidator
} = require('../validators/queue.validator');

/**
 * @openapi
 * /queue/add:
 *   post:
 *     summary: Add a song to the current user's playback queue
 *     tags: [Queue]
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
 *       200: { description: Song added to queue }
 */
// ➕ add song
router.post(
   '/add',
   authMiddleware,
   addToQueueValidator,
   validate,
   queueController.addToQueue
);

/**
 * @openapi
 * /queue/shuffle:
 *   post:
 *     summary: Toggle shuffle mode for the current user's queue
 *     tags: [Queue]
 *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
 *     responses:
 *       200: { description: Shuffle mode toggled }
 */
// 🔀 shuffle
router.post(
   '/shuffle',
   authMiddleware,
   toggleShuffleValidator,
   validate,
   queueController.toggleShuffle
);

router.post(
   '/set',
   authMiddleware,
   setQueueValidator,
   validate,
   queueController.setQueue
);

/**
 * @openapi
 * /queue/repeat:
 *   post:
 *     summary: Toggle repeat mode for the current user's queue
 *     tags: [Queue]
 *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
 *     responses:
 *       200: { description: Repeat mode toggled }
 */
// 🔁 repeat
router.post(
   '/repeat',
   authMiddleware,
   toggleRepeatValidator,
   validate,
   queueController.toggleRepeat
);

/**
 * @openapi
 * /queue/current:
 *   get:
 *     summary: Get the currently playing song in the queue
 *     tags: [Queue]
 *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
 *     responses:
 *       200: { description: Current song }
 */
/**
 * @openapi
 * /queue/next:
 *   post:
 *     summary: Advance to the next song in the queue
 *     tags: [Queue]
 *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
 *     responses:
 *       200: { description: Advanced to next song }
 */
/**
 * @openapi
 * /queue/prev:
 *   post:
 *     summary: Go back to the previous song in the queue
 *     tags: [Queue]
 *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
 *     responses:
 *       200: { description: Moved to previous song }
 */
/**
 * @openapi
 * /queue/all:
 *   get:
 *     summary: Get all songs currently in the user's queue
 *     tags: [Queue]
 *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
 *     responses:
 *       200: { description: Full queue }
 */
/**
 * @openapi
 * /queue/clear:
 *   delete:
 *     summary: Clear the current user's queue
 *     tags: [Queue]
 *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
 *     responses:
 *       200: { description: Queue cleared }
 */
// others remain same
router.get('/current', authMiddleware, queueController.getCurrentSong);
router.post('/next', authMiddleware, queueController.nextSong);
router.post('/prev', authMiddleware, queueController.prevSong);
router.get('/all', authMiddleware, queueController.allSongs);
router.delete('/clear', authMiddleware, queueController.clearQueue);

module.exports = router;
