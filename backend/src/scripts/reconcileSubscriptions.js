const mongoose = require('mongoose');
const connectDB = require('../config/db');
const { reconcileSubscriptions } = require('../services/subscriptionReconciliation.service');

const main = async () => {
   await connectDB();
   const report = await reconcileSubscriptions({
      dryRun: process.argv.includes('--dry-run')
   });
   console.log(JSON.stringify(report, null, 2));
};

main()
   .catch((error) => {
      console.error(error);
      process.exitCode = 1;
   })
   .finally(async () => {
      if (mongoose.connection.readyState) {
         await mongoose.connection.close();
      }
   });