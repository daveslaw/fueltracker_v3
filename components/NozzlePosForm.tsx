'use client'

import { useRef, useState, useTransition } from 'react'
import { matchNozzlesToPumps, isRateMismatch } from '@/lib/pos-capture'
import type { NozzlePosOcrResult } from '@/lib/ocr/parse-nozzle-pos'
import type { PosNozzleLineInput } from '@/app/shift/actions'

export type PumpWithGrade = {
  id: string
  label: string
  fuel_grade_id: string
}

export type GradePrice = {
  fuel_grade_id: string
  price: number
}

type EditableLine = {
  pump_id: string
  pump_label: string
  litres_sold: string
  revenue_zar: string
  ocr_status: 'auto' | 'manual_override' | 'unreadable'
}

type RateMismatch = {
  pump_id: string
  extracted: number
  configured: number
  dismissed: boolean
}

type UnmatchedAssignment = {
  nozzle_number: number
  assigned_pump_id: string
}

type Props = {
  shiftId: string
  pumps: PumpWithGrade[]
  prices: GradePrice[]
  existingLines: { pump_id: string; litres_sold: string; revenue_zar: string }[]
  existingPhotoUrl: string | null
  onSave: (
    shiftId: string,
    photoUrl: string | null,
    rawOcr: unknown,
    lines: PosNozzleLineInput[]
  ) => Promise<{ error: string } | { success: true }>
  uploadPath?: string
}

type OcrPhase =
  | { phase: 'idle' }
  | { phase: 'uploading' }
  | { phase: 'done'; result: NozzlePosOcrResult }

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

function sortedPumps(pumps: PumpWithGrade[]): PumpWithGrade[] {
  return [...pumps].sort((a, b) => parseInt(a.label, 10) - parseInt(b.label, 10))
}

