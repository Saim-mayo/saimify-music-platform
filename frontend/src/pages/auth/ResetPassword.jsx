import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Skeleton } from '@/components/common'
import { Icon } from '@/components/ui'
import { extractFieldErrors, getResetPasswordFieldErrors } from '@/utils/authValidation'
import useAuthActions from '@/features/auth/useAuthActions'

export default function ResetPassword() {
  const { resetPassword } = useAuthActions()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
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
            <div className="field">
              <span>New password</span>
              <div className="password-field-shell">
                <input
                  id="reset-password"
                  name="password"
                  autoComplete="new-password"
                  className={`input ${errors.password ? 'input-error' : ''}`}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label="Toggle password visibility"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Icon name={showPassword ? 'eyeOff' : 'eye'} size={16} />
                </button>
              </div>
              {errors.password ? <small className="error-text">{errors.password}</small> : null}
            </div>
            <div className="field">
              <span>Confirm password</span>
              <div className="password-field-shell">
                <input
                  id="confirm-password"
                  name="confirmPassword"
                  autoComplete="new-password"
                  className={`input ${errors.confirmPassword ? 'input-error' : ''}`}
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowConfirmPassword((value) => !value)}
                  aria-label="Toggle password visibility"
                  title={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  <Icon name={showConfirmPassword ? 'eyeOff' : 'eye'} size={16} />
                </button>
              </div>
              {errors.confirmPassword ? <small className="error-text">{errors.confirmPassword}</small> : null}
            </div>
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
