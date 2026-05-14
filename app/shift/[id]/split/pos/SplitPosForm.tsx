'use client'

import { useRef, useState, useTransition } from 'react'
import { savePosSubmission } from '@/app/shift/actions'
import type { PosLine, PosOcrResult } from '@/lib/ocr/ocr-service'

type GradeMeta = { id: string; label: string }
type EditableLine = { fuel_grade_id: string; litres_sold: string; revenue_zar: string }

type Props = {
  shiftId: string
  grades: GradeMeta[]
  existingLines: EditableLine[]
  existingPhotoUrl: string | null
}

type OcrPhase = { phase: 'idle' } | { phase: 'uploading' } | { phase: 'done'; result: PosOcrResult }

async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const maxW = 1400
  const scale = Math.min(1, maxW / bitmap.width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise(res => canvas.toBlob(b => res(b!), 'image/jpeg', 0.85))
}

export function SplitPosForm({ shiftId, grades, existingLines, existingPhotoUrl }: Props) {
  const [ocrPhase, setOcrPhase] = useState<OcrPhase>({ phase: 'idle' })
  const [photoUrl, setPhotoUrl] = useState(existingPhotoUrl)
  const [lines, setLines] = useState<EditableLine[]>(
    existingLines.length
      ? existingLines
      : grades.map(g => ({ fuel_grade_id: g.id, litres_sold: '', revenue_zar: '' }))
  )
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(existingLines.length > 0)
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  function updateLine(idx: number, field: 'litres_sold' | 'revenue_zar', value: string) {
    setLines(prev => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)))
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setOcrPhase({ phase: 'uploading' })
    setError(null)
    try {
      const compressed = await compressImage(file)
      const body = new FormData()
      body.append('file', compressed, `split-z-${shiftId}.jpg`)
      body.append('shiftId', shiftId)
      const res = await fetch('/api/upload/pos-photo', { method: 'POST', body })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setPhotoUrl(json.url)
      setOcrPhase({ phase: 'done', result: json.ocr as PosOcrResult })
      if (json.ocr?.lines?.length) {
        setLines(prev => prev.map(line => {
          const match: PosLine | undefined = json.ocr.lines.find((l: PosLine) => l.grade_id === line.fuel_grade_id)
          if (!match) return line
          return {
            ...line,
            litres_sold: match.litres_sold?.toString() ?? line.litres_sold,
            revenue_zar: match.revenue_zar?.toString() ?? line.revenue_zar,
          }
        }))
      }
    } catch (err) {
      setOcrPhase({ phase: 'idle' })
      setError(err instanceof Error ? err.message : 'Upload failed')
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const validLines = lines
      .filter(l => l.litres_sold !== '' || l.revenue_zar !== '')
      .map(l => ({
        fuel_grade_id: l.fuel_grade_id,
        litres_sold: parseFloat(l.litres_sold) || 0,
        revenue_zar: parseFloat(l.revenue_zar) || 0,
      }))
    if (!validLines.length) {
      setError('Enter at least one grade line')
      return
    }
    startTransition(async () => {
      const result = await savePosSubmission(shiftId, photoUrl, null, validLines)
      if ('error' in result) setError(result.error)
      else setSaved(true)
    })
  }

  const ocrDone = ocrPhase.phase === 'done'
  const ocrStatus = ocrDone ? (ocrPhase as { phase: 'done'; result: PosOcrResult }).result.status : null

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium">Z-report photo</label>
        {photoUrl && (
          <img src={photoUrl} alt="Z-report" className="w-full max-h-48 object-contain rounded border" />
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoChange}
          className="text-sm"
        />
        {ocrPhase.phase === 'uploading' && <p className="text-xs text-gray-500">Reading Z-report…</p>}
        {ocrDone && ocrStatus === 'auto' && <p className="text-xs text-green-600">Read automatically — review values below.</p>}
        {ocrDone && ocrStatus === 'needs_review' && <p className="text-xs text-yellow-600">Some values unclear — please review.</p>}
        {ocrDone && ocrStatus === 'unreadable' && <p className="text-xs text-red-500">Unreadable — enter values manually.</p>}
        {!ocrDone && <p className="text-xs text-gray-400">Photo optional — enter values manually if preferred.</p>}
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3 text-xs font-medium text-gray-500">
          <span>Grade</span>
          <span>Litres sold</span>
          <span>Revenue (ZAR)</span>
        </div>
        {lines.map((line, idx) => {
          const grade = grades.find(g => g.id === line.fuel_grade_id)
          return (
            <div key={line.fuel_grade_id} className="grid grid-cols-3 gap-3 items-center">
              <span className="text-sm font-medium">{grade?.label ?? line.fuel_grade_id}</span>
              <input
                type="number" step="0.01" min="0" placeholder="0.00"
                value={line.litres_sold}
                onChange={e => updateLine(idx, 'litres_sold', e.target.value)}
                className="rounded border px-2 py-1.5 text-sm"
              />
              <input
                type="number" step="0.01" min="0" placeholder="0.00"
                value={line.revenue_zar}
                onChange={e => updateLine(idx, 'revenue_zar', e.target.value)}
                className="rounded border px-2 py-1.5 text-sm"
              />
            </div>
          )
        })}
        <p className="text-xs text-gray-400">Leave a grade blank if not sold this part of the shift.</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-600">Z-report saved.</p>}

      <button
        type="submit"
        disabled={isPending || ocrPhase.phase === 'uploading'}
        className="w-full rounded bg-black py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? 'Saving…' : saved ? 'Update Z-report' : 'Save Z-report'}
      </button>
    </form>
  )
}
