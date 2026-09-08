import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/store'
import { Skeleton } from '@/components/common'
import useAuthActions from '@/features/auth/useAuthActions'

export default function OAuthCallback() {
  const { exchangeOAuthCode } = useAuthActions()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [message, setMessage] = useState('Finishing sign-in…')
  const fetchMe = useAuthStore((state) => state.fetchMe)

  useEffect(() => {
    const run = async () => {
      const code = searchParams.get('code')
      if (!code) {
        setMessage('Google sign-in was not completed correctly.')
        return
      }

      try {
        await exchangeOAuthCode(code)
        const user = await fetchMe()
        if (user) {
          navigate('/', { replace: true })
          return
        }

        setMessage('We could not finish your Google sign-in.')
      } catch {
        setMessage('We could not finish your Google sign-in.')
      }
    }

    run()
  }, [exchangeOAuthCode, fetchMe, navigate, searchParams])

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1>Finishing sign-in</h1>
        <p className="subtitle">We’re completing the Google flow and redirecting you back into Saimify.</p>
        {message === 'Finishing sign-in…' ? <Skeleton className="auth-banner" lines={3} /> : <div className="auth-banner auth-banner-success"><p style={{ marginBottom: 0 }}>{message}</p></div>}
      </div>
    </div>
  )
}
