'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PinPad } from './PinPad'
import { pinSignIn } from '@/app/(auth)/login/actions'

type StationUser = {
  id: string
  full_name: string
  role: 'supervisor' | 'cashier'
}

const ROLE_HOME: Record<string, string> = {
  supervisor: '/shift',
  cashier: '/cashier',
  owner: '/dashboard',
}

type Props = {
  stationId: string
}

export function UserPicker({ stationId }: Props) {
  const router = useRouter()
  const [users, setUsers] = useState<StationUser[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<StationUser | null>(null)
  const [pinError, setPinError] = useState<string | null>(null)
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null)

  useEffect(() => {
    fetch(`/api/station-users?stationId=${encodeURIComponent(stationId)}`)
      .then((r) => r.json())
      .then((data: StationUser[]) => setUsers(data))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false))
  }, [stationId])

  async function handlePinSubmit(pin: string) {
    if (!selectedUser) return
    setPinError(null)
    setAttemptsRemaining(null)

    const result = await pinSignIn(selectedUser.id, pin)

    if (!result.ok) {
      setAttemptsRemaining(result.attemptsRemaining)
      throw new Error(
        result.locked
          ? 'Account locked — contact an owner to reset.'
          : result.error
      )
    }

    const supabase = createClient()
    await supabase.auth.setSession({
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
    })
    router.push(ROLE_HOME[selectedUser.role] ?? '/')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-sm text-gray-400">Loading staff…</span>
      </div>
    )
  }

  if (selectedUser) {
    return (
      <PinPad
        userName={selectedUser.full_name}
        onSubmit={handlePinSubmit}
        onBack={() => { setSelectedUser(null); setPinError(null) }}
      />
    )
  }

  return (
    <div className="w-full space-y-4">
      <p className="text-sm text-center text-gray-400">Select your name to sign in</p>
      <div className="grid grid-cols-2 gap-3">
        {users.map((u) => (
          <button
            key={u.id}
            onClick={() => setSelectedUser(u)}
            className="flex flex-col items-center gap-1 rounded-xl p-4 bg-white/10 hover:bg-white/20 active:bg-white/30 transition-colors"
          >
            <span className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-semibold text-lg">
              {u.full_name.charAt(0).toUpperCase()}
            </span>
            <span className="text-sm font-medium text-white text-center leading-tight">
              {u.full_name}
            </span>
            <span className="text-xs text-gray-400 capitalize">{u.role}</span>
          </button>
        ))}
      </div>
      {users.length === 0 && (
        <p className="text-center text-sm text-gray-500 py-6">No staff configured for this station.</p>
      )}
    </div>
  )
}
