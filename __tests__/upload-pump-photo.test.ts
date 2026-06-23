import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'
import { makeHandler } from '@/app/api/upload/pump-photo/route'
import { FakeRecogniser } from '@/lib/ocr/fake-recogniser'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/ocr', () => ({ recogniser: {} }))

import { createClient } from '@/lib/supabase/server'

type FakeSupabaseClient = Awaited<ReturnType<typeof createClient>>

const mockFile = new File([new ArrayBuffer(4)], 'photo.jpg', { type: 'image/jpeg' })

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
        getPublicUrl: () => ({ data: { publicUrl: 'https://example.com/photo.jpg' } }),
      }),
    },
  } as unknown as FakeSupabaseClient)
}

function makeRequest(fields: { file?: object | null; shiftId?: string; pumpId?: string } = {}) {
  const { file = mockFile, shiftId = 'shift-1', pumpId = 'pump-1' } = fields
  return {
    formData: async () => ({
      get: (key: string) => {
        if (key === 'file') return file
        if (key === 'shiftId') return shiftId
        if (key === 'pumpId') return pumpId
        return null
      },
    }),
  }
}

describe('pump-photo upload route', () => {
  let fake: FakeRecogniser

  beforeEach(() => {
    fake = new FakeRecogniser()
    mockSupabase()
  })

  it('authenticated upload → returns url and ocr result', async () => {
    fake.meterResult = { value: 99999, confidence: 0.95, status: 'auto' }
    const handler = makeHandler(fake)
    const res = await handler(makeRequest() as unknown as NextRequest)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.url).toBe('https://example.com/photo.jpg')
    expect(body.ocr).toEqual({ value: 99999, confidence: 0.95, status: 'auto' })
  })

  it('unreadable OCR → propagated in response', async () => {
    fake.meterResult = { value: null, confidence: 0, status: 'unreadable' }
    const handler = makeHandler(fake)
    const res = await handler(makeRequest() as unknown as NextRequest)
    const body = await res.json()
    expect(body.ocr.status).toBe('unreadable')
    expect(body.ocr.value).toBeNull()
  })

  it('missing file → 400', async () => {
    const handler = makeHandler(fake)
    const res = await handler(makeRequest({ file: null }) as unknown as NextRequest)
    expect(res.status).toBe(400)
  })

  it('unauthenticated → 401', async () => {
    mockSupabase(null)
    const handler = makeHandler(fake)
    const res = await handler(makeRequest() as unknown as NextRequest)
    expect(res.status).toBe(401)
  })

  it('disallowed file type → 400', async () => {
    const handler = makeHandler(fake)
    const badFile = new File(['data'], 'doc.pdf', { type: 'application/pdf' })
    const res = await handler(makeRequest({ file: badFile }) as unknown as NextRequest)
    expect(res.status).toBe(400)
  })

  it('wrong-station shiftId → 403', async () => {
    mockSupabase({ id: 'u1' }, { shiftData: null })
    const handler = makeHandler(fake)
    const res = await handler(makeRequest() as unknown as NextRequest)
    expect(res.status).toBe(403)
  })
})
