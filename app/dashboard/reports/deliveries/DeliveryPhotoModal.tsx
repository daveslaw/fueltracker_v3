'use client'

import { useEffect, useCallback } from 'react'
import type { DeliveryReportRow } from '@/lib/delivery-report'

interface Props {
  row: DeliveryReportRow
  onClose: () => void
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-ZA', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function fmtL(n: number) {
  return n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' L'
}

export function DeliveryPhotoModal({ row, onClose }: Props) {
  const handleKey = useCallback(
    (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() },
    [onClose],
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [handleKey])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-3xl w-full flex flex-col sm:flex-row overflow-hidden max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Photo */}
        <div className="flex-1 bg-gray-100 flex items-center justify-center min-h-48">
          {row.deliveryNoteUrl ? (
            <img
              src={row.deliveryNoteUrl}
              alt="Delivery note"
              className="max-h-[80vh] w-full object-contain"
            />
          ) : (
            <p className="text-sm text-muted-foreground p-8">No photo recorded for this delivery.</p>
          )}
        </div>

        {/* Details panel */}
        <div className="sm:w-64 shrink-0 p-5 space-y-4 border-t sm:border-t-0 sm:border-l overflow-y-auto">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Delivery Details</h2>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground text-lg leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Date & Time</dt>
              <dd className="font-medium">{fmtDate(row.deliveredAt)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Station</dt>
              <dd>{row.stationName}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Tank</dt>
              <dd>{row.tankLabel} — {row.fuelGrade}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Litres Received</dt>
              <dd className="font-semibold">{fmtL(row.litresReceived)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Delivery Note #</dt>
              <dd className="font-mono text-xs">{row.deliveryNoteNumber}</dd>
            </div>
            {row.driverName !== '—' && (
              <div>
                <dt className="text-xs text-muted-foreground">Driver</dt>
                <dd>{row.driverName}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>
    </div>
  )
}
