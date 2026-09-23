require('dotenv').config();

const { MongoClient } = require('mongodb');

const sourceUri = process.env.SOURCE_MONGO_URI || 'mongodb://localhost:27017/spotify-clone';
const targetUri = process.env.MONGO_URI;

if (!targetUri) {
   throw new Error('MONGO_URI is required for the target database');
}

const migrateCatalog = async () => {
   const sourceClient = await MongoClient.connect(sourceUri);
   const targetClient = await MongoClient.connect(targetUri);

   try {
      const sourceDb = sourceClient.db('spotify-clone');
      // Let MongoDB select the database from MONGO_URI. Railway currently
      // points the running API at its URI-selected database, not a hardcoded
      // database name.
      const targetDb = targetClient.db();

      const sourceUsers = await sourceDb.collection('users').find({}).toArray();
      const existingEmails = new Set(
         (await targetDb.collection('users').find({}, { projection: { email: 1 } }).toArray())
            .map((user) => String(user.email || '').toLowerCase())
      );
      const sourceUserIds = new Set(sourceUsers.map((user) => String(user._id)));
      const usersToInsert = sourceUsers.filter(
         (user) => !existingEmails.has(String(user.email || '').toLowerCase())
      );

      if (usersToInsert.length) {
         await targetDb.collection('users').insertMany(usersToInsert, { ordered: false });
      }

      const sourceSongs = await sourceDb.collection('musics').find({}).toArray();
      const sourceAlbums = await sourceDb.collection('albums').find({}).toArray();
      const existingSongIds = new Set(
         (await targetDb.collection('musics').find({}, { projection: { _id: 1 } }).toArray())
            .map((song) => String(song._id))
      );
      const existingAlbumIds = new Set(
         (await targetDb.collection('albums').find({}, { projection: { _id: 1 } }).toArray())
            .map((album) => String(album._id))
      );

      const songsToInsert = sourceSongs.filter(
         (song) => !existingSongIds.has(String(song._id)) && sourceUserIds.has(String(song.artist))
      );
      const albumsToInsert = sourceAlbums.filter(
         (album) => !existingAlbumIds.has(String(album._id)) && sourceUserIds.has(String(album.artist))
      );

      if (songsToInsert.length) {
         await targetDb.collection('musics').insertMany(songsToInsert, { ordered: false });
      }
      if (albumsToInsert.length) {
         await targetDb.collection('albums').insertMany(albumsToInsert, { ordered: false });
      }

      console.log(JSON.stringify({
         usersInserted: usersToInsert.length,
         songsInserted: songsToInsert.length,
         albumsInserted: albumsToInsert.length,
         totalUsers: await targetDb.collection('users').countDocuments(),
         totalSongs: await targetDb.collection('musics').countDocuments(),
         totalAlbums: await targetDb.collection('albums').countDocuments()
      }));
   } finally {
      await sourceClient.close();
      await targetClient.close();
   }
};

migrateCatalog().catch((error) => {
   console.error(error.message);
   process.exitCode = 1;
});