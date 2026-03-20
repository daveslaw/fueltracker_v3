'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createStation, updateStation } from './actions'

type Station = { id: string; name: string; address: string | null }

export function StationForm({ station }: { station?: Station }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const formData = new FormData(e.currentTarget)
    const result = station
      ? await updateStation(station.id, formData)
      : await createStation(formData)
    setPending(false)
    if ('error' in result) { setError(result.error); return }
    router.push('/dashboard/config')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Name</label>
        <input name="name" defaultValue={station?.name ?? ''} required
          className="w-full rounded border px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Address <span className="text-gray-400">(optional)</span></label>
        <input name="address" defaultValue={station?.address ?? ''}
          className="w-full rounded border px-3 py-2 text-sm" />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={pending}
        className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
        {pending ? 'Saving…' : station ? 'Update station' : 'Create station'}
      </button>
    </form>
  )
}
