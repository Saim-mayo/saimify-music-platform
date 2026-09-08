const request = require('supertest');
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');

let app;

beforeAll(async () => {
   if (mongoose.connection.readyState !== 1) {
      await connectDB();
   }

   app = require('../src/app');
});

afterAll(async () => {
   if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
   }
});

describe('GET /health', () => {
   it('returns 200 with an ok status', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.db).toBe('connected');
      expect(res.body.timestamp).toBeDefined();
      expect(typeof res.body.uptime).toBe('number');
   });
});