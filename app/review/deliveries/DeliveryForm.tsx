'use client'

import { useState, useTransition } from 'react'
import { recordDelivery } from './actions'

interface Tank { id: string; label: string; fuel_grade_id: string }

interface Props {
  stationId: string
  tanks: Tank[]
}

export function DeliveryForm({ stationId, tanks }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [pending, startTransition] = useTransition()

  const now = new Date()
  const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await recordDelivery(fd)
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
      <input type="hidden" name="station_id" value={stationId} />

      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="tank_id">Tank</label>
        <select
          id="tank_id"
          name="tank_id"
          required
          className="w-full border rounded-md px-3 py-2 text-sm"
        >
          <option value="">Select tank</option>
          {tanks.map(t => (
            <option key={t.id} value={t.id}>
              {t.label} ({t.fuel_grade_id})
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="litres_received">Litres received</label>
        <input
          id="litres_received"
          name="litres_received"
          type="number"
          step="0.01"
          min="0.01"
          required
          placeholder="e.g. 15000"
          className="w-full border rounded-md px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="delivered_at">Delivery time</label>
        <input
          id="delivered_at"
          name="delivered_at"
          type="datetime-local"
          defaultValue={localIso}
          required
          className="w-full border rounded-md px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="delivery_note_url">
          Delivery note photo URL
          <span className="text-muted-foreground font-normal"> (optional)</span>
        </label>
        <input
          id="delivery_note_url"
          name="delivery_note_url"
          type="url"
          placeholder="https://..."
          className="w-full border rounded-md px-3 py-2 text-sm"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-green-600">Delivery recorded.</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-primary text-primary-foreground rounded-md py-2 text-sm font-medium disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Record delivery'}
      </button>
    </form>
  )
}
