'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getStationId } from '@/lib/station-device'
import { useIdleTimeout } from '@/lib/idle-timeout'

const IDLE_MS = 10 * 60 * 1000 // 10 minutes

export function IdleTimeoutGuard() {
  const router = useRouter()
  const [isTablet, setIsTablet] = useState(false)

  useEffect(() => {
    setIsTablet(getStationId() !== null)
  }, [])

  useIdleTimeout(IDLE_MS, async () => {
    if (!isTablet) return
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  })

  return null
}
