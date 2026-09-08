export const getApiErrorMessage = (error, fallback = 'Something went wrong.') => {
  const response = error?.response?.data
  if (typeof response?.message === 'string' && response.message.trim()) return response.message
  if (typeof error?.message === 'string' && error.message.trim()) return error.message
  return fallback
}

export const getApiFieldErrors = (error) => {
  const errors = error?.response?.data?.errors
  if (!Array.isArray(errors)) return {}

  return errors.reduce((fields, entry) => {
    const field = entry?.path || entry?.param || entry?.field
    if (field && entry?.msg) fields[field] = entry.msg
    return fields
  }, {})
}
