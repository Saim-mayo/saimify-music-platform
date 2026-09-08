import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Button from './Button'

describe('Button', () => {
  it('renders its label and forwards click events', () => {
    const onClick = vi.fn()

    render(<Button onClick={onClick}>Save changes</Button>)

    const button = screen.getByRole('button', { name: 'Save changes' })
    expect(button).toHaveClass('btn', 'btn-primary')

    fireEvent.click(button)

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('uses the requested variant and button type', () => {
    render(<Button type="submit" variant="ghost">Continue</Button>)

    const button = screen.getByRole('button', { name: 'Continue' })
    expect(button).toHaveAttribute('type', 'submit')
    expect(button).toHaveClass('btn-ghost')
  })
})
