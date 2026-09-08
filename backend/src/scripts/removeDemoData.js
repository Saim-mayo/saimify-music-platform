require('dotenv').config();
const env = require('../config/env');
const mongoose = require('mongoose');

const User = require('../models/user.model');
const Album = require('../models/album.model');
const Music = require('../models/music.model');

async function main() {
  try {
    if (env.NODE_ENV === 'production') throw new Error('This script is for dev only');
    await mongoose.connect(env.MONGO_URI);
    console.log('✅ Connected to Mongo');

    // Remove demo music records
    const musicFilter = {
      $or: [
        { fileId: { $regex: '^demo-' } },
        { title: { $regex: '^Demo Track' } },
        { coverUrl: /ik.imagekit.io\/test/ }
      ]
    };

    const musicRes = await Music.deleteMany(musicFilter);
    console.log(`🗑️ Deleted ${musicRes.deletedCount || musicRes.n || 0} demo music records`);

    // Remove demo albums
    const albumFilter = {
      $or: [
        { title: 'Demo Album' },
        { coverUrl: /ik.imagekit.io\/test/ }
      ]
    };
    const albumRes = await Album.deleteMany(albumFilter);
    console.log(`🗑️ Deleted ${albumRes.deletedCount || albumRes.n || 0} demo albums`);

    // Remove demo user/artist
    const userFilter = { $or: [ { email: 'demo-artist@example.com' }, { username: 'demo_artist' } ] };
    const userRes = await User.deleteMany(userFilter);
    console.log(`🗑️ Deleted ${userRes.deletedCount || userRes.n || 0} demo users`);

    await mongoose.disconnect();
    console.log('✅ Disconnected from Mongo');
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed:', err && err.message ? err.message : err);
    try { await mongoose.disconnect(); } catch {}
    process.exit(1);
  }
}

main();
