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

describe('CORS for audio streaming', () => {
  it('allows range requests and exposes range headers for audio streaming', async () => {
    const res = await request(app)
      .options('/api/music/stream/test-song-id')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'range');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['access-control-allow-headers']).toEqual(expect.stringContaining('range'));
    expect(res.headers['access-control-expose-headers']).toEqual(expect.stringContaining('Content-Range'));
  });
});
