'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { splitShift } from '@/app/shift/actions'

export function ConfirmSplitButton({ shiftId }: { shiftId: string }) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleConfirm() {
    setError(null)
    startTransition(async () => {
      const result = await splitShift(shiftId)
      if ('error' in result) {
        setError(result.error)
      } else {
        router.push(`/shift/${result.part2ShiftId}/close/pumps`)
      }
    })
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        onClick={handleConfirm}
        disabled={isPending}
        className="w-full rounded bg-amber-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {isPending ? 'Splitting shift…' : 'Confirm split — close Part 1'}
      </button>
    </div>
  )
}
