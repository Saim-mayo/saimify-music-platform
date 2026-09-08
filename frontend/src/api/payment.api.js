import apiClient from './client'

export const getPlans = async () => {
  const { data } = await apiClient.get('/payment/plans')
  return data
}

export const checkoutPlan = async (payload) => {
  const { data } = await apiClient.post('/payment/checkout', payload)
  return data
}

export const getSubscriptionStatus = async () => {
  const { data } = await apiClient.get('/payment/subscription/status')
  return data
}

export const changeSubscriptionPlan = async (payload) => {
  const { data } = await apiClient.post('/payment/change-plan', payload)
  return data
}

export const getPaymentHistory = async () => {
  const { data } = await apiClient.get('/payment/history')
  return data
}

export const openBillingPortal = async () => {
  const { data } = await apiClient.post('/payment/billing-portal')
  return data
}

export const cancelSubscription = async (payload = {}) => {
  const { data } = await apiClient.delete('/payment/subscription', { data: payload })
  return data
}

export const resumeSubscription = async () => {
  const { data } = await apiClient.post('/payment/subscription/resume')
  return data
}
