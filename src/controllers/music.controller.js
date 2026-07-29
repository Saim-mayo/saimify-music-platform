const asyncHandler = require('../utils/asyncHandler');
const axios = require('axios');
const AppError = require('../utils/appError');
const env = require('../config/env');
const logger = require('../config/logger');
const musicModel = require('../models/music.model');
const {
   createSongService,
   playSongService,
   searchSongsService,
   searchArtistsService,
   createAlbumService,
   getAllSongsService,
   getAllAlbumsService,
   getMySongsService,
   getMyAlbumsService,
   getAlbumByIdService,
   getTrendingSongsService,
   getUserHistoryService
} = require('../services/music.service');

const {
   getInternalFileUrl
} = require('../services/storage.service');
const {
   recordDownload,
   getUserDownloads

} = require('../services/download.service');
const CHUNK_SIZE = 1024 * 1024;
// =====================================
// 🎯 SECURE AUDIO DELIVERY ENGINE (FIXED)
// =====================================
const handleAudioDelivery = async (req, res, mode = 'stream') => {


   // ===============================
   // 🔒 VALIDATE SONG
   // ===============================
   const song = req.song;

   if (!song) {
      throw new AppError('Song not found', 404);
   }

   if (!song.filePath) {
      throw new AppError('File path missing', 400);
   }



   // ===============================
   // 🔐 GENERATE SIGNED URL
   // ===============================
   const mediaUrl = getInternalFileUrl(song.filePath);

   // ===============================
   // 🔒 SSRF PROTECTION (SIMPLE + STRONG)
   // ===============================
   const mediaHost = new URL(mediaUrl).hostname;
   const allowedHost = new URL(
      env.IMAGE_KIT_URL_ENDPOINT
   ).hostname;

   if (mediaHost !== allowedHost) {
      throw new AppError('Invalid file source', 400);
   }

   // =====================================
   // ⬇ DOWNLOAD MODE
   // =====================================
   if (mode === "download") {

      const response = await axios({
         method: "GET",
         url: mediaUrl,
         responseType: "stream"
      });

      // Strip characters that could break out of the quoted filename
      // (double quotes, CR/LF) — song.title has no character restriction
      // at the validator level, so this must not be trusted verbatim in
      // a header value. RFC 5987 filename* covers non-ASCII titles.
      const safeTitle = song.title.replace(/["\r\n]/g, '');
      const encodedTitle = encodeURIComponent(song.title.replace(/[\r\n]/g, ''));

      const contentLength = response?.headers?.['content-length'];

      const headers = {
         "Content-Type": "application/octet-stream",
         "Content-Disposition":
            `attachment; filename="${safeTitle}.mp3"; filename*=UTF-8''${encodedTitle}.mp3`,
         "Cache-Control": "private, no-store",
         "X-Content-Type-Options": "nosniff"
      };

      if (contentLength) {
         headers['Content-Length'] = contentLength;
      }

      res.writeHead(200, headers);

      response.data.pipe(res);

      return await new Promise((resolve, reject) => {
         response.data.on('end', resolve);
         response.data.on('close', resolve);
         response.data.on('error', reject);
         res.on('error', reject);
      });
   }

   // =====================================
   // 🎧 STREAM MODE
   // =====================================

   const range = req.headers.range;

   if (!range) {
      throw new AppError('Range header required', 416);
   }

   // Allow: bytes=0-   bytes=0-100   bytes=500-1000
   if (!/^bytes=\d+-\d*$/.test(range)) {
      throw new AppError('Invalid range header', 400);
   }

   // FIX: Explicitly match and capture the start and end byte positions
   const match = range.match(/^bytes=(\d+)-(\d*)$/);

   const start = Number(match[1]);

   const requestedEnd = match[2]
      ? Number(match[2])
      : null;

   // Prefer the size cached on the Music document at upload time — avoids
   // an axios.head() round trip on every single Range request during
   // seek-heavy playback. Fall back to a HEAD request for songs uploaded
   // before this field existed (song.fileSize is null/undefined).
   let fileSize = song.fileSize;

   if (!fileSize) {
      const head = await axios.head(mediaUrl, {
         timeout: 10000,
         validateStatus: status => status < 500
      });
      fileSize = parseInt(head.headers['content-length'], 10);
   }

   if (!fileSize) {
      throw new AppError('Unable to determine file size', 500);
   }

   if (start >= fileSize) {
      throw new AppError('Requested range not satisfiable', 416);
   }

   const end =
      requestedEnd !== null
         ? Math.min(requestedEnd, fileSize - 1)
         : Math.min(start + CHUNK_SIZE - 1, fileSize - 1);

   const contentLength = end - start + 1;

   res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': contentLength,
      'Content-Type': 'audio/mpeg'
   });

   const stream = await axios({
      method: 'GET',
      url: mediaUrl,
      responseType: 'stream',
      timeout: 10000,
      headers: {
         Range: `bytes=${start}-${end}`
      }
   });

   stream.data.on('error', (err) => {
      logger.error({ err }, 'Audio stream error');
      res.destroy(err);
   });

   stream.data.pipe(res);

   // No need to await the response lifecycle here; the Express route
   // completes once the stream is piped and the request/response
   // object stays open until the client closes the connection.
   return;

   // Close handleAudioDelivery
};

