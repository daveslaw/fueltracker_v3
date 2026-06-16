'use client'

import { useState } from 'react'
import { setStationId } from '@/lib/station-device'

type Station = { id: string; name: string }

export function SetupForm({
  stations,
  onAssign,
}: {
  stations: Station[]
  onAssign: (formData: FormData) => Promise<void>
}) {
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    const formData = new FormData(e.currentTarget)
    const stationId = formData.get('station_id') as string
    if (stationId) setStationId(stationId)
    await onAssign(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="station_id">
          Station
        </label>
        <select
          id="station_id"
          name="station_id"
          required
          className="w-full rounded-lg border px-3 py-2 text-sm"
        >
          <option value="">Select station…</option>
          {stations.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg py-2.5 text-sm font-bold bg-amber-500 text-white disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Assign this device'}
      </button>
    </form>
  )
}
