const mongoose = require('mongoose');

const musicModel = require('../models/music.model');
const albumModel = require('../models/album.model');
const HistoryModel = require('../models/history.model');
const userModel = require('../models/user.model');
const AppError = require('../utils/appError');
const { uploadFile } = require('./storage.service');

const getSongById = async (songId) => {

   if (!mongoose.Types.ObjectId.isValid(songId)) {
      throw new AppError('Invalid song id', 400);
   }

   const song = await musicModel
      .findOne({
         _id: songId,
         deletedAt: null,
         status: 'active'
      });

   if (!song) {
      throw new AppError('Song not found', 404);
   }

   return song;
};

const escapeRegex = (text) => {
   return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const { normalizeGenre } = require('../constants/musicGenres');

const createSongService = async ({ title, file, userId, cover, status = 'active', visibility = 'public', premiumOnly = false, allowDownload = true, genre = null }) => {

   if (!title || title.trim() === '') {
      throw new AppError('Title is required', 400);
   }

   if (!file || !file.buffer) {
      throw new AppError('Valid audio file is required', 400);
   }

   const validStatuses = ['processing', 'active', 'disabled'];
   if (!validStatuses.includes(status)) {
      throw new AppError('Invalid song status', 400);
   }

   const validVisibilities = ['public', 'private', 'unlisted'];
   if (!validVisibilities.includes(visibility)) {
      throw new AppError('Invalid visibility option', 400);
   }

   const normalizedGenre = normalizeGenre(genre);

   // Pass the raw Buffer.
   const result = await uploadFile(
      file.buffer,
      file.originalname 
   );

   if (!result || !result.filePath) {
      throw new AppError('File upload failed', 500);
   }

   const coverPayload = cover && cover.buffer ? await uploadFile(cover.buffer, cover.originalname, 'ytmusic-clone/covers') : null

   return await musicModel.create({
      fileId: result.fileId,
      filePath: result.filePath,
      fileSize: result.fileSize || null,
      title: title.trim(),
      artist: userId,
      coverUrl: coverPayload?.url || '',
      coverFileId: coverPayload?.fileId || '',
      genre: normalizedGenre,

      status,
      visibility,
      premiumOnly: Boolean(premiumOnly),
      allowDownload: Boolean(allowDownload),
      processingFinished: status !== 'processing'
   });
};

const playSongService = async ({ songId, userId }) => {

   const song = await getSongById(songId);

   song.playCount += 1;
   await song.save();

   await HistoryModel.updateOne(
      { user: userId, song: song._id },
      { $set: { playedAt: new Date() } },
      { upsert: true }
   );

   return song;
};

const searchSongsService = async (q, genre = null) => {

   const trimmedQuery = (q || '').trim();
   const normalizedGenre = normalizeGenre(genre);

   if (!trimmedQuery && !normalizedGenre) {
      throw new AppError('Search query is required', 400);
   }

   const filter = {
      status: 'active',
      deletedAt: null,
      visibility: 'public'
   };

   if (trimmedQuery) {
      const safeQuery = escapeRegex(trimmedQuery);
      filter.title = { $regex: safeQuery, $options: 'i' };
   }

   if (normalizedGenre) {
      filter.genre = { $regex: `^${escapeRegex(normalizedGenre)}$`, $options: 'i' };
      if (trimmedQuery && trimmedQuery.toLowerCase() === normalizedGenre.toLowerCase()) {
         delete filter.title;
      }
   }

   return await musicModel
      .find(filter)
      .populate('artist', 'username avatar') // ✅ NO EMAIL
      .limit(20)
      .lean();
};

// =====================================
// 👤 SEARCH ARTISTS (SECURE)
// =====================================
const searchArtistsService = async (q) => {

   if (!q || q.trim() === '') {
      throw new AppError('Search query is required', 400);
   }

   const safeQuery = escapeRegex(q.trim());

   return await userModel.find({
      username: { $regex: safeQuery, $options: 'i' },
      role: 'artist'
   })
      .select('username avatar bio')
      .limit(20)
      .lean();
};

// =====================================
// 💿 CREATE ALBUM
// =====================================
const createAlbumService = async ({ title, musics, userId, cover, status = 'active', visibility = 'public', genre = null }) => {

   if (!title || title.trim() === '') {
      throw new AppError('Title is required', 400);
   }

   if (!Array.isArray(musics)) {
      throw new AppError('Musics must be an array', 400);
   }

   if (musics.length === 0) {
      throw new AppError('Album must contain at least one song', 400);
   }

   const validStatuses = ['processing', 'active', 'disabled'];
   if (!validStatuses.includes(status)) {
      throw new AppError('Invalid album status', 400);
   }

   const validVisibilities = ['public', 'private'];
   if (!validVisibilities.includes(visibility)) {
      throw new AppError('Invalid album visibility option', 400);
   }

   const normalizedGenre = normalizeGenre(genre);

   const songs = await musicModel.find({
      _id: { $in: musics }
   }) || [];

   if (songs.length !== musics.length) {
      throw new AppError('One or more songs not found', 404);
   }

   const foreignSong = songs.find(
      song => song.artist.toString() !== userId.toString()
   );

   if (foreignSong) {
      throw new AppError(
         'You can only add your own songs to an album',
         403
      );
   }

   let coverPayload = null;
   if (cover && cover.buffer) {
      coverPayload = await uploadFile(cover.buffer, cover.originalname, 'ytmusic-clone/covers');
   } else if (cover && cover.url) {
      coverPayload = { url: cover.url, fileId: cover.fileId || '' };
   }

   return await albumModel.create({
      title: title.trim(),
      artist: userId,
      musics,
      coverUrl: coverPayload?.url || '',
      coverFileId: coverPayload?.fileId || '',
      genre: normalizedGenre,
      status,
      visibility
   });
};

// =====================================
// � UPDATE SONG
// =====================================
const updateSongService = async ({ songId, userId, role, title, visibility, premiumOnly, allowDownload, genre, cover }) => {
   if (!mongoose.Types.ObjectId.isValid(songId)) {
      throw new AppError('Invalid song id', 400);
   }

   const song = await musicModel.findById(songId);
   if (!song) {
      throw new AppError('Song not found', 404);
   }

   const owner = song.artist.toString() === userId.toString();
   if (!owner && role !== 'admin') {
      throw new AppError('Not allowed to update this song', 403);
   }

   const normalizedGenre = normalizeGenre(genre);

   if (typeof title === 'string' && title.trim() !== '') {
      song.title = title.trim();
   }

   if (visibility) {
      const validVisibilities = ['public', 'private', 'unlisted'];
      if (!validVisibilities.includes(visibility)) {
         throw new AppError('Invalid visibility option', 400);
      }
      song.visibility = visibility;
   }

   if (typeof premiumOnly !== 'undefined') {
      song.premiumOnly = premiumOnly === 'true' || premiumOnly === true;
   }

   if (typeof allowDownload !== 'undefined') {
      song.allowDownload = allowDownload === 'true' || allowDownload === true;
   }

   if (genre !== undefined) {
      song.genre = normalizedGenre;
   }

   if (cover && cover.buffer) {
      const coverPayload = await uploadFile(cover.buffer, cover.originalname, 'ytmusic-clone/covers');
      song.coverUrl = coverPayload?.url || song.coverUrl;
      song.coverFileId = coverPayload?.fileId || song.coverFileId;
   }

   await song.save();
   return song;
};

// =====================================
// 🗑 DELETE SONG
// =====================================
const deleteSongService = async ({ songId, userId, role }) => {
   if (!mongoose.Types.ObjectId.isValid(songId)) {
      throw new AppError('Invalid song id', 400);
   }

   const song = await musicModel.findById(songId);
   if (!song) {
      throw new AppError('Song not found', 404);
   }

   const owner = song.artist.toString() === userId.toString();
   if (!owner && role !== 'admin') {
      throw new AppError('Not allowed to delete this song', 403);
   }

   song.isDeleted = true;
   song.deletedAt = new Date();
   song.status = 'disabled';
   await song.save();
   return song;
};

// =====================================
// 🛠 UPDATE ALBUM
// =====================================
const updateAlbumService = async ({ albumId, userId, role, title, visibility, genre, cover }) => {
   if (!mongoose.Types.ObjectId.isValid(albumId)) {
      throw new AppError('Invalid album id', 400);
   }

   const album = await albumModel.findById(albumId);
   if (!album) {
      throw new AppError('Album not found', 404);
   }

   const owner = album.artist.toString() === userId.toString();
   if (!owner && role !== 'admin') {
      throw new AppError('Not allowed to update this album', 403);
   }

   if (typeof title === 'string' && title.trim() !== '') {
      album.title = title.trim();
   }

   if (visibility) {
      const validVisibilities = ['public', 'private'];
      if (!validVisibilities.includes(visibility)) {
         throw new AppError('Invalid album visibility option', 400);
      }
      album.visibility = visibility;
   }

   if (genre !== undefined) {
      album.genre = normalizeGenre(genre);
   }

   if (cover && cover.buffer) {
      const coverPayload = await uploadFile(cover.buffer, cover.originalname, 'ytmusic-clone/covers');
      album.coverUrl = coverPayload?.url || album.coverUrl;
      album.coverFileId = coverPayload?.fileId || album.coverFileId;
   }

   await album.save();
   return album;
};

// =====================================
// 🗑 DELETE ALBUM
// =====================================
const deleteAlbumService = async ({ albumId, userId, role }) => {
   if (!mongoose.Types.ObjectId.isValid(albumId)) {
      throw new AppError('Invalid album id', 400);
   }

   const album = await albumModel.findById(albumId);
   if (!album) {
      throw new AppError('Album not found', 404);
   }

   const owner = album.artist.toString() === userId.toString();
   if (!owner && role !== 'admin') {
      throw new AppError('Not allowed to delete this album', 403);
   }

   album.isDeleted = true;
   album.deletedAt = new Date();
   album.status = 'disabled';
   await album.save();
   return album;
};

// =====================================
// �📀 GET ALL SONGS (FIXED WITH FILTER)
// =====================================
const getAllSongsService = async ({ page = 1, limit = 20 }) => {

   const pageNum = Number(page) || 1;
   const limitNum = Number(limit) || 20;

   // === FIX START: Applied exact matching criteria filter to both find and count operations ===
   const filter = {
      status: 'active',
      deletedAt: null,
      visibility: 'public'
   };

   const [songs, total] = await Promise.all([
      musicModel
         .find(filter)
         .populate('artist', 'username avatar')
         .sort({ createdAt: -1 })
         .skip((pageNum - 1) * limitNum)
         .limit(limitNum),

      musicModel.countDocuments(filter) // ← FIX: counts ONLY matching active songs
   ]);
   // === FIX END ===

   return {
      songs,
      pagination: {
         totalItems: total,
         currentPage: pageNum,
         totalPages: Math.ceil(total / limitNum)
      }
   };
};

// =====================================
// 📀 GET ALL ALBUMS (FIXED WITH FILTER)
// =====================================
const getAllAlbumsService = async ({ page = 1, limit = 20 }) => {

   const pageNum = Number(page) || 1;
   const limitNum = Number(limit) || 20;

   // === FIX START: Applied exact matching criteria filter to both find and count operations ===
   const filter = {
      status: 'active',
      deletedAt: null
   };

   const [albums, total] = await Promise.all([
      albumModel
         .find(filter)
         .populate('artist', 'username avatar')
         .populate('musics', 'title coverUrl')
         .sort({ createdAt: -1 })
         .skip((pageNum - 1) * limitNum)
         .limit(limitNum),

      albumModel.countDocuments(filter) // ← FIX: counts ONLY matching active albums
   ]);
   // === FIX END ===

   return {
      albums,
      pagination: {
         totalItems: total,
         currentPage: pageNum,
         totalPages: Math.ceil(total / limitNum)
      }
   };
};

// =====================================
// 📀 GET MY SONGS
// =====================================
const getMySongsService = async ({ userId, page = 1, limit = 20 }) => {

   const pageNum = Number(page) || 1;
   const limitNum = Number(limit) || 20;

   const filter = {
      status: 'active',
      deletedAt: null,
      artist: userId
   };

   const [songs, total] = await Promise.all([
      musicModel
         .find(filter)
         .populate('artist', 'username avatar')
         .sort({ createdAt: -1 })
         .skip((pageNum - 1) * limitNum)
         .limit(limitNum),

      musicModel.countDocuments(filter)
   ]);

   return {
      songs,
      pagination: {
         totalItems: total,
         currentPage: pageNum,
         totalPages: Math.ceil(total / limitNum)
      }
   };
};

// =====================================
// 📀 GET MY ALBUMS
// =====================================
const getMyAlbumsService = async ({ userId, page = 1, limit = 20 }) => {

   const pageNum = Number(page) || 1;
   const limitNum = Number(limit) || 20;

   const filter = {
      status: 'active',
      deletedAt: null,
      artist: userId
   };

   const [albums, total] = await Promise.all([
      albumModel
         .find(filter)
         .populate('artist', 'username avatar')
         .populate('musics', 'title coverUrl')
         .sort({ createdAt: -1 })
         .skip((pageNum - 1) * limitNum)
         .limit(limitNum),

      albumModel.countDocuments(filter)
   ]);

   return {
      albums,
      pagination: {
         totalItems: total,
         currentPage: pageNum,
         totalPages: Math.ceil(total / limitNum)
      }
   };
};

// =====================================
// 📀 GET ALBUM BY ID
// =====================================
const getAlbumByIdService = async (albumId) => {

   if (!mongoose.Types.ObjectId.isValid(albumId)) {
      throw new AppError('Invalid albumId', 400);
   }

   const album = await albumModel.findById(albumId)
      .populate('artist', 'username avatar')
      .populate({
         path: 'musics',
         select: 'title artist playCount coverUrl duration',
         populate: { path: 'artist', select: 'username avatar' }
      });

   if (!album) {
      throw new AppError('Album not found', 404);
   }

   return album;
};

// =====================================
// 🔥 TRENDING SONGS
// =====================================
const getTrendingSongsService = async () => {

   return await musicModel
      .find({
         status: 'active',
         visibility: 'public',
         isDeleted: false,
         deletedAt: null
      })
      .sort({ playCount: -1 })
      .limit(20)
      .populate('artist', 'username')
      .lean();
};

// =====================================
// 📜 USER HISTORY
// =====================================
const getUserHistoryService = async (userId) => {

   const history = await HistoryModel
      .find({ user: userId })
      .sort({ playedAt: -1, createdAt: -1 })
      .limit(50)
      .populate({
         path: 'song',
         select: 'title artist coverUrl duration',
         populate: { path: 'artist', select: 'username avatar' }
      });

   const songIds = history
      .map((entry) => entry?.song?._id)
      .filter(Boolean);
   let albumQuery = songIds.length
      ? albumModel.find({ musics: { $in: songIds }, isDeleted: false })
      : null;
   if (albumQuery?.select) {
      albumQuery = albumQuery.select('title musics');
   }
   const albums = albumQuery ? await albumQuery.lean() : [];
   const albumBySongId = new Map();
   albums.forEach((album) => {
      (album.musics || []).forEach((songId) => {
         albumBySongId.set(String(songId), album.title);
      });
   });

   const latestBySong = new Map()

   for (const entry of history) {
      const songId = entry?.song?._id?.toString?.() || entry?.song?.id || entry?.song
      if (!songId) {
         continue
      }

      const current = latestBySong.get(songId)
      if (!current) {
         latestBySong.set(songId, entry)
         continue
      }

      const currentPlayedAt = new Date(current?.playedAt || 0).getTime()
      const nextPlayedAt = new Date(entry?.playedAt || 0).getTime()
      if (nextPlayedAt > currentPlayedAt) {
         latestBySong.set(songId, entry)
      }
   }

   return Array.from(latestBySong.values())
      .sort((left, right) => {
         const leftPlayedAt = new Date(left?.playedAt || 0).getTime()
         const rightPlayedAt = new Date(right?.playedAt || 0).getTime()
         return rightPlayedAt - leftPlayedAt
      })
      .slice(0, 20)
      .map((entry) => {
         const serialized = entry.toObject ? entry.toObject() : entry;
         const songId = serialized?.song?._id ? String(serialized.song._id) : '';
         return {
            ...serialized,
            song: serialized.song
               ? { ...serialized.song, albumTitle: albumBySongId.get(songId) || null }
               : serialized.song
         };
      });
};

// =====================================
// EXPORTS
// =====================================
module.exports = {
   getSongById,
   createSongService,
   updateSongService,
   deleteSongService,
   playSongService,
   searchSongsService,
   searchArtistsService,
   createAlbumService,
   updateAlbumService,
   deleteAlbumService,
   getAllSongsService,
   getAllAlbumsService,
   getMySongsService,
   getMyAlbumsService,
   getAlbumByIdService,
   getTrendingSongsService,
   getUserHistoryService
};