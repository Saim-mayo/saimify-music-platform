import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Input, Skeleton } from '@/components/common'
import { extractFieldErrors, getForgotPasswordFieldErrors } from '@/utils/authValidation'
import useAuthActions from '@/features/auth/useAuthActions'

export default function ForgotPassword() {
  const { forgotPassword } = useAuthActions()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState({})

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setErrors({})
    setMessage('')

    const validationErrors = getForgotPasswordFieldErrors({ email })
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors)
      setLoading(false)
      return
    }

    try {
      const data = await forgotPassword({ email: email.trim() })
      setMessage(data?.message || 'If an account with that email exists, a reset link has been sent.')
    } catch (err) {
      const fieldErrors = extractFieldErrors(err)
      setErrors(fieldErrors)
      if (!fieldErrors.general) {
        setErrors({ general: err?.response?.data?.message || 'Unable to request a password reset right now.' })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-card-top">
          <Link className="icon-button" to="/login" aria-label="Back">←</Link>
          <div style={{ textAlign: 'right' }}>
            <h1 style={{ marginBottom: 0 }}>Forgot password</h1>
            <p className="subtitle" style={{ marginBottom: 0 }}>Reset your password</p>
          </div>
        </div>
        {loading ? <Skeleton className="auth-banner" lines={3} /> : null}
        {!loading ? (
          <>
            <Input
              id="forgot-email"
              name="email"
              autoComplete="email"
              label="Email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onInput={(event) => setEmail(event.target.value)}
              error={errors.email}
            />
            {errors.general ? <div className="auth-banner auth-banner-error"><p style={{ marginBottom: 0 }}>{errors.general}</p></div> : null}
            {message ? <div className="auth-banner auth-banner-success"><p style={{ marginBottom: 0 }}>{message}</p></div> : null}
            <Button type="submit" disabled={loading}>{loading ? 'Sending…' : 'Send reset link'}</Button>
            <p className="auth-link-row">
              <Link to="/login">Back to login</Link>
            </p>
          </>
        ) : null}
      </form>
    </div>
  )
}
