require('dotenv').config();

const { MongoClient } = require('mongodb');

const repairStripeCustomerIndex = async () => {
   const client = await MongoClient.connect(process.env.MONGO_URI);
   const database = client.db();
   const users = database.collection('users');

   try {
      try {
         await users.dropIndex('subscription.stripeCustomerId_1');
      } catch (error) {
         if (error.codeName !== 'IndexNotFound') throw error;
      }

      await users.updateMany(
         { 'subscription.stripeCustomerId': null },
         { $unset: { 'subscription.stripeCustomerId': '' } }
      );

      await users.createIndex(
         { 'subscription.stripeCustomerId': 1 },
         { unique: true, sparse: true, name: 'subscription.stripeCustomerId_1' }
      );

      console.log(JSON.stringify({
         database: database.databaseName,
         indexRepaired: true,
         users: await users.countDocuments()
      }));
   } finally {
      await client.close();
   }
};

repairStripeCustomerIndex().catch((error) => {
   console.error(error.message);
   process.exitCode = 1;
});