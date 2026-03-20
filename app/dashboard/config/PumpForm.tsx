'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createPump, updatePump } from './actions'

type Tank = { id: string; label: string; fuel_grade_id: string }
type Pump = { id: string; label: string; tank_id: string }

export function PumpForm({
  stationId,
  tanks,
  pump,
}: {
  stationId: string
  tanks: Tank[]
  pump?: Pump
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const formData = new FormData(e.currentTarget)
    const result = pump
      ? await updatePump(pump.id, formData)
      : await createPump(stationId, formData)
    setPending(false)
    if ('error' in result) { setError(result.error); return }
    router.push('/dashboard/config')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Label</label>
        <input name="label" defaultValue={pump?.label ?? ''} required
          className="w-full rounded border px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Tank</label>
        <select name="tank_id" defaultValue={pump?.tank_id ?? ''}
          className="w-full rounded border px-3 py-2 text-sm">
          <option value="">Select tank…</option>
          {tanks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label} ({t.fuel_grade_id})
            </option>
          ))}
        </select>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={pending}
        className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
        {pending ? 'Saving…' : pump ? 'Update pump' : 'Add pump'}
      </button>
    </form>
  )
}
