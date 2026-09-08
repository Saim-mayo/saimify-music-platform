const palettes = [
  'artwork-lime',
  'artwork-coral',
  'artwork-violet',
  'artwork-sky',
  'artwork-amber',
]

const getSeed = (value = '') => String(value || '').toLowerCase().trim().split('').reduce((total, char) => total + char.charCodeAt(0), 0)

const getInitials = (value = '') => {
  const words = String(value)
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (!words.length) return 'P'

  const initials = words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() || '')
    .join('')

  if (!initials.trim()) return 'P'
  return initials
}

const getFallbackSymbol = (item = {}) => {
  const title = String(item?.title || item?.name || '').toLowerCase()
  if (title === 'liked songs' || title === 'liked song') return '♥'
  return getInitials(item?.artist?.username || item?.artist?.name || item?.user?.username || item?.user?.name || item?.uploadedBy?.username || item?.owner?.username || title)
}

const getAvatarSource = (item = {}) => {
  return (
    item?.artist?.avatar ||
    item?.artist?.imageUrl ||
    item?.artist?.avatarUrl ||
    item?.user?.avatar ||
    item?.user?.imageUrl ||
    item?.uploadedBy?.avatar ||
    item?.uploadedBy?.imageUrl ||
    item?.owner?.avatar ||
    item?.owner?.imageUrl ||
    item?.avatar ||
    item?.profileImage ||
    ''
  )
}

import { useState } from 'react'

export default function Artwork({ item, size = 'medium', className = '' }) {
  const [failed, setFailed] = useState(false)
  const coverSource = item?.coverUrl || item?.cover || item?.imageUrl || item?.thumbnail || item?.artwork || ''
  const avatarSource = getAvatarSource(item)
  const title = item?.title || item?.name || item?.username || 'Untitled'
  const labelSource = item?.artist?.username || item?.artist?.name || item?.user?.username || item?.user?.name || item?.uploadedBy?.username || item?.owner?.username || item?.artist?.email || title
  const palette = palettes[getSeed(labelSource) % palettes.length]
  const fallback = getFallbackSymbol(item)
  const source = (coverSource || avatarSource) && !failed ? (coverSource || avatarSource) : ''

  return source ? (
    <img
      className={`artwork artwork-${size} ${className}`}
      src={source}
      alt={title}
      onError={() => setFailed(true)}
    />
  ) : (
    <div className={`artwork artwork-${size} ${palette} ${className}`} aria-hidden="true">
      <span>{fallback}</span>
    </div>
  )
}
