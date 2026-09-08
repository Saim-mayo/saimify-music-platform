export const unwrapCollection = (payload, keys = []) => {
  if (Array.isArray(payload)) return payload

  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key]
    if (Array.isArray(payload?.[key]?.[key])) return payload[key][key]
    if (Array.isArray(payload?.[key]?.items)) return payload[key].items
  }

  if (Array.isArray(payload?.data)) return payload.data
  return []
}

export const unwrapEntity = (payload, keys = []) => {
  for (const key of keys) {
    if (payload?.[key]) return payload[key]
  }
  return payload?.data || payload || null
}
