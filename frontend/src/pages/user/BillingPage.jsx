import { useEffect, useState } from 'react'
import { useSubscriptionStore } from '@/store'
import { Skeleton } from '@/components/common'

const INTERVALS = ['monthly', 'yearly']

const BillingPage = () => {
  // Subscription store (zustand)
  const store = useSubscriptionStore()
  const {
    plans = [],
    subscription = null,
    history = [],
    features = null,
    loading: storeLoading = false,
    error: storeError = '',
    loadPlans,
    loadSubscriptionStatus,
    loadHistory,
    checkout,
    changePlan,
    openPortal,
    cancelCurrentSubscription,
    resumeCurrentSubscription,
  } = store

  // Local UI state
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [pendingChange, setPendingChange] = useState(null)
  const [pendingCheckout, setPendingCheckout] = useState(null)
  const [pendingCancel, setPendingCancel] = useState(false)
  const [selectedIntervals, setSelectedIntervals] = useState({})

  // Derived values
  const currentPlanKey = subscription?.planKey || subscription?.plan || 'free'
  const currentInterval = subscription?.billingInterval || 'monthly'
  const hasActiveStripeSubscription = Boolean(subscription && subscription?.stripeSubscriptionId)
  const isEntitledSubscription = Boolean(subscription && subscription?.status === 'active')

  useEffect(() => {
    let mounted = true
    const init = async () => {
      setError('')
      try {
        await Promise.all([loadPlans?.(), loadSubscriptionStatus?.(), loadHistory?.()])
      } catch (err) {
        if (!mounted) return
        setError(err?.response?.data?.message || 'Unable to load billing data.')
      }
    }
    init()
    return () => { mounted = false }
  }, [loadPlans, loadSubscriptionStatus, loadHistory])

  /* Helpers */
  const formatAmount = (amount, currency) => {
    if (amount === null || amount === undefined) return 'Included'
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD' }).format(amount / 100 || amount)
    } catch (err) {
      console.error(err)
      return `${amount} ${currency || ''}`
    }
  }

  const formatHistoryDate = (value) => {
    if (!value) return ''
    const d = typeof value === 'number' || !isNaN(Number(value)) ? new Date(value) : new Date(value)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const getHistoryStatusLabel = (entry) => {
    const status = String(entry?.status || 'paid').toLowerCase()
    if (status === 'failed') return 'Failed'
    if (status === 'pending') return 'Pending'
    return 'Paid'
  }

  const getHistoryStatusClass = (entry) => {
    const status = String(entry?.status || 'paid').toLowerCase()
    if (status === 'failed') return 'billing-history-status billing-history-status--failed'
    if (status === 'pending') return 'billing-history-status billing-history-status--pending'
    return 'billing-history-status billing-history-status--paid'
  }

  const formatHistoryAmount = (entry) => {
    if (entry.amount === null || entry.amount === undefined) return 'Included'
    const formatted = formatAmount(entry.amount, entry.currency)
    if (entry.amount === 0 && entry.billingReason === 'subscription_update') {
      return `${formatted} (prorated — plan change had no remaining time to bill)`
    }
    if (entry.billingReason === 'subscription_update') {
      return `${formatted} (prorated adjustment)`
    }
    return formatted
  }

  const getPriceByInterval = (plan, interval) => {
    const prices = Array.isArray(plan?.prices) ? plan.prices : []
    return prices.find((price) => price?.interval === interval) || null
  }

  const getPlanKey = (plan) => plan?.key || plan?.id || (plan?.name || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'plan'

  const getPlanStatus = (plan, interval) => {
    const planKey = getPlanKey(plan)
    const isFreePlan = planKey === 'free' || plan.level === 0

    if (isFreePlan && currentPlanKey === 'free') return 'current'
    if (isFreePlan && hasActiveStripeSubscription) return 'no-action'
    if (!hasActiveStripeSubscription || !isEntitledSubscription) return 'checkout'
    if (!isEntitledSubscription && currentPlanKey !== 'free') return 'change'
    const isCurrentSelection = currentPlanKey === plan.key && currentInterval === interval
    if (isCurrentSelection) return 'current'
    return 'change'
  }

  const getPlanChangeDirection = (plan, interval) => {
    const currentPlan = plans.find((item) => item.key === currentPlanKey)
    const selectedPrice = getPriceByInterval(plan, interval)
    const currentPrice = getPriceByInterval(currentPlan, currentInterval)

    if (selectedPrice && currentPrice && typeof selectedPrice.amount === 'number' && typeof currentPrice.amount === 'number') {
      if (selectedPrice.amount > currentPrice.amount) return 'upgrade'
      if (selectedPrice.amount < currentPrice.amount) return 'downgrade'
    }

    return plan.level > (currentPlan?.level || 0) ? 'upgrade' : 'downgrade'
  }

  const getActionLabel = (plan, interval, previewDirection) => {
    const planStatus = getPlanStatus(plan, interval)
    if (planStatus === 'current') return 'Current plan'
    if (planStatus === 'change') {
      if (previewDirection === 'upgrade' || previewDirection === 'downgrade') return previewDirection === 'upgrade' ? 'Upgrade' : 'Downgrade'
      return getPlanChangeDirection(plan, interval) === 'upgrade' ? 'Upgrade' : 'Downgrade'
    }
    return 'Choose plan'
  }

  const formatPricingSummary = (data) => {
    if (!data?.pricingSummary) return data?.message || 'Plan change request submitted.'
    const { effect, deltaAmount, currency } = data.pricingSummary
    const amountLabel = formatAmount(deltaAmount, currency)
    if (effect === 'charge') return `${data.message || 'Plan change request submitted.'} Estimated charge: ${amountLabel}.`
    if (effect === 'credit') return `${data.message || 'Plan change request submitted.'} Estimated credit: ${amountLabel}.`
    return data.message || 'Plan change request submitted.'
  }

  const formatFeatureLabel = (key) => key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/^./, (char) => char.toUpperCase())

  const getPlanFeatureList = (plan) => {
    if (Array.isArray(plan.features)) return plan.features.filter(Boolean)
    if (!plan.features || typeof plan.features !== 'object') return []
    return Object.entries(plan.features).flatMap(([key, value]) => {
      if (value === null || value === undefined || value === false) return []
      if (value === true) return [formatFeatureLabel(key)]
      return [`${formatFeatureLabel(key)}: ${value}`]
    })
  }

  const handleIntervalToggle = (planKey, interval) => {
    setSelectedIntervals((previous) => ({ ...previous, [planKey]: interval }))
  }

  /* Handlers that call store actions */
  const handleCheckout = async (plan, interval) => {
    setMessage('')
    setPendingChange(null)
    setPendingCheckout({ plan, interval })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const confirmPendingCheckout = async () => {
    if (!pendingCheckout) return
    setSubmitting(true)
    setMessage('')
    try {
      const data = await checkout?.({ planKey: pendingCheckout.plan.key, interval: pendingCheckout.interval })
      if (data?.url) {
        window.location.assign(data.url)
        return
      }
      setPendingCheckout(null)
      setMessage(data?.message || 'Checkout started successfully.')
    } catch (error) {
      const message = error?.response?.data?.message || 'Unable to start checkout.'
      if (message && message.toLowerCase().includes('change-plan')) {
        setPendingCheckout(null)
        setPendingChange({
          plan: pendingCheckout.plan,
          interval: pendingCheckout.interval,
          direction: getPlanChangeDirection(pendingCheckout.plan, pendingCheckout.interval),
          summary: message,
        })
        setMessage('You already have an active subscription. Review the plan change action below.')
        return
      }
      setMessage(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handlePlanChange = async (plan, interval) => {
    setMessage('')
    setSubmitting(true)
    try {
      const data = await changePlan?.({ planKey: plan.key, interval })
      setPendingChange({
        plan,
        interval,
        direction: data?.direction || getPlanChangeDirection(plan, interval),
        summary: formatPricingSummary(data),
      })
      setMessage('Review the estimated adjustment before finalizing the switch.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error) {
      setMessage(error?.response?.data?.message || 'Unable to change your plan right now.')
    } finally {
      setSubmitting(false)
    }
  }

  const confirmPendingChange = async () => {
    if (!pendingChange) return
    setSubmitting(true)
    setMessage('')
    try {
      try {
        await changePlan?.({ planKey: pendingChange.plan.key, interval: pendingChange.interval })
      } catch (error) {
        if (error?.response?.status !== 409) throw error
      }
      await loadSubscriptionStatus?.()
      await loadPlans?.()
      await loadHistory?.()
      setPendingChange(null)
      setMessage(`Plan update processed for ${pendingChange.plan.name}.`)
    } catch (error) {
      setMessage(error?.response?.data?.message || 'We could not confirm the plan change right now.')
    } finally {
      setSubmitting(false)
    }
  }

  const handlePortal = async () => {
    setMessage('')
    try {
      const data = await openPortal?.()
      if (data?.url) {
        window.location.assign(data.url)
        return
      }
      setMessage('Billing portal opened.')
    } catch (error) {
      setMessage(error?.response?.data?.message || 'Unable to open the billing portal right now.')
    }
  }

  const handleCancel = () => {
    setMessage('')
    setPendingCancel(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const confirmPendingCancel = async () => {
    setSubmitting(true)
    setMessage('')
    try {
      const data = await cancelCurrentSubscription?.({ atPeriodEnd: false })
      await loadSubscriptionStatus?.()
      await loadHistory?.()
      setPendingCancel(false)
      setMessage(data?.message || 'Subscription cancelled.')
    } catch (error) {
      setMessage(error?.response?.data?.message || 'Unable to cancel this subscription right now.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleResume = async () => {
    setMessage('')
    try {
      const data = await resumeCurrentSubscription?.()
      await loadSubscriptionStatus?.()
      await loadHistory?.()
      setMessage(data?.message || 'Subscription resumed.')
    } catch (error) {
      setMessage(error?.response?.data?.message || 'Unable to resume the subscription right now.')
    }
  }

  return (
    <div className="content-shell">
      <section>
        <h1>Subscription</h1>
        <p className="subtitle">Choose the plan and interval that fits your listening habits.</p>
      </section>
      {message ? <p className="success-banner">{message}</p> : null}
      {storeLoading ? <section className="grid-list"><div className="card"><Skeleton lines={4} /></div><div className="card"><Skeleton lines={4} /></div></section> : null}
      {error || storeError ? <div className="error-banner"><span>{error || storeError}</span><button type="button" className="btn btn-ghost btn-compact" onClick={() => window.location.reload()}>Retry</button></div> : null}

      {pendingChange ? (
        <div className="card billing-confirm-card">
          <h3>Confirm plan change</h3>
          <p>{pendingChange.summary}</p>
          <div className="row-actions">
            <button type="button" className="btn btn-primary" onClick={confirmPendingChange} disabled={submitting}>
              {submitting ? 'Working…' : 'Confirm change'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setPendingChange(null)} disabled={submitting}>Cancel</button>
          </div>
        </div>
      ) : null}

      {pendingCheckout ? (
        <div className="card billing-confirm-card">
          <h3>Confirm checkout</h3>
          <p>You’re about to start checkout for {pendingCheckout.plan.name} ({pendingCheckout.interval}).</p>
          <div className="row-actions">
            <button type="button" className="btn btn-primary" onClick={confirmPendingCheckout} disabled={submitting}>
              {submitting ? 'Working…' : 'Confirm checkout'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setPendingCheckout(null)} disabled={submitting}>Cancel</button>
          </div>
        </div>
      ) : null}

      {pendingCancel ? (
        <div className="card billing-confirm-card">
          <h3>Confirm cancel subscription</h3>
          <p>Do you really want to cancel your subscription? This will stop renewals and may end access to paid features.</p>
          <div className="row-actions">
            <button type="button" className="btn btn-primary" onClick={confirmPendingCancel} disabled={submitting}>
              {submitting ? 'Working…' : 'Confirm cancel'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setPendingCancel(false)} disabled={submitting}>Keep subscription</button>
          </div>
        </div>
      ) : null}

      <div className="billing-grid">
        <div className="billing-main">
          <div className="card billing-summary-card" style={{ padding: 12, marginBottom: 12 }}>
            <div className="billing-summary-header">
              <div className="billing-summary-left">
                <strong className="billing-summary-title">{subscription?.plan || 'Free'}</strong>
                <div className="billing-summary-status-row">
                  <span className={`status-pill ${String(subscription?.status || 'none').toLowerCase() === 'active' ? 'status-pill--approved' : 'status-pill--neutral'}`}>{subscription?.status || 'No subscription'}</span>
                  <span className="subtitle">Renews: {subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : 'N/A'}</span>
                </div>
              </div>
              <div className="billing-summary-right">
                <div className="billing-summary-price">{(() => {
                  const plan = plans.find((p) => getPlanKey(p) === currentPlanKey)
                  const price = plan ? getPriceByInterval(plan, currentInterval) : null
                  return price ? formatAmount(price.amount, price.currency) : 'Included'
                })()}</div>
                <div className="subtitle billing-summary-interval">{subscription?.billingInterval || 'monthly'}</div>
                <div className="row-actions billing-summary-actions">
                  {hasActiveStripeSubscription ? <button type="button" className="btn btn-ghost" onClick={handleCancel}>Cancel subscription</button> : null}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            {plans.map((plan) => {
              const key = getPlanKey(plan)
              const activeInterval = selectedIntervals[key] || 'monthly'
              const selectedPrice = getPriceByInterval(plan, activeInterval)
              const planStatus = getPlanStatus(plan, activeInterval)
              const previewDirection = pendingChange?.plan?.key === key && pendingChange?.interval === activeInterval ? pendingChange.direction : null
              const actionLabel = getActionLabel(plan, activeInterval, previewDirection)
              const isCurrentSelection = planStatus === 'current'
              const canUseInterval = (interval) => Array.isArray(plan.prices) && plan.prices.some((price) => price?.interval === interval)

              return (
                <article className="card billing-plan-card" key={key}>
                  <div className="billing-plan-card-header">
                    <div style={{ minWidth: 0 }}>
                      <h3 style={{ margin: '0 0 6px 0', fontSize: '1rem' }}>{plan.name} {plan.level > 0 ? null : <span className="subtitle">(Free)</span>}</h3>
                      <p className="subtitle" style={{ margin: 0 }}>{plan.description || (plan.level === 0 ? 'Free tier' : `Level ${plan.level}`)}</p>
                    </div>
                    <div className="billing-plan-price">
                      <div style={{ fontSize: 20, fontWeight: 700 }}>{selectedPrice ? formatAmount(selectedPrice.amount, selectedPrice.currency) : 'Included'}</div>
                      <div className="subtitle" style={{ marginTop: 6 }}>{selectedPrice ? (selectedPrice.interval === 'yearly' ? 'per year' : 'per month') : 'Free'}</div>
                    </div>
                  </div>

                  <div className="billing-plan-body">
                    <div className="billing-interval-toggle">
                      {INTERVALS.map((interval) => {
                        const available = canUseInterval(interval)
                        return (
                          <button
                            type="button"
                            key={interval}
                            disabled={!available}
                            onClick={() => handleIntervalToggle(key, interval)}
                            className={activeInterval === interval ? 'billing-interval-button billing-interval-button--active' : 'billing-interval-button'}
                          >
                            {interval === 'monthly' ? 'Monthly' : 'Yearly'}
                          </button>
                        )
                      })}
                    </div>
                    <div className="billing-plan-features">
                      <ul>
                        {getPlanFeatureList(plan).slice(0, 3).map((feature) => <li key={feature}>{feature}</li>)}
                      </ul>
                    </div>
                  </div>

                  <div className="billing-plan-footer row-actions">
                      {isCurrentSelection ? (
                        <span className="success-banner">Current</span>
                      ) : planStatus === 'no-action' ? (
                        <span className="subtitle">Manage subscription from billing page</span>
                      ) : (
                        <button type="button" className="btn btn-primary" onClick={() => (planStatus === 'checkout' ? handleCheckout(plan, activeInterval) : handlePlanChange(plan, activeInterval))} disabled={submitting}>
                          {actionLabel}
                        </button>
                      )}
                    </div>
                </article>
              )
            })}
          </div>
        </div>

        <aside className="billing-side">
          {features ? (
            <div className="card" style={{ padding: 10, marginBottom: 12 }}>
              <h3 style={{ marginTop: 0 }}>Features</h3>
              <div style={{ display: 'grid', gap: 6 }}>
                <div><strong>Downloads remaining:</strong> {features?.downloadsRemaining ?? 'unlimited'}</div>
                <div><strong>Daily play limit:</strong> {features?.dailyPlayLimit ?? 'unlimited'}</div>
                <div><strong>Ad-free:</strong> {features?.showAds === false ? 'Yes' : 'No'}</div>
              </div>
            </div>
          ) : null}
          <div className="card" style={{ padding: 10, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0 }}>Billing history</h3>
              <div className="row-actions">
                <button type="button" className="btn btn-ghost btn-compact" onClick={handlePortal}>Open billing portal</button>
              </div>
            </div>
            <div style={{ marginTop: 8 }}>
              {history.length ? (
                <div style={{ display: 'grid', gap: 6 }}>
                  {history.slice(0, 8).map((entry) => (
                    <div key={entry._id || entry.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px', borderRadius: 8, background: 'transparent' }}>
                      <div style={{ minWidth: 0, flex: '1 1 auto' }}>
                        <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.planName || entry.plan || 'Plan'}</strong>
                        <div className="subtitle" style={{ fontSize: '0.85rem' }}>{formatHistoryDate(entry.createdAt || entry.updatedAt)}</div>
                      </div>
                      <div style={{ textAlign: 'right', minWidth: 110 }}>
                        <div style={{ fontWeight: 700 }}>{formatHistoryAmount(entry)}</div>
                        <div style={{ marginTop: 6 }}>
                          <span className={getHistoryStatusClass(entry)}>{getHistoryStatusLabel(entry)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="subtitle">No payment history yet.</p>}
            </div>
          </div>

          <div className="card" style={{ padding: 10 }}>
            <h3 style={{ marginTop: 0 }}>Current subscription</h3>
            {subscription ? (
              <div style={{ display: 'grid', gap: 8 }}>
                <div><strong>Plan:</strong> {subscription.plan || 'Unknown'}</div>
                <div><strong>Status:</strong> {subscription.status || 'active'}</div>
                <div><strong>Renews:</strong> {subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : 'Not available'}</div>
                <div className="row-actions">
                  {hasActiveStripeSubscription ? (
                    <button type="button" className="btn btn-ghost" onClick={handleCancel} disabled={submitting}>Cancel subscription</button>
                  ) : null}
                  {subscription?.cancelAtPeriodEnd && hasActiveStripeSubscription ? (
                    <button type="button" className="btn btn-ghost" onClick={handleResume} disabled={submitting}>Resume subscription</button>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="subtitle">No active subscription yet.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

export default BillingPage
