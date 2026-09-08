import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store'
import { Button, Input, Skeleton } from '@/components/common'
import { extractFieldErrors, getLoginFieldErrors } from '@/utils/authValidation'
import { buildOAuthUrl } from '@/config/runtime'
import { getApiErrorMessage } from '@/api'
import useAuthActions from '@/features/auth/useAuthActions'

export default function Login() {
  const { resendVerification } = useAuthActions()
  const navigate = useNavigate()
  const location = useLocation()
  const { login, loading } = useAuthStore()
  const [form, setForm] = useState({ identifier: '', password: '' })
  const [errors, setErrors] = useState({})
  const [resending, setResending] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [toast, setToast] = useState('')

  const onSubmit = async (event) => {
    event.preventDefault()
    setErrors({})
    setToast('')

    const validationErrors = getLoginFieldErrors(form)
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors)
      return
    }

    try {
      const payload = form.identifier.includes('@')
        ? { email: form.identifier.trim(), password: form.password }
        : { username: form.identifier.trim(), password: form.password }

      await login(payload)
      const redirectTo = location.state?.from?.pathname || '/'
      navigate(redirectTo, { replace: true })
    } catch (err) {
      const fieldErrors = extractFieldErrors(err)
      const responseMessage = getApiErrorMessage(err, 'Unable to log in right now.')
      const banReason = err?.response?.data?.reason
      setErrors(fieldErrors)
      if (!fieldErrors.general) {
        setErrors((prev) => ({
          ...prev,
          general: banReason ? `${responseMessage}: ${banReason}` : responseMessage
        }))
      }
    }
  }

  const onResendVerification = async () => {
    const identifier = form.identifier.trim()
    if (!identifier) {
      setErrors({ general: 'Enter your email address to resend the verification link.' })
      return
    }

    setResending(true)
    setErrors({})

    try {
      await resendVerification({ email: identifier })
      setToast('If an account with that email exists and is not yet verified, a new verification link has been sent.')
    } catch (err) {
      const fieldErrors = extractFieldErrors(err)
      if (Object.keys(fieldErrors).length) {
        setErrors(fieldErrors)
      } else {
        setErrors({ general: getApiErrorMessage(err, 'Unable to resend the verification email right now.') })
      }
    } finally {
      setResending(false)
    }
  }

  const onGoogleLogin = () => {
    window.location.assign(buildOAuthUrl('/api/auth/google'))
  }

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={onSubmit}>
        <div className="auth-card-top">
          <Link className="icon-button" to="/welcome" aria-label="Back">←</Link>
          <div style={{ textAlign: 'right' }}>
            <h1 style={{ marginBottom: 0 }}>Log in</h1>
            <p className="subtitle" style={{ marginBottom: 0 }}>Welcome back</p>
          </div>
        </div>
        {loading ? <Skeleton className="auth-banner" lines={4} /> : null}
        {!loading ? (
          <>
            <div className="auth-card-inline">
              <span className="subtitle">Email or username</span>
              <Link to="/register" className="auth-inline-link">Create account</Link>
            </div>
            <Input
              id="identifier"
              name="identifier"
              autoComplete="username"
              label="Email or username"
              value={form.identifier}
              onChange={(e) => setForm({ ...form, identifier: e.target.value })}
              onInput={(e) => setForm((prev) => ({ ...prev, identifier: e.target.value }))}
              error={errors.identifier}
            />
            <div className="field">
              <span>Password</span>
              <div style={{ position: 'relative' }}>
                <input
                  id="password"
                  name="password"
                  autoComplete="current-password"
                  className={`input ${errors.password ? 'input-error' : ''}`}
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  onInput={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                />
                <button type="button" className="icon-button" style={{ position: 'absolute', right: 8, top: 8, width: 32, height: 32 }} onClick={() => setShowPassword((value) => !value)} aria-label="Toggle password visibility">
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
              {errors.password ? <small className="error-text">{errors.password}</small> : null}
            </div>
            <div className="auth-card-inline">
              <Link to="/forgot-password" className="auth-inline-link">Forgot password?</Link>
            </div>
            {errors.general ? (
              <div className="auth-banner auth-banner-error">
                <p style={{ marginBottom: 0 }}>{errors.general}</p>
                {errors.general === 'Please verify your email before logging in' ? (
                  <button type="button" className="auth-inline-link" onClick={onResendVerification} disabled={resending} style={{ textAlign: 'left' }}>
                    {resending ? 'Sending…' : 'Resend verification email'}
                  </button>
                ) : null}
              </div>
            ) : null}
            {errors.identifier && !errors.general ? <div className="auth-banner auth-banner-error"><p style={{ marginBottom: 0 }}>{errors.identifier}</p></div> : null}
            {errors.password && !errors.general ? <div className="auth-banner auth-banner-error"><p style={{ marginBottom: 0 }}>{errors.password}</p></div> : null}
            {toast ? <div className="auth-banner auth-banner-success"><p style={{ marginBottom: 0 }}>{toast}</p></div> : null}
            <Button type="submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Log In'}
            </Button>
            <div className="auth-divider">or continue with</div>
            <div className="auth-socials">
              <button type="button" className="auth-social-btn" onClick={onGoogleLogin}>
                <span className="auth-social-icon">G</span>
                <span>Continue with Google</span>
              </button>
              <button type="button" className="auth-social-btn" disabled title="Facebook sign-in is not yet supported by the backend">
                <span className="auth-social-icon">f</span>
                <span>Continue with Facebook</span>
              </button>
              <button type="button" className="auth-social-btn" disabled title="Apple sign-in is not yet supported by the backend">
                <span className="auth-social-icon"></span>
                <span>Continue with Apple</span>
              </button>
            </div>
          </>
        ) : null}
      </form>
    </div>
  )
}
