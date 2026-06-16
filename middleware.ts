import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { resolveRedirect } from '@/lib/middleware-utils'
import type { UserProfile, ActiveShift } from '@/lib/middleware-utils'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  let profile: UserProfile | null = null
  if (user) {
    const { data } = await supabase
      .from('user_profiles')
      .select('role, is_active, station_id')
      .eq('user_id', user.id)
      .single()
    if (data) {
      profile = data as UserProfile
    }
  }

  let activeShift: ActiveShift = null
  if (profile && request.nextUrl.pathname === '/') {
    if (profile.role === 'cashier' && profile.station_id) {
      const { data } = await supabase
        .from('shifts')
        .select('id')
        .eq('station_id', profile.station_id)
        .eq('status', 'pending')
        .is('cashier_submitted_at', null)
        .limit(2)
      activeShift = data?.length === 1 ? { id: data[0].id } : null
    } else if (profile.role === 'supervisor' && profile.station_id) {
      const { data } = await supabase
        .from('shifts')
        .select('id')
        .eq('station_id', profile.station_id)
        .eq('status', 'pending')
        .not('cashier_submitted_at', 'is', null)
        .limit(2)
      activeShift = data?.length === 1 ? { id: data[0].id } : null
    }
  }

  const redirect = resolveRedirect(profile, request.nextUrl.pathname, activeShift)
  if (redirect) {
    return NextResponse.redirect(new URL(redirect, request.url))
  }

  return response
}

export const config = {
  matcher: ['/', '/shift/:path*', '/dashboard/:path*', '/cashier/:path*', '/setup', '/setup/:path*'],
}
