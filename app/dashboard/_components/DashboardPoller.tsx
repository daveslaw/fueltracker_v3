'use client'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

/** Silently refreshes the dashboard every 30 seconds without a full page reload. */
export function DashboardPoller() {
  const router = useRouter()
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 30_000)
    return () => clearInterval(id)
  }, [router])
  return null
}
