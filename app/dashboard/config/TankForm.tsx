'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createTank, updateTank } from './actions'

type Tank = { id: string; label: string; fuel_grade_id: string; capacity_litres: number }

export function TankForm({
  stationId,
  gradeIds,
  tank,
}: {
  stationId: string
  gradeIds: string[]
  tank?: Tank
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const formData = new FormData(e.currentTarget)
    const result = tank
      ? await updateTank(tank.id, formData)
      : await createTank(stationId, formData)
    setPending(false)
    if ('error' in result) { setError(result.error); return }
    router.push('/dashboard/config')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Label</label>
        <input name="label" defaultValue={tank?.label ?? ''} required
          className="w-full rounded border px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Fuel Grade</label>
        <select name="fuel_grade_id" defaultValue={tank?.fuel_grade_id ?? ''}
          className="w-full rounded border px-3 py-2 text-sm">
          <option value="">Select grade…</option>
          {gradeIds.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Capacity (litres)</label>
        <input name="capacity_litres" type="number" min="1" step="1"
          defaultValue={tank?.capacity_litres ?? ''}
          className="w-full rounded border px-3 py-2 text-sm" />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={pending}
        className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
        {pending ? 'Saving…' : tank ? 'Update tank' : 'Add tank'}
      </button>
    </form>
  )
}
