const USERNAME_MIN_LENGTH = 3
const USERNAME_MAX_LENGTH = 20
const PASSWORD_MIN_LENGTH = 8
const PASSWORD_MAX_LENGTH = 128
const USERNAME_REGEX = /^[a-zA-Z0-9_.-]+$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const isArtistApproved = (user) => (
  user?.role === 'artist' && user?.artistVerification?.status === 'approved'
)

export const isAdmin = (user) => user?.role === 'admin'

export const validateEmail = (email = '') => EMAIL_REGEX.test(String(email).trim())

export const validateUsername = (username = '') => {
  const value = String(username || '').trim()
  return (
    value.length >= USERNAME_MIN_LENGTH &&
    value.length <= USERNAME_MAX_LENGTH &&
    USERNAME_REGEX.test(value)
  )
}

export const validatePassword = (password = '') => {
  const value = String(password || '')
  return value.length >= PASSWORD_MIN_LENGTH && value.length <= PASSWORD_MAX_LENGTH
}

export const validateIdentifier = (identifier = '') => {
  const value = String(identifier || '').trim()
  return validateEmail(value) || validateUsername(value)
}

export const getUsernameRequirements = () =>
  `Username must be ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} characters and may contain letters, numbers, dots, hyphens, and underscores.`

export const getPasswordRequirements = () =>
  `Password must be ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} characters.`

export const getEmailRequirements = () => 'Enter a valid email address.'

export const getRegisterFieldErrors = ({ username = '', email = '', password = '', confirmPassword = '' }) => {
  const errors = {}

  if (!username.trim()) {
    errors.username = 'Choose a username.'
  } else if (!validateUsername(username)) {
    errors.username = getUsernameRequirements()
  }

  if (!email.trim()) {
    errors.email = 'Enter your email address.'
  } else if (!validateEmail(email)) {
    errors.email = getEmailRequirements()
  }

  if (!password) {
    errors.password = 'Enter a password.'
  } else if (!validatePassword(password)) {
    errors.password = getPasswordRequirements()
  }

  if (!confirmPassword) {
    errors.confirmPassword = 'Confirm your password.'
  } else if (password !== confirmPassword) {
    errors.confirmPassword = 'Passwords must match.'
  }

  return errors
}

export const getLoginFieldErrors = ({ identifier = '', password = '' }) => {
  const errors = {}

  if (!identifier.trim()) {
    errors.identifier = 'Enter your email or username.'
  }

  if (!password) {
    errors.password = 'Enter your password.'
  }

  return errors
}

export const getForgotPasswordFieldErrors = ({ email = '' }) => {
  const errors = {}

  if (!email.trim()) {
    errors.email = 'Enter your email address.'
  } else if (!validateEmail(email)) {
    errors.email = getEmailRequirements()
  }

  return errors
}

export const getResetPasswordFieldErrors = ({ password = '', confirmPassword = '' }) => {
  const errors = {}

  if (!password) {
    errors.password = 'Enter a password.'
  } else if (!validatePassword(password)) {
    errors.password = getPasswordRequirements()
  }

  if (!confirmPassword) {
    errors.confirmPassword = 'Confirm your password.'
  } else if (password !== confirmPassword) {
    errors.confirmPassword = 'Passwords must match.'
  }

  return errors
}

export const extractFieldErrors = (error) => {
  const errors = error?.response?.data?.errors || []
  const fieldErrors = {}

  if (Array.isArray(errors)) {
    errors.forEach((item) => {
      const param = item?.param || 'general'
      if (!fieldErrors[param]) {
        fieldErrors[param] = item?.msg || item?.message || 'Invalid value'
      }
    })
  }

  if (!Object.keys(fieldErrors).length && error?.response?.data?.message) {
    fieldErrors.general = error.response.data.message
  }

  return fieldErrors
}
