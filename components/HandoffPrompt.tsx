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
  const [armed, setArmed] = useState(false)
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

  // Stage 1: inline trigger — lets the page's own content stay usable until
  // the user explicitly signals they're done.
  if (!armed) {
    return (
      <button
        onClick={() => setArmed(true)}
        className="w-full rounded-lg border py-3 text-sm font-semibold"
        style={{ borderColor: '#F59F00', color: '#B8770A' }}
      >
        {ctaLabel}
      </button>
    )
  }

  // Stage 2: full-screen, unavoidable confirmation — the only way out is to
  // actually sign out, or cancel back to stage 1.
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

      {!pending && (
        <button
          onClick={() => setArmed(false)}
          className="text-sm underline"
          style={{ color: '#8A93A6' }}
        >
          Cancel
        </button>
      )}
    </div>
  )
}
