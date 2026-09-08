const mongoose = require('mongoose');
const Playlist = require('../models/playlist.model');
const AppError = require('../utils/appError');
const { uploadFile } = require('./storage.service');

const createPlaylistService = async ({
    title,
    userId,
    isPublic,
    cover
}) => {

    if (!title || title.trim() === '') {
        throw new AppError('Title is required', 400);
    }

    const cleanTitle = title.trim();

    // optional safety (DB index already protects)
    const existing = await Playlist.findOne({
        user: userId,
        title: cleanTitle
    });

    if (existing) {
        throw new AppError('Playlist already exists', 409);
    }

    // 🖼️ Cover is optional — user can create a playlist without one and
    // the frontend falls back to a generated placeholder (same as albums).
    let coverPayload = null;
    if (cover && cover.buffer) {
        coverPayload = await uploadFile(cover.buffer, cover.originalname, 'ytmusic-clone/playlist-covers');
    } else if (cover && cover.url) {
        coverPayload = { url: cover.url, fileId: cover.fileId || '' };
    }

    return await Playlist.create({
        title: cleanTitle,
        user: userId,
        isPublic: isPublic ?? true,
        songs: [],
        coverUrl: coverPayload?.url || '',
        coverFileId: coverPayload?.fileId || ''
    });
};

const addSongToPlaylistService = async ({
    playlistId,
    songId,
    userId
}) => {

    if (!mongoose.Types.ObjectId.isValid(playlistId)) {
        throw new AppError('Invalid playlistId', 400);
    }

    if (!mongoose.Types.ObjectId.isValid(songId)) {
        throw new AppError('Invalid songId', 400);
    }

    const playlist = await Playlist.findById(playlistId);

    if (!playlist) {
        throw new AppError('Playlist not found', 404);
    }

    if (playlist.user.toString() !== userId.toString()) {
        throw new AppError('Not allowed', 403);
    }

    // Enforce song visibility rules: only public songs can be freely added.
    // Private/unlisted songs may only be added by the artist or the song owner.
    const Music = require('../models/music.model');
    const song = await Music.findById(songId).select('visibility artist isDeleted');
    if (!song || song.isDeleted) {
        throw new AppError('Song not found', 404);
    }

    if (song.visibility !== 'public') {
        // allow if the current user is the song artist (owner)
        if (!song.artist || song.artist.toString() !== userId.toString()) {
            throw new AppError('Song is not available to add', 403);
        }
    }

    const alreadyExists = playlist.songs.some(
        (s) => s.toString() === songId.toString()
    );

    if (alreadyExists) {
        throw new AppError('Song already in playlist', 409);
    }

    playlist.songs.push(songId);
    await playlist.save();

    return playlist.populate({
        path: 'songs',
        select: 'title artist coverUrl',
        populate: { path: 'artist', select: 'username avatar' }
    });
};

const removeSongFromPlaylistService = async ({
    playlistId,
    songId,
    userId
}) => {

    if (!mongoose.Types.ObjectId.isValid(playlistId)) {
        throw new AppError('Invalid playlistId', 400);
    }

    if (!mongoose.Types.ObjectId.isValid(songId)) {
        throw new AppError('Invalid songId', 400);
    }

    const playlist = await Playlist.findById(playlistId);

    if (!playlist) {
        throw new AppError('Playlist not found', 404);
    }

    if (playlist.user.toString() !== userId.toString()) {
        throw new AppError('Not allowed', 403);
    }

    const exists = playlist.songs.some(
        (s) => s.toString() === songId.toString()
    );

    if (!exists) {
        throw new AppError('Song not in playlist', 409);
    }

    playlist.songs = playlist.songs.filter(
        id => id.toString() !== songId.toString()
    );

    await playlist.save();

    return playlist.populate({
        path: 'songs',
        select: 'title artist coverUrl',
        populate: { path: 'artist', select: 'username avatar' }
    });
};

const getMyPlaylistsService = async (userId, page = 1, limit = 20) => {
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 20;
    const filter = { user: userId };

    const [playlists, total] = await Promise.all([
        Playlist.find(filter)
            .populate({
                path: 'songs',
                select: 'title artist coverUrl',
                populate: { path: 'artist', select: 'username avatar' }
            })
            .sort({ createdAt: -1 })
            .skip((pageNum - 1) * limitNum)
            .limit(limitNum),
        Playlist.countDocuments(filter)
    ]);

    return {
        playlists,
        pagination: {
            totalItems: total,
            currentPage: pageNum,
            totalPages: Math.ceil(total / limitNum)
        }
    };
};

/**
 * =========================
 * 🔧 UPDATE PLAYLIST
 * =========================
 */
const updatePlaylistService = async ({ playlistId, userId, title, cover }) => {

    if (!mongoose.Types.ObjectId.isValid(playlistId)) {
        throw new AppError('Invalid playlistId', 400);
    }

    const playlist = await Playlist.findById(playlistId);

    if (!playlist) {
        throw new AppError('Playlist not found', 404);
    }

    if (playlist.user.toString() !== userId.toString()) {
        throw new AppError('Not allowed', 403);
    }

    if (title && String(title).trim() !== '') {
        playlist.title = String(title).trim();
    }

    if (cover && cover.buffer) {
        const coverPayload = await uploadFile(cover.buffer, cover.originalname, 'ytmusic-clone/playlist-covers');
        playlist.coverUrl = coverPayload?.url || playlist.coverUrl;
        playlist.coverFileId = coverPayload?.fileId || playlist.coverFileId;
    }

    await playlist.save();

    return await playlist.populate('songs', 'title artist coverUrl');
};

/**
 * =========================
 * 📄 GET BY ID
 * =========================
 */
const getPlaylistByIdService = async (playlistId, userId) => {

    if (!mongoose.Types.ObjectId.isValid(playlistId)) {
        throw new AppError('Invalid playlistId', 400);
    }

    const playlist = await Playlist.findById(playlistId)
        .populate({
            path: 'songs',
            select: 'title artist coverUrl',
            populate: { path: 'artist', select: 'username avatar' }
        })
        .populate('user', 'username avatar');

    if (!playlist) {
        throw new AppError('Playlist not found', 404);
    }

    // ✅ FIX: enforce privacy
    if (
        !playlist.isPublic &&
        playlist.user._id.toString() !== userId.toString()
    ) {
        throw new AppError('Unauthorized access', 403);
    }

    return playlist;
};

/**
 * =========================
 * 🗑 DELETE PLAYLIST (FIXED)
 * =========================
 */
const removePlaylistService = async (playlistId, userId, role = 'user') => {

    if (!mongoose.Types.ObjectId.isValid(playlistId)) {
        throw new AppError('Invalid playlistId', 400);
    }

    const playlist = await Playlist.findById(playlistId);

    if (!playlist) {
        throw new AppError('Playlist not found', 404);
    }

    const owner = playlist.user.toString() === userId.toString();
    if (!owner && role !== 'admin') {
        throw new AppError('Not allowed to delete this playlist', 403);
    }

    await playlist.deleteOne();

    return true;
};

module.exports = {
    createPlaylistService,
    addSongToPlaylistService,
    removeSongFromPlaylistService,
    getMyPlaylistsService,
    getPlaylistByIdService,
    updatePlaylistService,
    removePlaylistService
};