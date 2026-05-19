import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PhotoModal } from '@/components/PhotoModal'

function renderModal(overrides: Partial<React.ComponentProps<typeof PhotoModal>> = {}) {
  return render(
    <PhotoModal
      url="https://example.com/pump.jpg"
      label="Pump 1 — close"
      {...overrides}
    />
  )
}

describe('PhotoModal', () => {
  it('renders a trigger with "photo" text', () => {
    renderModal()
    expect(screen.getByText('photo')).toBeInTheDocument()
  })

  it('image is not visible before the trigger is clicked', () => {
    renderModal()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('clicking the trigger shows the image with the correct src', async () => {
    renderModal()
    await userEvent.click(screen.getByText('photo'))
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/pump.jpg')
  })

  it('clicking the trigger shows the label in the modal', async () => {
    renderModal()
    await userEvent.click(screen.getByText('photo'))
    expect(screen.getByText('Pump 1 — close')).toBeInTheDocument()
  })
})
