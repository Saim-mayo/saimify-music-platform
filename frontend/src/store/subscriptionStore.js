import { create } from 'zustand'
import {
  cancelSubscription,
  changeSubscriptionPlan,
  checkoutPlan,
  getPaymentHistory,
  getPlans,
  getSubscriptionStatus,
  openBillingPortal,
  resumeSubscription,
} from '@/api'
import { getMyFeatures } from '@/api'

export const useSubscriptionStore = create((set) => ({
  plans: [],
  subscription: null,
  history: [],
  features: null,
  loading: false,
  error: '',

  async loadPlans() {
    set({ loading: true, error: '' })
    try {
      const data = await getPlans()
      set({ plans: data?.plans || [], loading: false })
      return data
    } catch (error) {
      const message = error?.response?.data?.message || 'Unable to load subscription plans.'
      set({ error: message, loading: false })
      throw error
    }
  },

  async checkout(payload) {
    set({ loading: true, error: '' })
    try {
      const data = await checkoutPlan(payload)
      set({ loading: false })
      return data
    } catch (error) {
      const message = error?.response?.data?.message || 'Unable to start checkout.'
      set({ error: message, loading: false })
      throw error
    }
  },

  async loadSubscriptionStatus() {
    set({ loading: true, error: '' })
    try {
      const [subscriptionData, featuresData] = await Promise.all([
        getSubscriptionStatus(),
        getMyFeatures().catch(() => null),
      ])
      set({
        subscription: subscriptionData?.subscription || null,
        features: featuresData || null,
        loading: false,
      })
      return { subscriptionData, featuresData }
    } catch (error) {
      const message = error?.response?.data?.message || 'Unable to load subscription status.'
      set({ error: message, loading: false })
      throw error
    }
  },

  async changePlan(payload) {
    set({ loading: true, error: '' })
    try {
      const data = await changeSubscriptionPlan(payload)
      set({ loading: false })
      return data
    } catch (error) {
      const message = error?.response?.data?.message || 'Unable to change subscription.'
      set({ error: message, loading: false })
      throw error
    }
  },

  async loadHistory() {
    set({ loading: true, error: '' })
    try {
      const data = await getPaymentHistory()
      set({ history: data?.payments || [], loading: false })
      return data
    } catch (error) {
      const message = error?.response?.data?.message || 'Unable to load payment history.'
      set({ error: message, loading: false })
      throw error
    }
  },

  async openPortal() {
    set({ loading: true, error: '' })
    try {
      const data = await openBillingPortal()
      set({ loading: false })
      return data
    } catch (error) {
      const message = error?.response?.data?.message || 'Unable to open billing portal.'
      set({ error: message, loading: false })
      throw error
    }
  },

  async cancelCurrentSubscription(payload = {}) {
    set({ loading: true, error: '' })
    try {
      const data = await cancelSubscription(payload)
      set({ loading: false })
      return data
    } catch (error) {
      const message = error?.response?.data?.message || 'Unable to cancel subscription.'
      set({ error: message, loading: false })
      throw error
    }
  },

  async resumeCurrentSubscription() {
    set({ loading: true, error: '' })
    try {
      const data = await resumeSubscription()
      set({ loading: false })
      return data
    } catch (error) {
      const message = error?.response?.data?.message || 'Unable to resume subscription.'
      set({ error: message, loading: false })
      throw error
    }
  },

  setSubscription(subscription) {
    set({ subscription })
  },
}))
