import test from 'node:test'
import assert from 'node:assert/strict'

import { isSameStreamUrl } from './audioUrlUtils.js'

test('treats absolute and relative stream URLs for the same track as equal', () => {
  const relativeUrl = '/api/music/stream/688219d7e7af17ff2a2ee95d'
  const absoluteUrl = 'http://localhost:5173/api/music/stream/688219d7e7af17ff2a2ee95d'

  assert.equal(isSameStreamUrl(relativeUrl, absoluteUrl), true)
  assert.equal(isSameStreamUrl(absoluteUrl, relativeUrl), true)
})

test('treats different stream URLs as different tracks', () => {
  assert.equal(isSameStreamUrl('/api/music/stream/first', 'http://localhost:5173/api/music/stream/second'), false)
})
