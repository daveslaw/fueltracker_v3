import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NozzlePosForm } from '@/components/NozzlePosForm'
import type { NozzlePosOcrResult } from '@/lib/ocr/parse-nozzle-pos'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))

const pumps = [
  { id: 'p1', label: '1', fuel_grade_id: 'grade-95' },
  { id: 'p2', label: '2', fuel_grade_id: 'grade-d10' },
  { id: 'p3', label: '5', fuel_grade_id: 'grade-95' },
]

const prices = [
  { fuel_grade_id: 'grade-95', price: 26.84 },
  { fuel_grade_id: 'grade-d10', price: 22.50 },
]

const onSave = vi.fn().mockResolvedValue({ success: true })

function mockFetch(ocr: NozzlePosOcrResult) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ url: 'https://cdn.example.com/photo.jpg', ocr }),
  }))
}

function renderForm() {
  return render(
    <NozzlePosForm
      shiftId="shift-1"
      pumps={pumps}
      prices={prices}
      existingLines={[]}
      existingPhotoUrl={null}
      onSave={onSave}
    />
  )
}

async function uploadPhoto() {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  const file = new File(['img'], 'z-report.jpg', { type: 'image/jpeg' })
  await userEvent.upload(input, file)
}

beforeEach(() => {
  mockPush.mockClear()
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 100, height: 100 }))
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as any)
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) => {
    cb!(new Blob(['img'], { type: 'image/jpeg' }))
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

// ── Tracer bullet ─────────────────────────────────────────────────────────────

describe('NozzlePosForm OCR summary line', () => {
  it('shows unmatched nozzle count when OCR returns nozzle numbers with no matching pump', async () => {
    mockFetch({
      status: 'auto',
      raw_text: '',
      lines: [
        { nozzle_number: 99, litres_sold: 50, revenue_zar: 1342, extracted_rate: 26.84 },
      ],
    })

    renderForm()
    await uploadPhoto()

    await waitFor(() =>
      expect(screen.getByText(/1 nozzle unmatched \(ignored\)/)).toBeInTheDocument()
    )
  })

  // ── Summary line content ──────────────────────────────────────────────────

  it('shows plural "nozzles" when more than one nozzle is unmatched', async () => {
    mockFetch({
      status: 'auto',
      raw_text: '',
      lines: [
        { nozzle_number: 97, litres_sold: 50, revenue_zar: 1342, extracted_rate: 26.84 },
        { nozzle_number: 98, litres_sold: 50, revenue_zar: 1342, extracted_rate: 26.84 },
      ],
    })

    renderForm()
    await uploadPhoto()

    await waitFor(() =>
      expect(screen.getByText(/2 nozzles unmatched \(ignored\)/)).toBeInTheDocument()
    )
  })

  it('shows pump label for rate mismatch after OCR', async () => {
    mockFetch({
      status: 'auto',
      raw_text: '',
      lines: [
        // nozzle 1 matches pump p1 (grade-95, price 26.84) — extracted rate differs by > 0.05
        { nozzle_number: 1, litres_sold: 50, revenue_zar: 1500, extracted_rate: 30.00 },
      ],
    })

    renderForm()
    await uploadPhoto()

    await waitFor(() =>
      expect(screen.getByText(/rate mismatch on pump 1/)).toBeInTheDocument()
    )
  })

  it('combines both issues in a single line separated by ·', async () => {
    mockFetch({
      status: 'auto',
      raw_text: '',
      lines: [
        // nozzle 1 matches pump p1 — rate mismatch
        { nozzle_number: 1, litres_sold: 50, revenue_zar: 1500, extracted_rate: 30.00 },
        // nozzle 99 — unmatched
        { nozzle_number: 99, litres_sold: 20, revenue_zar: 537, extracted_rate: 26.84 },
      ],
    })

    renderForm()
    await uploadPhoto()

    await waitFor(() => {
      const summary = screen.getByText(/nozzle unmatched/)
      expect(summary.textContent).toMatch(/1 nozzle unmatched \(ignored\)/)
      expect(summary.textContent).toMatch(/rate mismatch on pump 1/)
      expect(summary.textContent).toContain('·')
    })
  })

  it('shows no summary line when OCR produces no issues', async () => {
    mockFetch({
      status: 'auto',
      raw_text: '',
      lines: [
        // nozzle 1 matches pump p1, rate matches configured price exactly
        { nozzle_number: 1, litres_sold: 50, revenue_zar: 1342, extracted_rate: 26.84 },
      ],
    })

    renderForm()
    await uploadPhoto()

    await waitFor(() =>
      expect(screen.queryByText(/unmatched|mismatch/)).not.toBeInTheDocument()
    )
  })

  // ── Submission gate ───────────────────────────────────────────────────────

  // ── Redirect after save ───────────────────────────────────────────────────

  it('navigates to redirectTo after successful save', async () => {
    const user = userEvent.setup()
    render(
      <NozzlePosForm
        shiftId="shift-1"
        pumps={pumps}
        prices={prices}
        existingLines={[]}
        existingPhotoUrl={null}
        onSave={onSave}
        redirectTo="/cashier/shift-1/stock-pos"
      />
    )

    await user.type(screen.getAllByPlaceholderText('0.00')[0], '100')
    await user.click(screen.getByRole('button', { name: /save z-report/i }))

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/cashier/shift-1/stock-pos'))
  })

  it('does not navigate when redirectTo is omitted', async () => {
    const user = userEvent.setup()
    render(
      <NozzlePosForm
        shiftId="shift-1"
        pumps={pumps}
        prices={prices}
        existingLines={[]}
        existingPhotoUrl={null}
        onSave={onSave}
      />
    )

    await user.type(screen.getAllByPlaceholderText('0.00')[0], '100')
    await user.click(screen.getByRole('button', { name: /save z-report/i }))

    await waitFor(() => expect(screen.getByText(/z-report saved/i)).toBeInTheDocument())
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('does not navigate when save fails', async () => {
    const failSave = vi.fn().mockResolvedValue({ error: 'Server error' })
    const user = userEvent.setup()
    render(
      <NozzlePosForm
        shiftId="shift-1"
        pumps={pumps}
        prices={prices}
        existingLines={[]}
        existingPhotoUrl={null}
        onSave={failSave}
        redirectTo="/cashier/shift-1/stock-pos"
      />
    )

    await user.type(screen.getAllByPlaceholderText('0.00')[0], '100')
    await user.click(screen.getByRole('button', { name: /save z-report/i }))

    await waitFor(() => expect(screen.getByText('Server error')).toBeInTheDocument())
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('submit button is enabled even when OCR returned unmatched nozzles', async () => {
    mockFetch({
      status: 'auto',
      raw_text: '',
      lines: [
        { nozzle_number: 99, litres_sold: 50, revenue_zar: 1342, extracted_rate: 26.84 },
      ],
    })

    renderForm()
    await uploadPhoto()

    await waitFor(() =>
      expect(screen.getByText(/nozzle unmatched/)).toBeInTheDocument()
    )

    expect(screen.getByRole('button', { name: /save z-report/i })).not.toBeDisabled()
  })
})
