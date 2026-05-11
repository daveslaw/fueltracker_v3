import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeHandler } from '@/app/api/upload/dry-stock-photo/route'
import { FakeRecogniser } from '@/lib/ocr/fake-recogniser'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/ocr', () => ({ recogniser: {} }))

import { createClient } from '@/lib/supabase/server'

const mockFile = { arrayBuffer: async () => new ArrayBuffer(4) }

function mockSupabase(user: object | null = { id: 'u1' }) {
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user } }) },
    storage: {
      from: () => ({
        upload: async () => ({ error: null }),
        getPublicUrl: () => ({ data: { publicUrl: 'https://example.com/stock.jpg' } }),
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

describe('dry-stock-photo upload route', () => {
  let fake: FakeRecogniser

  beforeEach(() => {
    fake = new FakeRecogniser()
    mockSupabase()
  })

  it('authenticated upload → returns url and parsed product lines', async () => {
    fake.dryStockResult = [
      { rawName: 'Red Bull 250ml', unitsSold: 12, revenueZar: 360.0 },
      { rawName: 'Lays Cheese 50g', unitsSold: 8, revenueZar: 119.92 },
    ]
    const handler = makeHandler(fake)
    const res = await handler(makeRequest() as any)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.url).toBe('https://example.com/stock.jpg')
    expect(body.lines).toHaveLength(2)
    expect(body.lines[0].rawName).toBe('Red Bull 250ml')
    expect(body.lines[1].unitsSold).toBe(8)
  })

  it('unreadable image → empty lines array', async () => {
    fake.dryStockResult = []
    const handler = makeHandler(fake)
    const res = await handler(makeRequest() as any)
    const body = await res.json()
    expect(body.lines).toEqual([])
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
})
