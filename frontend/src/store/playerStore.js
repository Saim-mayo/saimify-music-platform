import { create } from 'zustand'
import { addToQueue, apiClient, clearQueue, getCurrentQueue, getFullQueue, nextQueueSong, previousQueueSong, replaceQueue, toggleRepeat as updateRepeat, toggleShuffle as updateShuffle } from '@/api'
import { dispatchErrorToast } from '@/utils/toast'
import { isSameStreamUrl } from './audioUrlUtils'
import { normalizeTrack } from '@/domain/media'

const authorizeAndLoadAudio = async (audio, track, shouldPlay = false) => {
  if (!audio || !track?._id || !track.streamUrl) return false

  const isSameTrack = isSameStreamUrl(audio.currentSrc || audio.src, track.streamUrl)
  
  // Only reload if the track source has changed
  if (!isSameTrack) {
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
  }

  try {
    await apiClient.get(`/music/can-stream/${encodeURIComponent(String(track._id))}`)
  } catch (error) {
    dispatchErrorToast(error)
    return false
  }

  try {
    // Only set src and load if it's a different track
    if (!isSameTrack) {
      audio.src = track.streamUrl
      audio.load()
    }
    
    if (shouldPlay) {
      await audio.play()
    }
    return true
  } catch {
    return false
  }
}

const ensureCurrentTrackLoaded = async (set, get, shouldPlay = false) => {
  const audio = get().audioElement
  const track = get().currentTrack
  if (!audio || !track?.streamUrl) return false
  const authorized = await authorizeAndLoadAudio(audio, track, shouldPlay)
  if (!authorized && get().currentTrack?._id === track?._id) {
    set({ isPlaying: false })
  }
  return authorized
}