export function NozzlePosForm({
  shiftId,
  pumps,
  prices,
  existingLines,
  existingPhotoUrl,
  onSave,
  uploadPath = `fuel-z-${shiftId}.jpg`,
}: Props) {
  const sorted = sortedPumps(pumps)
  const priceByGrade = new Map(prices.map(p => [p.fuel_grade_id, p.price]))

  const initialLines = (): EditableLine[] => {
    if (existingLines.length) {
      return existingLines.map(l => {
        const pump = pumps.find(p => p.id === l.pump_id)
        return {
          pump_id: l.pump_id,
          pump_label: pump?.label ?? l.pump_id,
          litres_sold: l.litres_sold,
          revenue_zar: l.revenue_zar,
          ocr_status: 'manual_override' as const,
        }
      })
    }
    return sorted.map(p => ({
      pump_id: p.id,
      pump_label: p.label,
      litres_sold: '',
      revenue_zar: '',
      ocr_status: 'manual_override' as const,
    }))
  }

  const [ocrPhase, setOcrPhase] = useState<OcrPhase>({ phase: 'idle' })
  const [photoUrl, setPhotoUrl] = useState(existingPhotoUrl)
  const [lines, setLines] = useState<EditableLine[]>(initialLines)
  const [unmatchedNozzles, setUnmatchedNozzles] = useState<number[]>([])
  const [unmatchedAssignments, setUnmatchedAssignments] = useState<UnmatchedAssignment[]>([])
  const [rateMismatches, setRateMismatches] = useState<RateMismatch[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(existingLines.length > 0)
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  function updateLine(pumpId: string, field: 'litres_sold' | 'revenue_zar', value: string) {
    setLines(prev =>
      prev.map(l => (l.pump_id === pumpId ? { ...l, [field]: value } : l))
    )
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setOcrPhase({ phase: 'uploading' })
    setError(null)
    try {
      const compressed = await compressImage(file)
      const body = new FormData()
      body.append('file', compressed, uploadPath)
      body.append('shiftId', shiftId)
      const res = await fetch('/api/upload/pos-photo', { method: 'POST', body })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setPhotoUrl(json.url)

      const ocr = json.ocr as NozzlePosOcrResult
      setOcrPhase({ phase: 'done', result: ocr })

      if (ocr?.lines?.length) {
        const { matched, unmatched } = matchNozzlesToPumps(ocr.lines, sorted)
        const ocrStatus = ocr.status === 'auto' ? 'auto' : 'unreadable'

        setLines(prev =>
          prev.map(line => {
            const hit = matched.find(m => m.pump.id === line.pump_id)
            if (!hit) return line
            return {
              ...line,
              litres_sold: hit.line.litres_sold?.toString() ?? line.litres_sold,
              revenue_zar: hit.line.revenue_zar?.toString() ?? line.revenue_zar,
              ocr_status: ocrStatus,
            }
          })
        )

        setUnmatchedNozzles(unmatched.map(u => u.nozzle_number))
        setUnmatchedAssignments([])

        const mismatches: RateMismatch[] = matched
          .filter(m => {
            const pump = pumps.find(p => p.id === m.pump.id)
            const configuredPrice = pump ? (priceByGrade.get(pump.fuel_grade_id) ?? null) : null
            if (configuredPrice === null) return false
            return isRateMismatch(m.line.extracted_rate, configuredPrice)
          })
          .map(m => {
            const pump = pumps.find(p => p.id === m.pump.id)!
            return {
              pump_id: m.pump.id,
              extracted: m.line.extracted_rate!,
              configured: priceByGrade.get(pump.fuel_grade_id)!,
              dismissed: false,
            }
          })
        setRateMismatches(mismatches)
      }
    } catch (err) {
      setOcrPhase({ phase: 'idle' })
      setError(err instanceof Error ? err.message : 'Upload failed')
    }
  }

  function assignUnmatched(nozzle_number: number, pump_id: string) {
    setUnmatchedAssignments(prev => {
      const filtered = prev.filter(a => a.nozzle_number !== nozzle_number)
      if (pump_id) return [...filtered, { nozzle_number, assigned_pump_id: pump_id }]
      return filtered
    })
  }

  function dismissUnmatched(nozzle_number: number) {
    setUnmatchedNozzles(prev => prev.filter(n => n !== nozzle_number))
    setUnmatchedAssignments(prev => prev.filter(a => a.nozzle_number !== nozzle_number))
  }

  function dismissRateMismatch(pump_id: string) {
    setRateMismatches(prev =>
      prev.map(m => (m.pump_id === pump_id ? { ...m, dismissed: true } : m))
    )
  }

  const pendingUnmatched = unmatchedNozzles.filter(
    n => !unmatchedAssignments.find(a => a.nozzle_number === n)
  )
  const canSubmit = pendingUnmatched.length === 0

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!canSubmit) {
      setError('Assign or dismiss all unmatched nozzles before submitting.')
      return
    }

    const ocrResult = ocrPhase.phase === 'done' ? ocrPhase.result : null
    const lineOcrStatus = ocrResult?.status === 'auto' ? 'auto' : 'manual_override'

    // Build lines from the editable grid
    const submittedLines: PosNozzleLineInput[] = lines
      .filter(l => l.litres_sold !== '' || l.revenue_zar !== '')
      .map(l => ({
        pump_id: l.pump_id,
        litres_sold: parseFloat(l.litres_sold) || 0,
        revenue_zar: parseFloat(l.revenue_zar) || 0,
        ocr_status: l.ocr_status === 'auto' ? 'auto' : lineOcrStatus,
      }))

    // Add manually-assigned unmatched nozzles
    if (ocrResult?.lines) {
      for (const assignment of unmatchedAssignments) {
        const nozzleLine = ocrResult.lines.find(
          l => l.nozzle_number === assignment.nozzle_number
        )
        if (!nozzleLine) continue
        const existing = submittedLines.find(l => l.pump_id === assignment.assigned_pump_id)
        if (!existing) {
          submittedLines.push({
            pump_id: assignment.assigned_pump_id,
            litres_sold: nozzleLine.litres_sold ?? 0,
            revenue_zar: nozzleLine.revenue_zar ?? 0,
            ocr_status: 'manual_override',
          })
        }
      }
    }

    if (!submittedLines.length) {
      setError('Enter at least one pump line')
      return
    }

    startTransition(async () => {
      const result = await onSave(shiftId, photoUrl, null, submittedLines)
      if ('error' in result) setError(result.error)
      else setSaved(true)
    })
  }

  const ocrDone = ocrPhase.phase === 'done'
  const ocrStatus = ocrDone ? (ocrPhase as { phase: 'done'; result: NozzlePosOcrResult }).result.status : null
  const activeMismatches = rateMismatches.filter(m => !m.dismissed)

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Photo upload */}
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

      {/* Rate mismatch warnings */}
      {activeMismatches.length > 0 && (
        <div className="rounded border border-yellow-300 bg-yellow-50 p-3 space-y-2">
          <p className="text-xs font-medium text-yellow-800">Rate mismatch detected</p>
          {activeMismatches.map(m => {
            const pump = pumps.find(p => p.id === m.pump_id)
            return (
              <div key={m.pump_id} className="flex items-center justify-between gap-2 text-xs text-yellow-700">
                <span>
                  Pump {pump?.label}: extracted R{m.extracted.toFixed(2)}, configured R{m.configured.toFixed(2)}
                </span>
                <button
                  type="button"
                  onClick={() => dismissRateMismatch(m.pump_id)}
                  className="text-yellow-600 underline shrink-0"
                >
                  Dismiss
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Unmatched nozzles warning */}
      {unmatchedNozzles.length > 0 && (
        <div className="rounded border border-red-300 bg-red-50 p-3 space-y-3">
          <p className="text-xs font-medium text-red-800">Unmatched nozzles — assign each to a pump or dismiss</p>
          {unmatchedNozzles.map(nozzle => {
            const assignment = unmatchedAssignments.find(a => a.nozzle_number === nozzle)
            return (
              <div key={nozzle} className="flex items-center gap-2 text-xs">
                <span className="text-red-700 shrink-0">Nozzle {nozzle}:</span>
                <select
                  value={assignment?.assigned_pump_id ?? ''}
                  onChange={e => assignUnmatched(nozzle, e.target.value)}
                  className="flex-1 rounded border px-2 py-1 text-xs bg-white"
                >
                  <option value="">— assign to pump —</option>
                  {sorted.map(p => (
                    <option key={p.id} value={p.id}>Pump {p.label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => dismissUnmatched(nozzle)}
                  className="text-red-600 underline shrink-0"
                >
                  Dismiss
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Pump lines */}
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3 text-xs font-medium text-gray-500">
          <span>Pump</span>
          <span>Litres sold</span>
          <span>Revenue (ZAR)</span>
        </div>
        {lines.map(line => (
          <div key={line.pump_id} className="grid grid-cols-3 gap-3 items-center">
            <span className="text-sm font-medium">{line.pump_label}</span>
            <input
              type="number" step="0.01" min="0" placeholder="0.00"
              value={line.litres_sold}
              onChange={e => updateLine(line.pump_id, 'litres_sold', e.target.value)}
              className="rounded border px-2 py-1.5 text-sm"
            />
            <input
              type="number" step="0.01" min="0" placeholder="0.00"
              value={line.revenue_zar}
              onChange={e => updateLine(line.pump_id, 'revenue_zar', e.target.value)}
              className="rounded border px-2 py-1.5 text-sm"
            />
          </div>
        ))}
        <p className="text-xs text-gray-400">Leave a pump blank if not sold this shift.</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && !error && <p className="text-sm text-green-600">Z-report saved.</p>}

      <button
        type="submit"
        disabled={isPending || ocrPhase.phase === 'uploading' || !canSubmit}
        className="w-full rounded bg-black py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? 'Saving…' : saved ? 'Update Z-report' : 'Save Z-report'}
      </button>
    </form>
  )
}
