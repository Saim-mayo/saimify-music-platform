import { Icon } from '@/components/ui'
import { showToast } from '@/utils/toast'
import { usePlayerStore } from '@/store'

export default function QueueButton({ songId, song, className = '', title = 'Add to queue', children = null }) {
  const enqueueTrack = usePlayerStore((state) => state.enqueueTrack)
  const resolvedSongId = songId || song?._id || song?.id

  const handleClick = async (event) => {
    event?.stopPropagation?.()
    if (!resolvedSongId) return

    try {
      await enqueueTrack(resolvedSongId)
      showToast({ message: 'Added to queue.', tone: 'success' })
    } catch (error) {
      const message = error?.response?.data?.message || 'Unable to add to queue.'
      showToast({ message, tone: 'error' })
    }
  }

  return (
    <button
      type="button"
      className={`icon-button queue-button ${className}`.trim()}
      onClick={handleClick}
      disabled={!resolvedSongId}
      aria-label={title}
      title={title}
    >
      {children ?? <Icon name="queue" size={18} />}
    </button>
  )
}
