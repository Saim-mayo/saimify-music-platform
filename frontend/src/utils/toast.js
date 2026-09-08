export const showToast = ({ message, tone = 'info', actionLabel = null, action = null }) => {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('toast', {
    detail: { message, tone, actionLabel, action }
  }))
}

export const dispatchErrorToast = (error, fallbackMessage = 'Something went wrong.') => {
  const message = error?.response?.data?.message || error?.message || fallbackMessage
  const tone = 'error'
  const detail = { message, tone }

  if (error?.response?.status === 403 && /daily limit|premium|plan/i.test(String(message))) {
    detail.actionLabel = 'Upgrade'
    detail.action = { type: 'navigate', to: '/billing' }
  }

  showToast(detail)
}
