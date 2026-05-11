import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeHandler } from '@/app/api/upload/pos-photo/route'
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

  it('authenticated upload → returns url and structured ocr lines', async () => {
    fake.posResult = {
      lines: [{ grade_id: 'D50', litres_sold: 520.0, revenue_zar: 12480.0 }],
      raw_text: 'D50 | 520.0 | 12480.0',
      status: 'auto',
    }
    const handler = makeHandler(fake)
    const res = await handler(makeRequest() as any)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.url).toBe('https://example.com/pos.jpg')
    expect(body.ocr.lines).toHaveLength(1)
    expect(body.ocr.lines[0].grade_id).toBe('D50')
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
})
