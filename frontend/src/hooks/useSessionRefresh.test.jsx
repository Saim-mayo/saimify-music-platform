import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import useSessionRefresh from './useSessionRefresh'

describe('useSessionRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('refreshes the session repeatedly while authenticated', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined)
    renderHook(() => useSessionRefresh({ isAuthenticated: true, refresh, delayMs: 1000 }))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })

    expect(refresh).toHaveBeenCalledTimes(3)
  })

  it('does not schedule another refresh after unmount', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined)
    const { unmount } = renderHook(() => useSessionRefresh({ isAuthenticated: true, refresh, delayMs: 1000 }))

    unmount()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })

    expect(refresh).not.toHaveBeenCalled()
  })
})