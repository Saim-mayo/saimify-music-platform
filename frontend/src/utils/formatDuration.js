export const formatDuration = (value) => {
  const totalSeconds = Math.max(0, Number(value) || 0)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export const formatRemainingTime = (total, current) => formatDuration(Math.max(0, Number(total) - Number(current)))
