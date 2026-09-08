import { describe, expect, it } from 'vitest'
import { getArtistName } from './track'

describe('getArtistName', () => {
  it('uses the populated artist name', () => {
    expect(getArtistName({ artist: { username: 'Ava Artist' } })).toBe('Ava Artist')
  })

  it('does not display a raw artist ObjectId', () => {
    expect(getArtistName({ artist: '6a60c0fe888f9286881c32e9' })).toBe('Unknown artist')
  })

  it('rejects an ObjectId accidentally passed as artistName', () => {
    expect(getArtistName({ artistName: '6a60c0fe888f9286881c32e9' })).toBe('Unknown artist')
  })
})