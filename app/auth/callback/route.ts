import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveCallbackRedirect } from '@/lib/user-management'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  let exchangeFailed = false
  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) exchangeFailed = true
  }

  const path = resolveCallbackRedirect(code, exchangeFailed)
  return NextResponse.redirect(`${origin}${path}`)
}
