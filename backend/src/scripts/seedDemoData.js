require('dotenv').config();
const env = require('../config/env');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const User = require('../models/user.model');
const Album = require('../models/album.model');
const Music = require('../models/music.model');

async function seed() {
  try {
    if (env.NODE_ENV === 'production') throw new Error('Seeding disabled in production');

    await mongoose.connect(env.MONGO_URI);
    console.log('✅ MongoDB Connected');

    // 1) Create or reuse an artist user
    const artistEmail = 'demo-artist@example.com';
    let artist = await User.findOne({ email: artistEmail });
    if (!artist) {
      const hashed = await bcrypt.hash('Password123!', 10);
      artist = await User.create({
        username: 'demo_artist',
        email: artistEmail,
        password: hashed,
        role: 'artist',
        artistVerification: { status: 'approved', isVerified: true },
        isEmailVerified: true,
      });
      console.log('🎸 Created demo artist:', artist.email);
    } else {
      console.log('ℹ️ Demo artist exists:', artist.email);
    }

    // 2) Create an album
    const albumTitle = 'Demo Album';
    let album = await Album.findOne({ title: albumTitle, artist: artist._id });
    if (!album) {
      album = await Album.create({
        title: albumTitle,
        artist: artist._id,
        coverUrl: 'https://ik.imagekit.io/test/cover.jpg',
        status: 'active',
        visibility: 'public'
      });
      console.log('💿 Created demo album');
    } else {
      console.log('ℹ️ Demo album exists');
    }

    // 3) Create some music records
    const songs = [
      { title: 'Demo Track 1', filename: 'demo1.mp3' },
      { title: 'Demo Track 2', filename: 'demo2.mp3' },
      { title: 'Demo Track 3', filename: 'demo3.mp3' },
    ];

    // Public sample MP3 used for local dev so streaming/download endpoints succeed
    const sampleMp3 = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';

    for (const s of songs) {
      const exists = await Music.findOne({ title: s.title, artist: artist._id });
      if (exists) {
        console.log('ℹ️ Song exists:', s.title);
        continue;
      }

      const m = await Music.create({
        title: s.title,
        artist: artist._id,
        fileId: `demo-${s.filename}`,
        filePath: sampleMp3,
        fileSize: 1024,
        coverUrl: 'https://ik.imagekit.io/test/cover.jpg',
        status: 'active',
        visibility: 'public',
        processingFinished: true
      });

      // attach to album
      album.musics.push(m._id);
      console.log('♪ Created song:', s.title);
    }

    await album.save();

    console.log('✅ Demo data seeded');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err && err.message ? err.message : err);
    process.exit(1);
  }
}

seed();
