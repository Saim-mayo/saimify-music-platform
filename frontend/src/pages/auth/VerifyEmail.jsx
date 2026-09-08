import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button, Input, Skeleton } from '@/components/common'
import { validateEmail } from '@/utils/authValidation'
import useAuthActions from '@/features/auth/useAuthActions'

export default function VerifyEmail() {
  const { resendVerification, verifyEmail } = useAuthActions()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [resending, setResending] = useState(false)
  const [resendMessage, setResendMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('Invalid verification link')
      return
    }

    let cancelled = false

    const runVerification = async () => {
      setStatus('loading')
      setMessage('')

      try {
        const data = await verifyEmail(token)
        if (!cancelled) {
          setStatus('success')
          setMessage(data?.message || 'Email verified! You can now log in')
        }
      } catch (error) {
        if (!cancelled) {
          setStatus('error')
          setMessage(error?.response?.data?.message || 'Unable to verify your email right now.')
        }
      }
    }

    runVerification()

    return () => {
      cancelled = true
    }
  }, [token, verifyEmail])

  const handleResend = async (event) => {
    event.preventDefault()
    if (!email.trim() || !validateEmail(email)) {
      setStatus('error')
      setMessage('Enter a valid email address to resend the verification link.')
      return
    }

    setResending(true)
    setResendMessage('')

    try {
      await resendVerification({ email: email.trim() })
      setResendMessage('If an account with that email exists and is not yet verified, a new verification link has been sent.')
    } catch (error) {
      setStatus('error')
      setMessage(error?.response?.data?.message || 'Unable to resend the verification email right now.')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-card-top">
          <Link className="icon-button" to="/login" aria-label="Back">←</Link>
          <div style={{ textAlign: 'right' }}>
            <h1 style={{ marginBottom: 0 }}>Verify email</h1>
            <p className="subtitle" style={{ marginBottom: 0 }}>One more step</p>
          </div>
        </div>

        {status === 'loading' ? <Skeleton className="auth-banner" lines={3} /> : null}

        {status === 'success' ? (
          <div className="auth-banner auth-banner-success">
            <p style={{ marginBottom: 0 }}>{message}</p>
            <Link className="btn" to="/login">
              Go to login
            </Link>
          </div>
        ) : null}

        {status === 'error' ? (
          <div className="auth-banner auth-banner-error">
            {message ? <p style={{ marginBottom: 0 }}>{message}</p> : null}
            <form className="auth-form-stack" onSubmit={handleResend}>
              <Input
                id="verify-email"
                name="email"
                autoComplete="email"
                label="Email address"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onInput={(event) => setEmail(event.target.value)}
                error={validateEmail(email) ? '' : 'Enter a valid email address.'}
              />
              <Button type="submit" disabled={resending}>{resending ? 'Sending…' : 'Resend verification email'}</Button>
            </form>
            {resendMessage ? <div className="auth-banner auth-banner-success" style={{ marginTop: 12 }}><p style={{ marginBottom: 0 }}>{resendMessage}</p></div> : null}
            <Link className="auth-inline-link" to="/login">Back to login</Link>
          </div>
        ) : null}
      </div>
    </div>
  )
}
