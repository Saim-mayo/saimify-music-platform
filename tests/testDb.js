const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

const MONGO_LAUNCH_TIMEOUT_MS = 180000;
const MONGO_CONNECT_TIMEOUT_MS = 120000;

let mongod;

/**
 * Spins up a real (in-memory) single-node MongoDB REPLICA SET and
 * connects mongoose to it. A plain standalone MongoMemoryServer cannot
 * run multi-document transactions — and this app's payment/webhook code
 * (withTransactionRetry, see src/utils/mongoTransaction.js) depends on
 * them — so a replica set is required here, not just "nice to have".
 * Using a real mongod binary rather than a mock still means Mongoose
 * validation, indexes (including the unique/sparse/partial ones), and
 * query behavior are all tested faithfully.
 */
async function connect() {
   mongod = await MongoMemoryReplSet.create({
      replSet: { count: 1 },
      instanceOpts: [{ launchTimeout: MONGO_LAUNCH_TIMEOUT_MS }]
   });
   const uri = mongod.getUri();
   await mongoose.connect(uri, {
      connectTimeoutMS: MONGO_CONNECT_TIMEOUT_MS,
      serverSelectionTimeoutMS: MONGO_CONNECT_TIMEOUT_MS
   });
}

async function closeDatabase() {
   await mongoose.connection.dropDatabase();
   await mongoose.connection.close();
   if (mongod) await mongod.stop();
}

async function clearDatabase() {
   const collections = mongoose.connection.collections;
   for (const key of Object.keys(collections)) {
      await collections[key].deleteMany({});
   }
}

module.exports = { connect, closeDatabase, clearDatabase };
