export const normalizeStreamUrl = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return ''

  try {
    const parsed = new URL(raw, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
    return `${parsed.pathname}${parsed.search}`
  } catch {
    return raw.replace(/\/+$/, '')
  }
}

export const isSameStreamUrl = (a, b) => {
  const left = normalizeStreamUrl(a)
  const right = normalizeStreamUrl(b)

  if (!left || !right) return left === right
  return left === right
}
