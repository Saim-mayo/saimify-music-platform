import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import Welcome from './Welcome'

describe('Welcome screen', () => {
  it('shows the polished product headline and key journey actions', () => {
    render(
      <MemoryRouter>
        <Welcome />
      </MemoryRouter>
    )

    expect(screen.getByText(/start listening/i)).toBeInTheDocument()
    expect(screen.getByText(/curated for every mood/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /get started/i })).toBeInTheDocument()
  })
})
