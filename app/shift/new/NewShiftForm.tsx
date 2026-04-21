'use client'

import { useState } from 'react'
import { createShift } from '../actions'

type Props = {
  stationId: string
  currentPeriod: 'morning' | 'evening'
}

export function NewShiftForm({ stationId, currentPeriod }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const formData = new FormData(e.currentTarget)
    const result = await createShift(formData)
    if (result && 'error' in result) {
      setError(result.error)
      setPending(false)
    }
  }

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
      <button type="submit" disabled={pending}
        className="w-full rounded bg-black py-2 text-sm font-medium text-white disabled:opacity-50">
        {pending ? 'Creating…' : 'Begin close check'}
      </button>
    </form>
  )
}