// =====================================
// 🎵 CREATE SONG
// =====================================
const createSong = asyncHandler(async (req, res) => {

   const audioFile = req.files?.music?.[0];
   const coverFile = req.files?.cover?.[0];

   if (!audioFile) {
      throw new AppError('Audio file is required', 400);
   }

   const music = await createSongService({
      title: req.body.title,
      file: audioFile,
      userId: req.user.userId,
      cover: coverFile,
      status: req.body.status,
      visibility: req.body.visibility,
      premiumOnly: req.body.premiumOnly,
      allowDownload: req.body.allowDownload
   });

   return res.status(201).json({
      message: 'Music created successfully',
      music
   });
});

// =====================================
// ▶ PLAY SONG
// =====================================
const playSong = asyncHandler(async (req, res) => {

   const song = await playSongService({
      songId: req.params.songId,
      userId: req.user.userId
   });

   return res.status(200).json({
      message: 'Song played',
      playCount: song.playCount
   });
});

// =====================================
// 🎧 STREAM SONG
// =====================================
const streamSong = asyncHandler(async (req, res) => {
   return handleAudioDelivery(req, res, 'stream');
});

// =====================================
// 📥 DOWNLOAD SONG
// =====================================
const downloadSong = asyncHandler(async (req, res) => {

   await recordDownload({

      user: req.user,

      songId: req.song._id,

      ipAddress: req.ip,

      userAgent: req.get('user-agent') || ''

   });

   return handleAudioDelivery(req, res, 'download');

});

// =====================================
// 🔍 SEARCH SONGS
// =====================================
const searchSongs = asyncHandler(async (req, res) => {

   const query = (req.query.q || '').trim();

   if (!query) {
      throw new AppError('Search query required', 400);
   }

   const songs = await searchSongsService(query);

   return res.status(200).json({
      total: songs.length,
      results: songs
   });
});

// =====================================
// 👤 SEARCH ARTISTS
// =====================================
const searchArtists = asyncHandler(async (req, res) => {

   const query = (req.query.q || '').trim();

   if (!query) {
      throw new AppError('Search query required', 400);
   }

   const artists = await searchArtistsService(query);

   return res.status(200).json({
      total: artists.length,
      results: artists
   });
});

// =====================================
// 💿 CREATE ALBUM
// =====================================
const createAlbum = asyncHandler(async (req, res) => {

   let musics = req.body.musics;
   if (typeof musics === 'string') {
      try {
         const parsed = JSON.parse(musics);
         musics = parsed;
      } catch {
         musics = musics.split(',').map((item) => item.trim()).filter(Boolean);
      }
   }

   if (!Array.isArray(musics)) {
      musics = [musics].filter(Boolean);
   }

   const coverFile = req.files?.cover?.[0] || req.file || req.body.cover;

   const album = await createAlbumService({
      title: req.body.title,
      musics,
      userId: req.user.userId,
      cover: coverFile,
      status: req.body.status,
      visibility: req.body.visibility
   });

   return res.status(201).json({
      message: 'Album created successfully',
      album
   });
});

