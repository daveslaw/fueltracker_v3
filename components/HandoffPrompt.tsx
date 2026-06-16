'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getStationId } from '@/lib/station-device'

type Props = {
  message: string
  ctaLabel: string
}

export function HandoffPrompt({ message, ctaLabel }: Props) {
  const router = useRouter()
  const [isTablet, setIsTablet] = useState<boolean | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    setIsTablet(getStationId() !== null)
  }, [])

  // Only show on station tablets
  if (!isTablet) return null

  async function handleHandoff() {
    setPending(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 p-8"
      style={{ background: '#0B0F1A' }}
    >
      {/* Brand mark */}
      <div className="flex items-center gap-2.5">
        <div
          style={{
            width: 10,
            height: 10,
            background: '#F59F00',
            borderRadius: 2,
            transform: 'rotate(45deg)',
            flexShrink: 0,
          }}
        />
        <span
          className="text-xs font-semibold tracking-[0.22em] uppercase"
          style={{ color: '#F59F00' }}
        >
          FuelTracker
        </span>
      </div>

      <p
        className="text-3xl font-bold text-center leading-tight"
        style={{ color: '#E8EDF4' }}
      >
        {message}
      </p>

      <button
        onClick={handleHandoff}
        disabled={pending}
        className="rounded-2xl px-10 py-5 text-xl font-bold tracking-wide transition-opacity disabled:opacity-50"
        style={{ background: '#F59F00', color: '#0B0F1A' }}
      >
        {pending ? 'Signing out…' : ctaLabel}
      </button>
    </div>
  )
}
