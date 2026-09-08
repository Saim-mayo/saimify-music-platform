require('dotenv').config();
const env = require('../config/env');
const mongoose = require('mongoose');

const Music = require('../models/music.model');

async function main() {
  try {
    if (env.NODE_ENV === 'production') throw new Error('This script is for dev only');
    await mongoose.connect(env.MONGO_URI);
    console.log('✅ Connected to Mongo');

    const sampleMp3 = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';

    const res = await Music.updateMany(
      { $or: [ { fileId: { $regex: '^demo-' } }, { filePath: /ik.imagekit.io\/test/ } ] },
      { $set: { filePath: sampleMp3, fileSize: 1024, processingFinished: true } }
    );

    console.log(`✅ Updated ${res.modifiedCount || res.nModified || 0} demo music records`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed:', err && err.message ? err.message : err);
    process.exit(1);
  }
}

main();
