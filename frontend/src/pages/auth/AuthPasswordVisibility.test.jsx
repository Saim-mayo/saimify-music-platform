import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import Register from './Register'
import ResetPassword from './ResetPassword'

describe('Authentication password fields', () => {
  it('shows reveal toggles on account creation and password reset forms', () => {
    const { rerender } = render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    )

    expect(screen.getAllByRole('button', { name: /toggle password visibility/i })).toHaveLength(2)

    rerender(
      <MemoryRouter>
        <ResetPassword />
      </MemoryRouter>
    )

    expect(screen.getAllByRole('button', { name: /toggle password visibility/i })).toHaveLength(2)
  })
})
