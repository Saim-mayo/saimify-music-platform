const mongoose = require('mongoose')
const path = require('path')

// Load env from project config like the app does
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') })
const env = require('../src/config/env')
const User = require('../src/models/user.model')

const email = process.argv[2] || 'copilot-verify-ui-2@example.com'

const run = async () => {
  try {
    await mongoose.connect(env.MONGO_URI, { connectTimeoutMS: 10000 })
    console.log('Connected to MongoDB')

    const res = await User.updateOne(
      { email },
      { $set: { isEmailVerified: true, emailVerificationTokenHash: null, emailVerificationExpires: null } }
    )

    console.log('Update result:', res)
    process.exit(0)
  } catch (err) {
    console.error('Error:', err && err.message ? err.message : err)
    process.exit(1)
  }
}

run()
