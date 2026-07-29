module.exports = {
   testEnvironment: 'node',
   setupFiles: ['<rootDir>/tests/env.setup.js'],
   // MongoMemoryReplSet can take longer than 30s to start on slower
   // environments, especially on Windows or when downloading binaries.
   testTimeout: 120000,
   moduleNameMapper: {
      // see tests/__mocks__/file-type.js for why this is needed
      '^file-type$': '<rootDir>/tests/__mocks__/file-type.js'
   },
   // Each test file gets its own module registry + Mongo connection, so
   // running files in parallel is safe by default. Kept serial here only
   // because free-tier CI/dev machines running this alongside a real
   // dev server benefit from lower peak memory (mongodb-memory-server
   // downloads/holds a real mongod binary per worker).
   maxWorkers: 1
};
