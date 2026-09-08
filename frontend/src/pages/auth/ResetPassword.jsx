import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Input, Skeleton } from '@/components/common'
import { extractFieldErrors, getResetPasswordFieldErrors } from '@/utils/authValidation'
import useAuthActions from '@/features/auth/useAuthActions'

export default function ResetPassword() {
  const { resetPassword } = useAuthActions()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState({})
  const token = searchParams.get('token') || ''

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setErrors({})
    setMessage('')

    const validationErrors = getResetPasswordFieldErrors({ password, confirmPassword })
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors)
      setLoading(false)
      return
    }

    try {
      const data = await resetPassword({ token, password })
      setMessage(data?.message || 'Password reset successful. Please log in again.')
      setPassword('')
      setConfirmPassword('')
      setTimeout(() => navigate('/login', { replace: true }), 1200)
    } catch (err) {
      const fieldErrors = extractFieldErrors(err)
      setErrors(fieldErrors)
      if (!fieldErrors.general) {
        setErrors((prev) => ({ ...prev, general: err?.response?.data?.message || 'Unable to reset your password right now.' }))
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
            <h1 style={{ marginBottom: 0 }}>Reset password</h1>
            <p className="subtitle" style={{ marginBottom: 0 }}>Choose a new password</p>
          </div>
        </div>
        {loading ? <Skeleton className="auth-banner" lines={3} /> : null}
        {!loading ? (
          <>
            <Input
              id="reset-password"
              name="password"
              autoComplete="new-password"
              label="New password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              error={errors.password}
            />
            <Input
              id="confirm-password"
              name="confirmPassword"
              autoComplete="new-password"
              label="Confirm password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              error={errors.confirmPassword}
            />
            {errors.general ? <div className="auth-banner auth-banner-error"><p style={{ marginBottom: 0 }}>{errors.general}</p></div> : null}
            {message ? <div className="auth-banner auth-banner-success"><p style={{ marginBottom: 0 }}>{message}</p></div> : null}
            <Button type="submit" disabled={loading}>{loading ? 'Updating…' : 'Reset password'}</Button>
            <p className="auth-link-row">
              <Link to="/login">Back to login</Link>
            </p>
          </>
        ) : null}
      </form>
    </div>
  )
}
