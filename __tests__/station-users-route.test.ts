import { describe, it, expect } from 'vitest'
import { makeHandler } from '@/app/api/station-users/route'
import { NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

function makeSupabase(rows: object[]): SupabaseClient {
  const chain: Record<string, unknown> = {}
  chain['select'] = () => chain
  chain['eq'] = () => chain
  chain['neq'] = () => chain
  chain['not'] = () => chain
  chain['is'] = () => chain
  chain['then'] = (resolve: (v: unknown) => void) =>
    Promise.resolve({ data: rows, error: null }).then(resolve)
  return { from: () => chain } as unknown as SupabaseClient
}

function makeReq(params: Record<string, string>) {
  const url = new URL('http://localhost/api/station-users')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new NextRequest(url)
}

describe('GET /api/station-users', () => {
  it('tracer bullet: valid stationId returns 200 with id, full_name, role', async () => {
    const supabase = makeSupabase([
      { id: 'u1', full_name: 'Maria S.', role: 'cashier', pin_hash: 'hash', is_active: true },
    ])
    const handler = makeHandler(supabase)
    const res = await handler(makeReq({ stationId: 'station-1' }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual([{ id: 'u1', full_name: 'Maria S.', role: 'cashier' }])
  })

  it('response never contains email or pin_hash fields', async () => {
    const supabase = makeSupabase([
      { id: 'u1', full_name: 'Maria S.', role: 'cashier', pin_hash: 'secret', email: 'maria@example.com', is_active: true },
    ])
    const handler = makeHandler(supabase)
    const res = await handler(makeReq({ stationId: 'station-1' }))
    const body = await res.json()
    expect(body[0]).not.toHaveProperty('pin_hash')
    expect(body[0]).not.toHaveProperty('email')
  })

  it('missing stationId returns 400', async () => {
    const supabase = makeSupabase([])
    const handler = makeHandler(supabase)
    const res = await handler(makeReq({}))
    expect(res.status).toBe(400)
  })

  it('empty station returns 200 with empty array', async () => {
    const supabase = makeSupabase([])
    const handler = makeHandler(supabase)
    const res = await handler(makeReq({ stationId: 'station-unknown' }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual([])
  })
})
