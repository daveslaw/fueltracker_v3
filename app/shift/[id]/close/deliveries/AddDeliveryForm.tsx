'use client'

import { useState, useRef } from 'react'
import { saveDelivery } from '../../../actions'

type Tank = { id: string; label: string; fuel_grade_id: string }

type Props = {
  shiftId: string
  tanks: Tank[]
}

export function AddDeliveryForm({ shiftId, tanks }: Props) {
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoName, setPhotoName] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)
    setPhotoUrl(null)

    const fd = new FormData()
    fd.append('file', file)
    fd.append('shiftId', shiftId)

    const res = await fetch('/api/upload/delivery-photo', { method: 'POST', body: fd })
    const json = await res.json()
    setUploading(false)

    if (json.error) {
      setError(`Photo upload failed: ${json.error}`)
      return
    }
    setPhotoUrl(json.url)
    setPhotoName(file.name)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!photoUrl) { setError('Receipt photo is required'); return }

    setSaving(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    formData.set('delivery_note_url', photoUrl)

    const result = await saveDelivery(shiftId, formData)
    setSaving(false)

    if (result && 'error' in result) {
      setError(result.error)
      return
    }

    // Reset form
    formRef.current?.reset()
    setPhotoUrl(null)
    setPhotoName(null)
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="border rounded-md p-4 space-y-4">
      <h3 className="font-medium text-sm">Add delivery</h3>

      {/* Tank selector */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Tank</label>
        <select
          name="tank_id"
          required
          className="w-full rounded border px-3 py-2 text-sm"
          defaultValue=""
        >
          <option value="" disabled>Select tank…</option>
          {tanks.map(t => (
            <option key={t.id} value={t.id}>
              {t.label} ({t.fuel_grade_id})
            </option>
          ))}
        </select>
      </div>

      {/* Litres */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Litres received</label>
        <input
          name="litres_received"
          type="number"
          step="0.01"
          min="0.01"
          required
          placeholder="e.g. 8000"
          className="w-full rounded border px-3 py-2 text-sm"
        />
      </div>

      {/* Receipt photo */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Delivery receipt photo (required)</label>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          required
          onChange={handlePhotoChange}
          className="w-full text-sm"
        />
        {uploading && <p className="text-xs text-gray-400 mt-1">Uploading…</p>}
        {photoName && !uploading && (
          <p className="text-xs text-green-600 mt-1">Uploaded: {photoName}</p>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving || uploading || !photoUrl}
        className="w-full rounded bg-black py-2 text-sm font-medium text-white disabled:opacity-40"
      >
        {saving ? 'Saving…' : 'Save delivery'}
      </button>
    </form>
  )
}
