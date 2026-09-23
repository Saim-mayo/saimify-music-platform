const { MongoClient } = require('mongodb');

const sourceUri = 'mongodb://localhost:27017/spotify-clone';
const targetUri = 'mongodb+srv://saimmayo10_db_user:w5re07uiBkhWXS2Z@simify-cluster.hijif4f.mongodb.net/spotify_clone';

async function main() {
  const sourceClient = await MongoClient.connect(sourceUri);
  const targetClient = await MongoClient.connect(targetUri);

  const sourceDb = sourceClient.db('spotify-clone');
  const targetDb = targetClient.db('spotify_clone');

  // Drop the entire target database first so we replace the existing Atlas
  // data and indexes cleanly rather than attempting to merge into a partially
  // populated database that already contains conflicting unique indexes.
  await targetDb.dropDatabase();
  console.log('Dropped existing Atlas database spotify_clone');

  const collections = await sourceDb.listCollections().toArray();
  const collectionNames = collections
    .map((c) => c.name)
    .filter((name) => !name.startsWith('system.'));

  console.log('Source collections:', collectionNames);

  for (const name of collectionNames) {
    const srcColl = sourceDb.collection(name);
    const docs = await srcColl.find({}).toArray();

    console.log(`Copying ${docs.length} docs from ${name}...`);

    if (docs.length) {
      const dstColl = targetDb.collection(name);
      await dstColl.insertMany(docs, { ordered: false });
      console.log(`Inserted ${docs.length} docs into ${name}`);
    } else {
      console.log(`Collection ${name} is empty; skipped`);
    }
  }

  const targetCounts = [];
  for (const name of collectionNames) {
    targetCounts.push({
      name,
      count: await targetDb.collection(name).countDocuments(),
    });
  }

  console.log('Target counts:', JSON.stringify(targetCounts, null, 2));

  await sourceClient.close();
  await targetClient.close();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
