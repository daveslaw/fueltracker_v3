'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createShift } from '../actions'

type Props = {
  stationId: string
  currentPeriod: 'morning' | 'evening'
}

export function NewShiftForm({ stationId, currentPeriod }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [existingShiftId, setExistingShiftId] = useState<string | null>(null)
  const [existingShiftStatus, setExistingShiftStatus] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setExistingShiftId(null)
    setPending(true)
    const formData = new FormData(e.currentTarget)
    const result = await createShift(formData)
    if (result && 'error' in result) {
      setError(result.error)
      setExistingShiftId(result.existingShiftId ?? null)
      setExistingShiftStatus(result.existingShiftStatus ?? null)
      setPending(false)
    }
  }

  const existingHref = existingShiftId
    ? existingShiftStatus === 'closed'
      ? `/shift/${existingShiftId}/close/summary`
      : `/shift/${existingShiftId}/close/pumps`
    : null

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input type="hidden" name="station_id" value={stationId} />
      <div>
        <label className="block text-sm font-medium mb-1">Period</label>
        <select name="period" defaultValue={currentPeriod}
          className="w-full rounded border px-3 py-2 text-sm">
          <option value="morning">Morning</option>
          <option value="evening">Evening</option>
        </select>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {existingHref ? (
        <button
          type="button"
          onClick={() => router.push(existingHref)}
          className="w-full rounded bg-yellow-500 py-2 text-sm font-medium text-white"
        >
          Continue existing shift
        </button>
      ) : (
        <button type="submit" disabled={pending}
          className="w-full rounded bg-black py-2 text-sm font-medium text-white disabled:opacity-50">
          {pending ? 'Creating…' : 'Begin close check'}
        </button>
      )}
    </form>
  )
}
