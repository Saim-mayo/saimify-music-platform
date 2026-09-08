// Runs before the test framework is installed and before any test file
// is required — so process.env is populated before src/app.js (and the
// config modules it requires, several of which read env vars at import
// time) ever gets loaded.
require('dotenv').config({
   path: require('path').join(__dirname, '..', '.env.test')
});
