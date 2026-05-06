'use client'

import { useRef, useState, useTransition } from 'react'
import { saveCashierDryStockPos, type DryStockPosLineInput } from '../actions'
import type { DryStockLine } from '@/lib/ocr/dry-stock-ocr'

type ProductMeta = { id: string; stock_code: string; description: string }
type EditableLine = { product_id: string; units_sold: string; revenue_zar: string }

type Props = {
  shiftId: string
  products: ProductMeta[]
  savedLines: EditableLine[]
  existingPhotoUrl: string | null
}

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

export function StockPosForm({ shiftId, products, savedLines, existingPhotoUrl }: Props) {
  const [photoUrl, setPhotoUrl] = useState(existingPhotoUrl)
  const [uploading, setUploading] = useState(false)
  const [lines, setLines] = useState<EditableLine[]>(
    savedLines.length
      ? savedLines
      : products.map(p => ({ product_id: p.id, units_sold: '', revenue_zar: '' }))
  )
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(savedLines.length > 0)
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  function updateLine(idx: number, field: 'units_sold' | 'revenue_zar', value: string) {
    setLines(prev => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)))
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const compressed = await compressImage(file)
      const body = new FormData()
      body.append('file', compressed, `dry-stock-z-${shiftId}.jpg`)
      body.append('shiftId', shiftId)
      const res = await fetch('/api/upload/dry-stock-photo', { method: 'POST', body })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setPhotoUrl(json.url)

      // Match OCR lines to catalogue products by exact name, pre-fill values
      if (json.lines?.length) {
        setLines(prev => prev.map(line => {
          const product = products.find(p => p.id === line.product_id)
          if (!product) return line
          const match: DryStockLine | undefined = json.lines.find(
            (l: DryStockLine) => l.rawName.trim().toLowerCase() === product.description.trim().toLowerCase()
          )
          if (!match) return line
          return {
            ...line,
            units_sold: match.unitsSold?.toString() ?? line.units_sold,
            revenue_zar: match.revenueZar?.toString() ?? line.revenue_zar,
          }
        }))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const validLines: DryStockPosLineInput[] = lines
      .filter(l => l.units_sold !== '' || l.revenue_zar !== '')
      .map(l => ({
        product_id: l.product_id,
        units_sold: parseFloat(l.units_sold) || 0,
        revenue_zar: parseFloat(l.revenue_zar) || 0,
      }))
    if (!validLines.length) {
      setError('Enter at least one product line')
      return
    }
    startTransition(async () => {
      const result = await saveCashierDryStockPos(shiftId, photoUrl, validLines)
      if ('error' in result) setError(result.error)
      else setSaved(true)
    })
  }

  if (products.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No active products configured for this station. Ask your owner to add products in the dashboard.
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium">Dry stock Z-report photo</label>
        {photoUrl && (
          <img src={photoUrl} alt="Dry stock Z-report" className="w-full max-h-48 object-contain rounded border" />
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoChange}
          className="text-sm"
        />
        {uploading && <p className="text-xs text-gray-500">Reading Z-report…</p>}
        {!uploading && <p className="text-xs text-gray-400">Photo optional — enter values manually if preferred.</p>}
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3 text-xs font-medium text-gray-500">
          <span>Product</span>
          <span>Units sold</span>
          <span>Revenue (ZAR)</span>
        </div>
        {lines.map((line, idx) => {
          const product = products.find(p => p.id === line.product_id)
          return (
            <div key={line.product_id} className="grid grid-cols-3 gap-3 items-center">
              <span className="text-sm font-medium text-gray-900 leading-tight">
                {product?.description ?? product?.stock_code ?? line.product_id}
              </span>
              <input
                type="number" step="0.001" min="0" placeholder="0"
                value={line.units_sold}
                onChange={e => updateLine(idx, 'units_sold', e.target.value)}
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
        <p className="text-xs text-gray-400">Leave blank for products not sold this shift.</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isPending || uploading}
        className="w-full rounded bg-black py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? 'Saving…' : saved ? 'Update dry stock Z-report' : 'Save dry stock Z-report'}
      </button>
    </form>
  )
}
