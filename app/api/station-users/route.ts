import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'

export function makeHandler(supabase: SupabaseClient) {
  return async function GET(request: NextRequest) {
    const stationId = request.nextUrl.searchParams.get('stationId')
    if (!stationId) return NextResponse.json({ error: 'stationId is required' }, { status: 400 })

    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, full_name, role')
      .eq('station_id', stationId)
      .eq('is_active', true)
      .neq('role', 'owner')
      .not('pin_hash', 'is', null)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const users = (data ?? []).map(({ id, full_name, role }) => ({ id, full_name, role }))
    return NextResponse.json(users)
  }
}

export async function GET(request: NextRequest) {
  return makeHandler(await createClient())(request)
}
