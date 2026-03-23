'use client'

import { useState, useTransition } from 'react'
import { setPriceForGrade } from './actions'

interface Props {
  grades: { id: string }[]
}

export function SetPriceForm({ grades }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await setPriceForGrade(fd)
      if ('error' in result) {
        setError(result.error)
      } else {
        setSuccess(true)
        ;(e.target as HTMLFormElement).reset()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="fuel_grade_id">Grade</label>
        <select
          id="fuel_grade_id"
          name="fuel_grade_id"
          required
          className="w-full border rounded-md px-3 py-2 text-sm"
        >
          <option value="">Select grade</option>
          {grades.map(g => (
            <option key={g.id} value={g.id}>{g.id}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="price_per_litre">
          Price per litre (ZAR)
        </label>
        <input
          id="price_per_litre"
          name="price_per_litre"
          type="number"
          step="0.0001"
          min="0.0001"
          required
          placeholder="e.g. 21.9500"
          className="w-full border rounded-md px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="effective_from">
          Effective from
          <span className="text-muted-foreground font-normal"> (defaults to now)</span>
        </label>
        <input
          id="effective_from"
          name="effective_from"
          type="datetime-local"
          className="w-full border rounded-md px-3 py-2 text-sm"
        />
      </div>

      {error   && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-green-600">Price saved.</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-primary text-primary-foreground rounded-md py-2 text-sm font-medium disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Set price'}
      </button>
    </form>
  )
}