export const usePlayerStore = create((set, get) => ({
  currentTrack: null,
  queue: [],
  currentIndex: 0,
  isPlaying: false,
  progress: 0,
  duration: 0,
  isQueueOpen: false,
  loadingQueue: false,
  error: '',
  repeatEnabled: false,
  shuffleEnabled: false,
  volume: 1,
  muted: false,
  isUserSeeking: false,
  audioElement: null,
  playbackContext: null,

  registerAudioElement(audioElement) {
    const prev = get().audioElement
    if (prev === audioElement) {
      return
    }
    // detach previous listeners if present
    try {
      if (prev && prev._playerListeners) {
        const { timeupdate, loadedmetadata, ended, playbackStarted, playbackPaused } = prev._playerListeners
        prev.removeEventListener('play', playbackStarted)
        prev.removeEventListener('pause', playbackPaused)
        prev.removeEventListener('timeupdate', timeupdate)
        prev.removeEventListener('loadedmetadata', loadedmetadata)
        prev.removeEventListener('ended', ended)
        delete prev._playerListeners
        try {
          // ensure any previous audio stops playing when replaced
          prev.pause()
          prev.removeAttribute('src')
          prev.load()
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }

    if (!audioElement) {
      set({ audioElement: null })
      return
    }

    const timeupdate = () => {
      try {
        if (get().isUserSeeking) {
          return
        }
        const nextProgress = Number(audioElement.currentTime) || 0
        const nextDuration = Number(audioElement.duration) || 0
        set({ progress: nextProgress })
        if (Number.isFinite(nextDuration) && nextDuration > 0) set({ duration: nextDuration })
      } catch {
        // ignore
      }
    }

    const playbackStarted = () => {
      set({ isPlaying: true })
    }

    const playbackPaused = () => {
      set({ isPlaying: false })
    }

    const loadedmetadata = () => {
      try {
        const nextDuration = Number(audioElement.duration) || 0
        set({ duration: nextDuration })
        // Don't reset progress here - it's handled by the BottomPlayer useEffect
        // when a NEW track is selected. Resetting here would break resume/pause.
      } catch {
        // ignore
      }
    }

    const ended = () => {
      try {
        set({ progress: 0 })
        if (get().repeatEnabled) {
          audioElement.currentTime = 0
          audioElement.play().catch(() => {})
          return
        }
        // call skipNext from the store
        get().skipNext().catch(() => {})
      } catch {
        // ignore
      }
    }

    audioElement.addEventListener('play', playbackStarted)
    audioElement.addEventListener('pause', playbackPaused)
    audioElement.addEventListener('timeupdate', timeupdate)
    audioElement.addEventListener('loadedmetadata', loadedmetadata)
    audioElement.addEventListener('ended', ended)
    // attach for future cleanup
    audioElement._playerListeners = { timeupdate, loadedmetadata, ended, playbackStarted, playbackPaused }

    set({ audioElement })

    const currentTrack = get().currentTrack
    if (currentTrack && get().isPlaying && currentTrack.streamUrl) {
      ensureCurrentTrackLoaded(set, get, true).catch(() => {})
    }
  },

  setUserSeeking(flag) {
    const next = Boolean(flag)
    set({ isUserSeeking: next })
  },

  setPlaybackContext(context) {
    set({ playbackContext: context || null })
  },

  playTrack(track, queueTracks = null, index = 0, playbackContext = null) {
    const tracks = Array.isArray(queueTracks) && queueTracks.length ? queueTracks : [track]
    const normalizedTracks = tracks.map(normalizeTrack).filter(Boolean)
    if (!normalizedTracks.length) return null

    const safeIndex = Math.max(0, Math.min(index, normalizedTracks.length - 1))
    const selectedTrack = normalizedTracks[safeIndex]
    const audio = get().audioElement
    set({
      queue: normalizedTracks,
      currentTrack: selectedTrack,
      currentIndex: safeIndex,
      progress: 0,
      duration: 0,
      error: '',
      playbackContext: playbackContext || get().playbackContext || null,
    })

    if (selectedTrack.streamUrl) {
      if (audio && audio.src === selectedTrack.streamUrl && !audio.paused) {
        set({ isPlaying: true })
      } else {
        set({ isPlaying: false })
      }

      ensureCurrentTrackLoaded(set, get, true)
        .then((authorized) => {
          if (!authorized && get().currentTrack?._id === selectedTrack._id) {
            set({ isPlaying: false })
          }
        })
        .catch(() => {
          set({ isPlaying: false })
        })
    }

    const queueIds = normalizedTracks.map((entry) => entry?._id).filter(Boolean)
    if (queueIds.length) {
      replaceQueue({ queue: queueIds, currentIndex: safeIndex }).catch(() => {})
    }
    return selectedTrack
  },

  setTrack(track, index = 0, playbackContext = null) {
    return get().playTrack(track, null, index, playbackContext)
  },

  togglePlay() {
    const prev = get().isPlaying
    const next = !prev

    // Only update the state after the actual audio element confirms the new
    // playback state. This prevents the play button from showing as paused when
    // the song is already playing and avoids stale UI state.
    if (!next) {
      try {
        const audio = get().audioElement
        if (audio) {
          audio.pause()
        }
      } catch {
        // ignore
      }
      return
    }

    const audio = get().audioElement
    const currentTrack = get().currentTrack
    
    if (!audio || !currentTrack || !currentTrack.streamUrl) {
      set({ isPlaying: false })
      return
    }

    // Explicitly set isPlaying to true immediately to ensure UI updates
    // The 'play' event listener will also update this, but we set it here
    // to avoid timing issues where the button shows wrong state briefly
    set({ isPlaying: true })

    ensureCurrentTrackLoaded(set, get, true)
      .then((authorized) => {
        if (!authorized && get().currentTrack?._id === currentTrack._id) {
          set({ isPlaying: false })
        }
      })
      .catch(() => {
        set({ isPlaying: false })
      })
  },

  setProgress(value) {
    set({ progress: Number(value) || 0 })
  },

  setDuration(value) {
    set({ duration: Number(value) || 0 })
  },

  setVolume(value) {
    const volumeValue = Math.max(0, Math.min(1, Number(value) || 0))
    const nextMuted = volumeValue === 0
    set({ volume: volumeValue, muted: nextMuted })
    const audio = get().audioElement
    if (audio) {
      audio.volume = volumeValue
      audio.muted = nextMuted
    }
    return volumeValue
  },

  toggleMute() {
    const current = get().muted
    const nextMuted = !current
    set({ muted: nextMuted })
    const audio = get().audioElement
    if (audio) {
      audio.muted = nextMuted
    }
    return nextMuted
  },

  seekTo(value) {
    const nextValue = Number(value) || 0
    // Fall back to the track's known duration if the live <audio> element's
    // duration is 0/NaN/Infinity (can happen briefly with chunked/range
    // streaming before enough metadata has arrived).
    const rawDuration = Number(get().duration)
    const trackDuration = Number(get().currentTrack?.duration)
    const durationValue = Number.isFinite(rawDuration) && rawDuration > 0
      ? rawDuration
      : (Number.isFinite(trackDuration) && trackDuration > 0 ? trackDuration : 0)
    const cappedValue = Math.max(0, Math.min(nextValue, durationValue > 0 ? durationValue : nextValue))
    set({ progress: cappedValue })

    // Cancel any in-flight seek from a previous call before starting a new
    // one, so listeners never pile up across rapid/duplicate seek requests.
    const prevCleanup = get()._seekCleanup
    if (typeof prevCleanup === 'function') {
      try { prevCleanup() } catch { /* ignore */ }
    }

    const audio = get().audioElement
    if (!audio) {
      return cappedValue
    }

    const clearSeeking = () => {
      try {
        set({ isUserSeeking: false, _seekCleanup: null })
      } catch {
        // ignore
      }
    }

    set({ isUserSeeking: true })

    const attemptSeek = () => {
      if (!audio) return
      try {
        if (audio.readyState >= 1 || (Number.isFinite(audio.duration) && audio.duration > 0)) {
          audio.currentTime = cappedValue
        }
      } catch {
        // ignore
      }
    }

    const cleanup = () => {
      audio.removeEventListener('seeked', onSeeked)
      audio.removeEventListener('canplay', onMediaReady)
      audio.removeEventListener('loadedmetadata', onMediaReady)
    }

    const onSeeked = () => {
      try {
        const nextCurrentTime = Number(audio.currentTime) || cappedValue
        set({ progress: nextCurrentTime })
      } catch {
        // ignore
      }
      cleanup()
      clearSeeking()
    }

    const onMediaReady = () => {
      attemptSeek()
    }

    audio.addEventListener('seeked', onSeeked)
    audio.addEventListener('canplay', onMediaReady)
    audio.addEventListener('loadedmetadata', onMediaReady)
    set({ _seekCleanup: () => { cleanup(); clearSeeking() } })

    try {
      // Only force a fresh load if the element genuinely has no source
      // queued yet — reloading on every seek was resetting playback.
      if (audio.readyState === 0 && !audio.currentSrc) {
        audio.load()
      }
      attemptSeek()
    } catch {
      cleanup()
      clearSeeking()
      return cappedValue
    }

    if (get().isPlaying) {
      audio.play().catch(() => {})
    }

    return cappedValue
  },

  // Relative seek helper — e.g. skipBy(30) jumps forward 30s,
  // skipBy(-10) rewinds 10s. Powers the "+30s / -10s" transport controls.
  skipBy(seconds) {
    const delta = Number(seconds) || 0
    const current = Number(get().progress) || 0
    return get().seekTo(current + delta)
  },

  async toggleRepeat() {
    const nextEnabled = !get().repeatEnabled
    try {
      const response = await updateRepeat(nextEnabled ? 'all' : 'off')
      set({ repeatEnabled: response?.repeatMode ? response.repeatMode !== 'off' : nextEnabled })
      return response
    } catch (error) {
      const message = error?.response?.data?.message || 'Unable to update repeat mode.'
      set({ repeatEnabled: nextEnabled, error: message })
      return null
    }
  },

  async toggleShuffle() {
    const nextEnabled = !get().shuffleEnabled
    try {
      const response = await updateShuffle(nextEnabled)
      set({ shuffleEnabled: typeof response?.isShuffle === 'boolean' ? response.isShuffle : nextEnabled })
      return response
    } catch (error) {
      const message = error?.response?.data?.message || 'Unable to update shuffle mode.'
      set({ shuffleEnabled: nextEnabled, error: message })
      return null
    }
  },

  playNextTrack() {
    const { queue, currentIndex, repeatEnabled, shuffleEnabled, currentTrack } = get()
    if (!queue.length) {
      if (repeatEnabled && currentTrack) {
        set({ isPlaying: true, progress: 0 })
      } else {
        set({ isPlaying: false })
      }
      return currentTrack
    }

    let nextIndex = currentIndex + 1
    if (shuffleEnabled && queue.length > 1) {
      let candidate = Math.floor(Math.random() * queue.length)
      while (candidate === currentIndex && queue.length > 1) {
        candidate = Math.floor(Math.random() * queue.length)
      }
      nextIndex = candidate
    } else if (nextIndex >= queue.length) {
      nextIndex = repeatEnabled ? 0 : currentIndex
    }

    const nextTrack = queue[nextIndex]
    if (!nextTrack) {
      set({ isPlaying: false })
      return null
    }

    set({ currentTrack: nextTrack, currentIndex: nextIndex, progress: 0, isPlaying: true, error: '' })
    const queueIds = queue.map((entry) => entry?._id).filter(Boolean)
    if (queueIds.length) {
      replaceQueue({ queue: queueIds, currentIndex: nextIndex }).catch(() => {})
    }
    return nextTrack
  },

  playPreviousTrack() {
    const { queue, currentIndex, repeatEnabled } = get()
    if (!queue.length) return null

    let previousIndex = currentIndex - 1
    if (previousIndex < 0) {
      previousIndex = repeatEnabled ? queue.length - 1 : 0
    }

    const previousTrack = queue[previousIndex]
    if (!previousTrack) return null

    set({ currentTrack: previousTrack, currentIndex: previousIndex, progress: 0, isPlaying: true, error: '' })
    const queueIds = queue.map((entry) => entry?._id).filter(Boolean)
    if (queueIds.length) {
      replaceQueue({ queue: queueIds, currentIndex: previousIndex }).catch(() => {})
    }
    return previousTrack
  },

  setQueue(queue, index = 0) {
    set({ queue: (queue || []).map(normalizeTrack).filter(Boolean), currentIndex: index, error: '' })
  },

  async enqueueTrack(songId) {
    if (!songId) {
      const message = 'Invalid song selected for queue.'
      set({ error: message })
      throw new Error(message)
    }

    try {
      const response = await addToQueue({ songId })
      const nextQueue = response?.queue || []
      if (Array.isArray(nextQueue)) {
        set({ queue: nextQueue.map(normalizeTrack).filter(Boolean), error: '' })
      }
      return response
    } catch (error) {
      const message = error?.response?.data?.message || 'Unable to add track to the queue.'
      set({ error: message })
      throw error
    }
  },

  async removeFromQueue(songId) {
    if (!songId) {
      const message = 'Invalid song selected for removal.'
      set({ error: message })
      throw new Error(message)
    }

    const queue = Array.isArray(get().queue) ? get().queue : []
    const currentIndex = Number.isInteger(get().currentIndex) ? get().currentIndex : 0
    const removedIndex = queue.findIndex((track) => track && (String(track._id) === String(songId) || String(track.id) === String(songId)))

    if (removedIndex < 0) {
      return queue
    }

    const nextQueue = queue.filter((track, index) => index !== removedIndex)
    const isRemovingCurrent = removedIndex === currentIndex

    if (!nextQueue.length) {
      await clearQueue()
      set({ queue: [], currentTrack: null, currentIndex: 0, isPlaying: false, playbackContext: null, error: '' })
      return []
    }

    let nextIndex = currentIndex
    if (removedIndex < currentIndex) {
      nextIndex = Math.max(0, currentIndex - 1)
    } else if (isRemovingCurrent) {
      nextIndex = Math.min(currentIndex, nextQueue.length - 1)
    }

    const nextTrack = nextQueue[nextIndex] || null
    const queueIds = nextQueue.map((entry) => entry?._id).filter(Boolean)

    await replaceQueue({ queue: queueIds, currentIndex: nextIndex })
    set({
      queue: nextQueue,
      currentIndex: nextIndex,
      currentTrack: nextTrack,
      error: '',
    })

    if (isRemovingCurrent && nextTrack && get().isPlaying) {
      await ensureCurrentTrackLoaded(set, get, true)
    }

    return nextQueue
  },

  async refreshQueue() {
    set({ loadingQueue: true, error: '' })
    try {
      const [currentData, fullQueueData] = await Promise.all([getCurrentQueue(), getFullQueue()])
      const current = currentData?.song || currentData?.currentSong || null
      const queue = Array.isArray(fullQueueData?.queue) ? fullQueueData.queue : (currentData?.queue || [])
      const currentIndex = typeof currentData?.currentIndex === 'number' ? currentData.currentIndex : 0
      set({
        currentTrack: normalizeTrack(current),
        queue: Array.isArray(queue) ? queue.map(normalizeTrack).filter(Boolean) : [],
        currentIndex,
        loadingQueue: false,
      })
      return { currentData, fullQueueData }
    } catch (error) {
      // If the backend returns 404 for empty queues, treat it as empty
      // and avoid throwing — this reduces client-side churn in dev.
      const status = error?.response?.status
      if (status === 404) {
        set({ currentTrack: null, queue: [], currentIndex: 0, loadingQueue: false })
        return { currentData: null, fullQueueData: { queue: [] } }
      }
      const message = error?.response?.data?.message || 'Unable to load your queue.'
      set({ error: message, loadingQueue: false })
      throw error
    }
  },

  async skipNext() {
    try {
      const response = await nextQueueSong()
      const { queue } = get()
      const nextIndex = Number.isInteger(response?.currentIndex) ? response.currentIndex : get().currentIndex
      const nextTrack = queue[nextIndex]
      if (nextTrack) {
        set({ currentTrack: nextTrack, currentIndex: nextIndex, progress: 0, duration: 0, isPlaying: true, error: '' })
        await ensureCurrentTrackLoaded(set, get, true)
      } else {
        set({ isPlaying: false, error: '' })
      }
      return response
    } catch (error) {
      const nextTrack = get().playNextTrack()
      if (nextTrack) {
        await ensureCurrentTrackLoaded(set, get, true)
        return nextTrack
      }
      const message = error?.response?.data?.message || 'Unable to skip to the next track.'
      set({ error: message })
      throw error
    }
  },

  async skipPrevious() {
    try {
      const response = await previousQueueSong()
      const { queue } = get()
      const previousIndex = Number.isInteger(response?.currentIndex) ? response.currentIndex : get().currentIndex
      const previousTrack = queue[previousIndex]
      if (previousTrack) {
        set({ currentTrack: previousTrack, currentIndex: previousIndex, progress: 0, duration: 0, isPlaying: true, error: '' })
        await ensureCurrentTrackLoaded(set, get, true)
      } else {
        set({ isPlaying: false, error: '' })
      }
      return response
    } catch (error) {
      const previousTrack = get().playPreviousTrack()
      if (previousTrack) {
        await ensureCurrentTrackLoaded(set, get, true)
        return previousTrack
      }
      const message = error?.response?.data?.message || 'Unable to go to the previous track.'
      set({ error: message })
      throw error
    }
  },

  async clearPlaybackQueue() {
    try {
      await clearQueue()
      set({ queue: [], currentTrack: null, currentIndex: 0, isPlaying: false, playbackContext: null })
    } catch (error) {
      const message = error?.response?.data?.message || 'Unable to clear the queue.'
      set({ error: message })
      throw error
    }
  },

  openQueue() {
    set({ isQueueOpen: true })
  },

  closeQueue() {
    set({ isQueueOpen: false })
  },
}))