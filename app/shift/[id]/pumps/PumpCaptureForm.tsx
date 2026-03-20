'use client'

import { useRef, useState } from 'react'
import { savePumpReading } from '../../actions'

type Props = { shiftId: string; pumpId: string; defaultMeter: string }

export function PumpCaptureForm({ shiftId, pumpId, defaultMeter }: Props) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [saved, setSaved] = useState(!!defaultMeter)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    // Compress client-side via Canvas before upload
    const url = await compressAndUpload(file, shiftId, pumpId)
    setPhotoUrl(url)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const formData = new FormData(e.currentTarget)
    if (photoUrl) formData.set('photo_url', photoUrl)
    const result = await savePumpReading(shiftId, pumpId, formData)
    setPending(false)
    if ('error' in result) { setError(result.error); return }
    setSaved(true)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Photo capture */}
      <div>
        <label className="block text-xs font-medium mb-1 text-gray-600">Photo</label>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoChange}
          className="text-sm"
        />
        {photoUrl && <p className="text-xs text-green-600 mt-1">Photo uploaded</p>}
      </div>

      {/* Meter reading */}
      <div>
        <label className="block text-xs font-medium mb-1 text-gray-600">Meter reading (L)</label>
        <input
          name="meter_reading"
          type="number"
          step="0.01"
          min="0"
          defaultValue={defaultMeter}
          required
          className="w-full rounded border px-3 py-2 text-sm"
        />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-black px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50"
      >
        {pending ? 'Saving…' : saved ? 'Update' : 'Save'}
      </button>
    </form>
  )
}

// ── client-side photo compression ─────────────────────────────────────────────

async function compressAndUpload(file: File, shiftId: string, pumpId: string): Promise<string> {
  // Compress to max 1200px wide, 0.8 quality JPEG
  const bitmap = await createImageBitmap(file)
  const maxW = 1200
  const scale = Math.min(1, maxW / bitmap.width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

  const blob: Blob = await new Promise((res) =>
    canvas.toBlob((b) => res(b!), 'image/jpeg', 0.8)
  )

  // Upload via API route to avoid exposing service role key client-side
  const body = new FormData()
  body.append('file', blob, `pump-open-${pumpId}.jpg`)
  body.append('shiftId', shiftId)
  body.append('pumpId', pumpId)

  const res = await fetch('/api/upload/pump-photo', { method: 'POST', body })
  const json = await res.json()
  return json.url as string
}
