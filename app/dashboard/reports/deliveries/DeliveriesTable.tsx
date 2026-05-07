'use client'

import { useState } from 'react'
import type { DeliveryReportRow } from '@/lib/delivery-report'
import { DeliveryPhotoModal } from './DeliveryPhotoModal'

interface Props {
  rows: DeliveryReportRow[]
  totalLitres: number
  stationSubtotals: Record<string, { stationName: string; litres: number }>
  showStationSubtotals: boolean
}

function fmtL(n: number) {
  return n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' L'
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-ZA', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

export function DeliveriesTable({ rows, totalLitres, stationSubtotals, showStationSubtotals }: Props) {
  const [selectedRow, setSelectedRow] = useState<DeliveryReportRow | null>(null)

  return (
    <>
      <div className="border rounded-md text-sm overflow-x-auto">
        <table className="w-full">
          <thead className="border-b bg-muted/30">
            <tr className="text-muted-foreground text-xs">
              <th className="text-left px-3 py-2 whitespace-nowrap">Date & Time</th>
              <th className="text-left px-3 py-2">Station</th>
              <th className="text-left px-3 py-2">Tank</th>
              <th className="text-left px-3 py-2">Grade</th>
              <th className="text-right px-3 py-2 whitespace-nowrap">Litres</th>
              <th className="text-left px-3 py-2 whitespace-nowrap">Note #</th>
              <th className="text-left px-3 py-2">Driver</th>
              <th className="text-left px-3 py-2">Recorded by</th>
              <th className="px-3 py-2">Photo</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map(row => (
              <tr key={row.id} className="hover:bg-muted/20">
                <td className="px-3 py-2 whitespace-nowrap">{fmtDate(row.deliveredAt)}</td>
                <td className="px-3 py-2">{row.stationName}</td>
                <td className="px-3 py-2">{row.tankLabel}</td>
                <td className="px-3 py-2 font-medium">{row.fuelGrade}</td>
                <td className="px-3 py-2 text-right font-medium">{fmtL(row.litresReceived)}</td>
                <td className="px-3 py-2 font-mono text-xs">{row.deliveryNoteNumber}</td>
                <td className="px-3 py-2 text-muted-foreground">{row.driverName}</td>
                <td className="px-3 py-2 text-muted-foreground">{row.recordedByName}</td>
                <td className="px-3 py-2 text-center">
                  <button
                    onClick={() => setSelectedRow(row)}
                    className="text-xs text-blue-600 hover:underline disabled:text-muted-foreground disabled:no-underline"
                    disabled={!row.deliveryNoteUrl}
                  >
                    {row.deliveryNoteUrl ? 'View' : '—'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t bg-muted/30 font-semibold text-sm">
            {showStationSubtotals && Object.values(stationSubtotals).map(sub => (
              <tr key={sub.stationName} className="text-muted-foreground text-xs border-t">
                <td className="px-3 py-1.5" colSpan={4}>{sub.stationName} subtotal</td>
                <td className="px-3 py-1.5 text-right">{fmtL(sub.litres)}</td>
                <td colSpan={4} />
              </tr>
            ))}
            <tr>
              <td className="px-3 py-2" colSpan={4}>Total</td>
              <td className="px-3 py-2 text-right">{fmtL(totalLitres)}</td>
              <td colSpan={4} />
            </tr>
          </tfoot>
        </table>
      </div>

      {selectedRow && (
        <DeliveryPhotoModal row={selectedRow} onClose={() => setSelectedRow(null)} />
      )}
    </>
  )
}
