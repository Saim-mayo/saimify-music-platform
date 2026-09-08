import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Input, Skeleton } from '@/components/common'
import { useAuthStore } from '@/store'
import { extractFieldErrors, getRegisterFieldErrors } from '@/utils/authValidation'
import { buildOAuthUrl } from '@/config/runtime'
import { getApiErrorMessage } from '@/api'

export default function Register() {
  const { register, loading } = useAuthStore()
  const [form, setForm] = useState({ name: '', username: '', email: '', password: '', confirmPassword: '' })
  const [errors, setErrors] = useState({})
  const [success, setSuccess] = useState('')

  const onGoogleLogin = () => {
    window.location.assign(buildOAuthUrl('/api/auth/google'))
  }

  const onSubmit = async (event) => {
    event.preventDefault()
    setErrors({})
    setSuccess('')

    const validationErrors = getRegisterFieldErrors(form)
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors)
      return
    }

    try {
      await register({ name: form.name.trim(), username: form.username.trim(), email: form.email.trim(), password: form.password })
      setSuccess('Account created. Please check your email to verify before signing in.')
      setForm({ name: '', username: '', email: '', password: '', confirmPassword: '' })
    } catch (err) {
      const fieldErrors = extractFieldErrors(err)
      setErrors(fieldErrors)
      if (!fieldErrors.general) {
        setErrors((prev) => ({ ...prev, general: getApiErrorMessage(err, 'Unable to complete registration.') }))
      }
    }
  }

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={onSubmit}>
        <div className="auth-card-top">
          <Link className="icon-button" to="/welcome" aria-label="Back">←</Link>
          <div style={{ textAlign: 'right' }}>
            <h1 style={{ marginBottom: 0 }}>Create account</h1>
            <p className="subtitle" style={{ marginBottom: 0 }}>Join Saimify</p>
          </div>
        </div>
        {loading ? <Skeleton className="auth-banner" lines={4} /> : null}
        {!loading ? (
          <>
            <Input
              id="name"
              name="name"
              autoComplete="name"
              label="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              error={errors.name}
            />
            <Input
              id="username"
              name="username"
              autoComplete="username"
              label="Username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              error={errors.username}
            />
            <Input
              id="email"
              name="email"
              autoComplete="email"
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              error={errors.email}
            />
            <Input
              id="password"
              name="password"
              autoComplete="new-password"
              label="Password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              error={errors.password}
            />
            <Input
              id="confirm-password"
              name="confirmPassword"
              autoComplete="new-password"
              label="Confirm password"
              type="password"
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              error={errors.confirmPassword}
            />
            {errors.general ? <div className="auth-banner auth-banner-error"><p style={{ marginBottom: 0 }}>{errors.general}</p></div> : null}
            {success ? <div className="auth-banner auth-banner-success"><p style={{ marginBottom: 0 }}>{success}</p></div> : null}
            <Button type="submit" disabled={loading}>{loading ? 'Creating account…' : 'Register'}</Button>
            <div className="auth-divider">or continue with</div>
            <div className="auth-socials">
              <button type="button" className="auth-social-btn" onClick={onGoogleLogin}>
                <span className="auth-social-icon">G</span>
                <span>Sign up with Google</span>
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
            <p className="auth-link-row">
              Already have an account? <Link to="/login">Log in</Link>
            </p>
          </>
        ) : null}
      </form>
    </div>
  )
}
