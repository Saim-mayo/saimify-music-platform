import { useCallback } from 'react'
import { exchangeOAuthCode, forgotPassword, resendVerification, resetPassword, verifyEmail } from '@/api'

export default function useAuthActions() {
  return {
    exchangeOAuthCode: useCallback((code) => exchangeOAuthCode(code), []),
    forgotPassword: useCallback((payload) => forgotPassword(payload), []),
    resendVerification: useCallback((payload) => resendVerification(payload), []),
    resetPassword: useCallback((payload) => resetPassword(payload), []),
    verifyEmail: useCallback((token) => verifyEmail(token), [])
  }
}