// =====================================
// 📀 SONGS BY ARTIST
// =====================================
const getSongsByArtist = asyncHandler(async (req, res) => {

   const songs = await musicModel
      .find({
         artist: req.params.artistId,
         status: 'active',
         isDeleted: false,
         deletedAt: null
      })
      .populate('artist', 'username avatar')
      .sort({ createdAt: -1 })
      .limit(24)
      .lean();

   const normalizedSongs = songs
      .map((song) => {
         const artistDoc = song.artist && typeof song.artist === 'object' ? song.artist : null;
         const fallbackArtistName = song.artistName || song.artist?.username || song.artist?.name || 'Unknown artist';
         const artistName = artistDoc?.username || artistDoc?.name || fallbackArtistName || 'Unknown artist';
         const title = typeof song.title === 'string' ? song.title.trim() : '';
         const normalizedTitle = title.replace(/\s+/g, ' ').trim();
         const placeholderTitle = normalizedTitle.toLowerCase() === 'song';
         const normalizedArtistName = artistName.replace(/\s+/g, ' ').trim() || 'Unknown artist';

         return {
            ...song,
            title: normalizedTitle || null,
            artist: artistDoc
               ? {
                    ...artistDoc,
                    username: normalizedArtistName,
                    name: normalizedArtistName,
                 }
               : null,
            artistName: normalizedArtistName,
            artistId: artistDoc?._id || song.artist || null,
            isPlaceholderTitle: placeholderTitle,
         };
      })
      .filter((song) => song.title && !song.isPlaceholderTitle);

   const seen = new Set();
   const dedupedSongs = normalizedSongs.filter((song) => {
      const normalizedTitleKey = (song.title || '')
         .toLowerCase()
         .replace(/[^a-z0-9]+/g, ' ')
         .trim();
      const normalizedArtistKey = (song.artistName || '')
         .toLowerCase()
         .replace(/[^a-z0-9]+/g, ' ')
         .trim();
      const key = `${normalizedTitleKey}::${normalizedArtistKey}`;
      if (seen.has(key)) {
         return false;
      }
      seen.add(key);
      return true;
   });

   return res.status(200).json({
      message: 'Artist songs fetched successfully',
      songs: dedupedSongs
   });
});

// =====================================
// 📀 ALL SONGS
// =====================================
const getAllSongs = asyncHandler(async (req, res) => {

   const songs = await getAllSongsService({
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 10
   });

   return res.status(200).json({
      message: 'Songs fetched successfully',
      songs
   });
});

// =====================================
// 📀 ALL ALBUMS
// =====================================
const getAllAlbums = asyncHandler(async (req, res) => {

   const albums = await getAllAlbumsService({
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 10
   });

   return res.status(200).json({
      message: 'Albums fetched successfully',
      albums
   });
});

// =====================================
// 📀 ALBUM BY ID
// =====================================
const getAlbumById = asyncHandler(async (req, res) => {

   const album = await getAlbumByIdService(req.params.albumId);

   return res.status(200).json({
      message: 'Album fetched successfully',
      album
   });
});

// =====================================
// 🔥 TRENDING SONGS
// =====================================
const getTrendingSongs = asyncHandler(async (req, res) => {

   const songs = await getTrendingSongsService();

   return res.status(200).json({
      total: songs.length,
      songs
   });
});

// =====================================
// 📜 USER HISTORY
// =====================================
const getUserHistory = asyncHandler(async (req, res) => {

   const history = await getUserHistoryService(req.user.userId);

   return res.status(200).json({
      total: history.length,
      history
   });
});

// =====================================
// 📀 MY SONGS
// =====================================
const getMySongs = asyncHandler(async (req, res) => {

   const songs = await getMySongsService({
      userId: req.user.userId,
      page: parseInt(req.query.page, 10) || 1,
      limit: parseInt(req.query.limit, 10) || 20
   });

   return res.status(200).json({
      message: 'Artist songs fetched successfully',
      songs: songs.songs,
      pagination: songs.pagination
   });
});

// =====================================
// 📀 MY ALBUMS
// =====================================
const getMyAlbums = asyncHandler(async (req, res) => {

   const albums = await getMyAlbumsService({
      userId: req.user.userId,
      page: parseInt(req.query.page, 10) || 1,
      limit: parseInt(req.query.limit, 10) || 20
   });

   return res.status(200).json({
      message: 'Artist albums fetched successfully',
      albums: albums.albums,
      pagination: albums.pagination
   });
});

// =====================================
// 📥 USER DOWNLOAD HISTORY
// =====================================
const getMyDownloads = asyncHandler(async (req, res) => {

   const downloads = await getUserDownloads(req.user.userId);

   return res.status(200).json({

      total: downloads.length,

      downloads

   });

});
// =====================================
// EXPORTS
// =====================================
module.exports = {
   createSong,
   playSong,
   streamSong,
   downloadSong,
   searchSongs,
   searchArtists,
   createAlbum,
   getSongsByArtist,
   getAllSongs,
   getAllAlbums,
   getMySongs,
   getMyAlbums,
   getAlbumById,
   getTrendingSongs,
   getUserHistory,
   getMyDownloads
};