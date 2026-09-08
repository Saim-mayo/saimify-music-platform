const ENTITLED_STATUSES = ['active', 'trialing']

export function isEntitled(sub) {
  if (!sub) return false
  const status = String(sub?.status || '').toLowerCase()
  if (!ENTITLED_STATUSES.includes(status)) return false
  if (sub?.expiresAt && new Date(sub.expiresAt) < new Date()) return false
  return true
}
