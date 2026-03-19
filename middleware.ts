import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { resolveRedirect } from '@/lib/middleware-utils'
import type { UserProfile } from '@/lib/middleware-utils'

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
      .select('role, is_active')
      .eq('user_id', user.id)
      .single()
    if (data) {
      profile = data as UserProfile
    }
  }

  const redirect = resolveRedirect(profile, request.nextUrl.pathname)
  if (redirect) {
    return NextResponse.redirect(new URL(redirect, request.url))
  }

  return response
}

export const config = {
  matcher: ['/', '/shift/:path*', '/review/:path*', '/dashboard/:path*'],
}
