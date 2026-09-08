import test from 'node:test'
import assert from 'node:assert/strict'
import { getPlaylistActionMessage } from './playlistActions.js'

test('returns a specific message for already-in-playlist conflicts', () => {
  const error = {
    response: {
      status: 409,
      data: { message: 'Song already exists in playlist' },
    },
  }

  assert.equal(getPlaylistActionMessage(error, 'Unable to add this track to the playlist.'), 'This track is already in that playlist.')
})

test('falls back to a generic message when no message is provided for non-conflict errors', () => {
  const error = {
    response: {
      status: 500,
      data: {},
    },
  }

  assert.equal(getPlaylistActionMessage(error, 'Unable to add this track to the playlist.'), 'Unable to add this track to the playlist.')
})
