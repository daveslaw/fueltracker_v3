import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/upload/delivery-photo/route'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createClient } from '@/lib/supabase/server'

const mockFile = new File(['data'], 'slip.jpg', { type: 'image/jpeg' })

function mockSupabase(
  user: object | null = { id: 'u1' },
  uploadError: { message: string } | null = null,
) {
  const fromSpy = vi.fn().mockReturnValue({
    upload: vi.fn().mockResolvedValue({ error: uploadError }),
    getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/delivery.jpg' } }),
  })
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user } }) },
    storage: { from: fromSpy },
  } as any)
  return { fromSpy }
}

function makeRequest(fields: { file?: File | null; shiftId?: string | null } = {}) {
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

describe('delivery-photo upload route', () => {
  beforeEach(() => {
    mockSupabase()
  })

  it('uploads to shift-photos bucket, not delivery-photos', async () => {
    const { fromSpy } = mockSupabase()
    await POST(makeRequest() as any)
    expect(fromSpy).toHaveBeenCalledWith('shift-photos')
    expect(fromSpy).not.toHaveBeenCalledWith('delivery-photos')
  })

  it('authenticated upload → returns url', async () => {
    const res = await POST(makeRequest() as any)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.url).toBe('https://example.com/delivery.jpg')
  })

  it('file path scoped under shifts/{shiftId}/deliveries/', async () => {
    const { fromSpy } = mockSupabase()
    await POST(makeRequest({ shiftId: 'abc-123' }) as any)
    const uploadCall = fromSpy().upload.mock.calls[0]
    expect(uploadCall[0]).toMatch(/^shifts\/abc-123\/deliveries\//)
  })

  it('missing file → 400', async () => {
    const res = await POST(makeRequest({ file: null }) as any)
    expect(res.status).toBe(400)
  })

  it('missing shiftId → 400', async () => {
    const res = await POST(makeRequest({ shiftId: null }) as any)
    expect(res.status).toBe(400)
  })

  it('unauthenticated → 401', async () => {
    mockSupabase(null)
    const res = await POST(makeRequest() as any)
    expect(res.status).toBe(401)
  })

  it('storage error → 500 with message', async () => {
    mockSupabase({ id: 'u1' }, { message: 'Bucket not found' })
    const res = await POST(makeRequest() as any)
    const body = await res.json()
    expect(res.status).toBe(500)
    expect(body.error).toBe('Bucket not found')
  })
})
