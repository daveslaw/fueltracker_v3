'use client'

import { useState } from 'react'
import { saveCloseDipReading } from '../../../actions'
import { useOfflineQueue } from '@/components/OfflineQueueProvider'

type Props = { shiftId: string; tankId: string; defaultLitres: string }

export function CloseDipForm({ shiftId, tankId, defaultLitres }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [saved, setSaved] = useState(!!defaultLitres)
  const { addToQueue } = useOfflineQueue()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const formData = new FormData(e.currentTarget)

    if (!navigator.onLine) {
      await addToQueue(
        { type: 'dip_reading', shiftId, tankId, readingType: 'close', litres: parseFloat(formData.get('litres') as string) },
        `dip_reading:${shiftId}:${tankId}:close`,
      )
      setPending(false)
      setSaved(true)
      return
    }

    const result = await saveCloseDipReading(shiftId, tankId, formData)
    setPending(false)
    if ('error' in result) { setError(result.error); return }
    setSaved(true)
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-3 items-end">
      <div className="flex-1">
        <label className="block text-xs font-medium mb-1 text-gray-600">Closing litres</label>
        <input
          name="litres"
          type="number"
          step="0.1"
          min="0"
          defaultValue={defaultLitres}
          required
          className="w-full rounded border px-3 py-2 text-sm"
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-black px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
      >
        {pending ? '…' : saved ? 'Update' : 'Save'}
      </button>
    </form>
  )
}
