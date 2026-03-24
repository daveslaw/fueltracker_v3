'use client'

import { useRef, useState } from 'react'
import { saveClosePumpReading } from '../../../actions'
import type { OcrStatus } from '@/lib/ocr/ocr-service'
import { useOfflineQueue } from '@/components/OfflineQueueProvider'

type Props = { shiftId: string; pumpId: string; defaultMeter: string }

type OcrState =
  | { phase: 'idle' }
  | { phase: 'uploading' }
  | { phase: 'done'; value: number | null; confidence: number; status: OcrStatus }
  | { phase: 'unreadable' }

export function ClosePumpCaptureForm({ shiftId, pumpId, defaultMeter }: Props) {
  const [ocr, setOcr] = useState<OcrState>({ phase: 'idle' })
  const [overridden, setOverridden] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [saved, setSaved] = useState(!!defaultMeter)
  const fileRef = useRef<HTMLInputElement>(null)
  const photoBlobRef = useRef<Blob | null>(null)
  const { addToQueue } = useOfflineQueue()

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setOcr({ phase: 'uploading' })
    setError(null)

    try {
      const compressed = await compressImage(file)
      photoBlobRef.current = compressed

      if (!navigator.onLine) {
        setOcr({ phase: 'done', value: null, confidence: 0, status: 'unreadable' })
        return
      }

      const body = new FormData()
      body.append('file', compressed, `pump-close-${pumpId}.jpg`)
      body.append('shiftId', shiftId)
      body.append('pumpId', pumpId)

      const res = await fetch('/api/upload/pump-photo', { method: 'POST', body })
      const json = await res.json()
      if (json.error) throw new Error(json.error)

      setOcr({
        phase: 'done',
        value: json.ocr?.value ?? null,
        confidence: json.ocr?.confidence ?? 0,
        status: json.ocr?.status ?? 'unreadable',
      })
    } catch {
      setOcr({ phase: 'done', value: null, confidence: 0, status: 'unreadable' })
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const formData = new FormData(e.currentTarget)

    let ocrStatus: OcrStatus = 'manual_override'
    if (ocr.phase === 'done' && !overridden) ocrStatus = ocr.status
    if (ocr.phase === 'unreadable') ocrStatus = 'unreadable'
    formData.set('ocr_status', ocrStatus)

    if (!navigator.onLine) {
      await addToQueue(
        { type: 'pump_reading', shiftId, pumpId, readingType: 'close', meterReading: parseFloat(formData.get('meter_reading') as string), ocrStatus, photoBlob: photoBlobRef.current ?? undefined, photoName: `pump-close-${pumpId}.jpg` },
        `pump_reading:${shiftId}:${pumpId}:close`,
      )
      setPending(false)
      setSaved(true)
      return
    }

    const result = await saveClosePumpReading(shiftId, pumpId, formData)
    setPending(false)
    if ('error' in result) { setError(result.error); return }
    setSaved(true)
  }

  const ocrDone = ocr.phase === 'done'
  const showLowConfidence = ocrDone && ocr.status === 'needs_review'
  const showUnreadable = ocrDone && ocr.status === 'unreadable' && !ocr.value

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
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
        {ocr.phase === 'uploading' && (
          <p className="text-xs text-gray-500 mt-1">Reading meter…</p>
        )}
        {ocrDone && ocr.status === 'auto' && (
          <p className="text-xs text-green-600 mt-1">
            Meter read automatically (confidence {Math.round(ocr.confidence * 100)}%)
          </p>
        )}
        {showLowConfidence && (
          <p className="text-xs text-yellow-600 mt-1">
            Could not read clearly — please confirm or correct the value below.
          </p>
        )}
        {showUnreadable && (
          <p className="text-xs text-red-500 mt-1">
            Photo unreadable — enter meter reading manually.
          </p>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium mb-1 text-gray-600">
          Closing meter reading (L)
          {ocrDone && !overridden && ocr.value != null && (
            <span className="ml-1 text-gray-400">(auto-filled — edit to override)</span>
          )}
        </label>
        <input
          name="meter_reading"
          type="number"
          step="0.01"
          min="0"
          required
          defaultValue={ocrDone && ocr.value != null ? ocr.value.toString() : defaultMeter}
          onChange={() => setOverridden(true)}
          className="w-full rounded border px-3 py-2 text-sm"
        />
      </div>

      {!showUnreadable && (
        <button
          type="button"
          onClick={() => setOcr({ phase: 'unreadable' })}
          className="text-xs text-gray-400 hover:text-gray-600 underline"
        >
          Mark photo as unreadable
        </button>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending || ocr.phase === 'uploading'}
        className="rounded bg-black px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50"
      >
        {pending ? 'Saving…' : saved ? 'Update' : 'Save'}
      </button>
    </form>
  )
}

async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const maxW = 1200
  const scale = Math.min(1, maxW / bitmap.width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise((res) => canvas.toBlob((b) => res(b!), 'image/jpeg', 0.8))
}
