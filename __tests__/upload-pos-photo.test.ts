import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeHandler } from '@/app/api/upload/pos-photo/route'
import { FakeRecogniser } from '@/lib/ocr/fake-recogniser'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/ocr', () => ({ recogniser: {} }))

import { createClient } from '@/lib/supabase/server'

const mockFile = new File([new ArrayBuffer(4)], 'pos.jpg', { type: 'image/jpeg' })

function makeChain(data: unknown) {
  const chain: Record<string, unknown> = {}
  const terminal = () => Promise.resolve({ data, error: null })
  ;['select', 'eq', 'neq', 'order', 'limit'].forEach(m => { chain[m] = () => chain })
  chain['single'] = terminal
  chain['maybeSingle'] = terminal
  return chain
}

function mockSupabase(
  user: object | null = { id: 'u1' },
  options: { shiftData?: object | null } = {},
) {
  const { shiftData = { id: 'shift-1' } } = options
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user } }) },
    from: (table: string) => {
      if (table === 'user_profiles') return makeChain({ station_id: 'station-1' })
      if (table === 'shifts') return makeChain(shiftData)
      return makeChain(null)
    },
    storage: {
      from: () => ({
        upload: async () => ({ error: null }),
        getPublicUrl: () => ({ data: { publicUrl: 'https://example.com/pos.jpg' } }),
      }),
    },
  } as any)
}

function makeRequest(fields: { file?: object | null; shiftId?: string | null } = {}) {
  const { file = mockFile, shiftId = 'shift-1' } = fields
  return {
    formData: async () => ({
      get: (key: string) => {
        if (key === 'file') return file
        if (key === 'shiftId') return shiftId
        return null
      },
    }),
  }
}

describe('pos-photo upload route', () => {
  let fake: FakeRecogniser

  beforeEach(() => {
    fake = new FakeRecogniser()
    mockSupabase()
  })

  it('authenticated upload → returns url and structured nozzle ocr lines', async () => {
    fake.posResult = {
      lines: [{ nozzle_number: 5, litres_sold: 520.0, revenue_zar: 12480.0, extracted_rate: 24.0 }],
      raw_text: '5 | 24.00 | 520.0 | 12480.0',
      status: 'auto',
    }
    const handler = makeHandler(fake)
    const res = await handler(makeRequest() as any)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.url).toBe('https://example.com/pos.jpg')
    expect(body.ocr.lines).toHaveLength(1)
    expect(body.ocr.lines[0].nozzle_number).toBe(5)
    expect(body.ocr.status).toBe('auto')
  })

  it('missing shiftId → 400', async () => {
    const handler = makeHandler(fake)
    const res = await handler(makeRequest({ shiftId: null }) as any)
    expect(res.status).toBe(400)
  })

  it('unauthenticated → 401', async () => {
    mockSupabase(null)
    const handler = makeHandler(fake)
    const res = await handler(makeRequest() as any)
    expect(res.status).toBe(401)
  })

  it('disallowed file type → 400', async () => {
    const handler = makeHandler(fake)
    const badFile = new File(['data'], 'report.pdf', { type: 'application/pdf' })
    const res = await handler(makeRequest({ file: badFile }) as any)
    expect(res.status).toBe(400)
  })

  it('wrong-station shiftId → 403', async () => {
    mockSupabase({ id: 'u1' }, { shiftData: null })
    const handler = makeHandler(fake)
    const res = await handler(makeRequest() as any)
    expect(res.status).toBe(403)
  })
})
