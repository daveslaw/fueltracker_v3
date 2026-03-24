'use client'

import { useRef, useState } from 'react'
import { savePosSubmission } from '../../../actions'
import type { PosOcrResult, PosLine } from '@/lib/ocr/ocr-service'
import { useOfflineQueue } from '@/components/OfflineQueueProvider'

type GradeMeta = { id: string; label: string }

type EditableLine = {
  fuel_grade_id: string
  litres_sold: string
  revenue_zar: string
}

type Props = {
  shiftId: string
  grades: GradeMeta[]
  existingLines: EditableLine[]
  existingPhotoUrl: string | null
}

type OcrPhase =
  | { phase: 'idle' }
  | { phase: 'uploading' }
  | { phase: 'done'; result: PosOcrResult }

export function PosConfirmForm({ shiftId, grades, existingLines, existingPhotoUrl }: Props) {
  const [ocrPhase, setOcrPhase] = useState<OcrPhase>({ phase: 'idle' })
  const [photoUrl, setPhotoUrl] = useState<string | null>(existingPhotoUrl)
  const [rawOcr, setRawOcr] = useState<unknown>(null)
  const [lines, setLines] = useState<EditableLine[]>(
    existingLines.length
      ? existingLines
      : grades.map((g) => ({ fuel_grade_id: g.id, litres_sold: '', revenue_zar: '' }))
  )
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [saved, setSaved] = useState(existingLines.length > 0)
  const fileRef = useRef<HTMLInputElement>(null)
  const photoBlobRef = useRef<Blob | null>(null)
  const { addToQueue } = useOfflineQueue()

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setOcrPhase({ phase: 'uploading' })
    setError(null)

    try {
      const compressed = await compressImage(file)
      photoBlobRef.current = compressed

      if (!navigator.onLine) {
        setOcrPhase({ phase: 'idle' })
        setError('Offline — enter values manually. Photo will upload when reconnected.')
        return
      }
      const body = new FormData()
      body.append('file', compressed, `pos-z-report-${shiftId}.jpg`)
      body.append('shiftId', shiftId)

      const res = await fetch('/api/upload/pos-photo', { method: 'POST', body })
      const json = await res.json()
      if (json.error) throw new Error(json.error)

      setPhotoUrl(json.url)
      setRawOcr(json.ocr)
      setOcrPhase({ phase: 'done', result: json.ocr as PosOcrResult })

      // Pre-fill grade lines from OCR result
      if (json.ocr?.lines?.length) {
        setLines((prev) =>
          prev.map((line) => {
            const ocrLine: PosLine | undefined = json.ocr.lines.find(
              (l: PosLine) => l.grade_id === line.fuel_grade_id
            )
            if (!ocrLine) return line
            return {
              ...line,
              litres_sold: ocrLine.litres_sold?.toString() ?? '',
              revenue_zar: ocrLine.revenue_zar?.toString() ?? '',
            }
          })
        )
      }
    } catch {
      setOcrPhase({ phase: 'idle' })
      setError('Photo upload failed — enter values manually.')
    }
  }

  function updateLine(idx: number, field: 'litres_sold' | 'revenue_zar', value: string) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const validLines = lines.filter(
      (l) => l.litres_sold.trim() !== '' && l.revenue_zar.trim() !== ''
    )
    if (!validLines.length) {
      setError('Enter at least one grade line with litres and revenue.')
      return
    }

    const parsed = validLines.map((l) => ({
      fuel_grade_id: l.fuel_grade_id,
      litres_sold: parseFloat(l.litres_sold),
      revenue_zar: parseFloat(l.revenue_zar),
    }))

    if (parsed.some((l) => isNaN(l.litres_sold) || isNaN(l.revenue_zar))) {
      setError('All litres and revenue values must be numbers.')
      return
    }

    if (!navigator.onLine) {
      await addToQueue(
        { type: 'pos_submission', shiftId, rawOcr: JSON.stringify(rawOcr ?? {}), lines: parsed, photoBlob: photoBlobRef.current ?? undefined },
        `pos_submission:${shiftId}`,
      )
      setPending(false)
      setSaved(true)
      return
    }

    setPending(true)
    const result = await savePosSubmission(shiftId, photoUrl, rawOcr, parsed)
    setPending(false)
    if ('error' in result) { setError(result.error); return }
    setSaved(true)
  }

  const ocrDone = ocrPhase.phase === 'done'
  const ocrStatus = ocrDone ? ocrPhase.result.status : null

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Photo capture */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">Z-report photo</label>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoChange}
          className="text-sm"
        />
        {ocrPhase.phase === 'uploading' && (
          <p className="text-xs text-gray-500">Reading Z-report…</p>
        )}
        {ocrDone && ocrStatus === 'auto' && (
          <p className="text-xs text-green-600">Z-report read automatically — review values below.</p>
        )}
        {ocrDone && ocrStatus === 'needs_review' && (
          <p className="text-xs text-yellow-600">Some values could not be read clearly — please review.</p>
        )}
        {ocrDone && ocrStatus === 'unreadable' && (
          <p className="text-xs text-red-500">Z-report unreadable — enter all values manually.</p>
        )}
        {!ocrDone && (
          <p className="text-xs text-gray-400">Take a photo to extract values automatically, or enter manually.</p>
        )}
      </div>

      {/* Grade lines */}
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3 text-xs font-medium text-gray-500">
          <span>Grade</span>
          <span>Litres sold</span>
          <span>Revenue (ZAR)</span>
        </div>
        {lines.map((line, idx) => {
          const grade = grades.find((g) => g.id === line.fuel_grade_id)
          return (
            <div key={line.fuel_grade_id} className="grid grid-cols-3 gap-3 items-center">
              <span className="text-sm font-medium">{grade?.label ?? line.fuel_grade_id}</span>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={line.litres_sold}
                onChange={(e) => updateLine(idx, 'litres_sold', e.target.value)}
                className="rounded border px-2 py-1.5 text-sm"
              />
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={line.revenue_zar}
                onChange={(e) => updateLine(idx, 'revenue_zar', e.target.value)}
                className="rounded border px-2 py-1.5 text-sm"
              />
            </div>
          )
        })}
        <p className="text-xs text-gray-400">Leave a grade blank if it was not sold this shift.</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending || ocrPhase.phase === 'uploading'}
        className="w-full rounded bg-black py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? 'Saving…' : saved ? 'Update Z-report data' : 'Save Z-report data'}
      </button>
    </form>
  )
}

async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const maxW = 1400
  const scale = Math.min(1, maxW / bitmap.width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise((res) => canvas.toBlob((b) => res(b!), 'image/jpeg', 0.85))
}
