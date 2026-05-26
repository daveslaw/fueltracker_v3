'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import type { DayEntry, DaySummary, FuelControlReportRow } from '@/lib/fuel-control-report'

interface Props {
  entries:   DayEntry[]
  grades:    string[]
  stationId: string
}

function fmtL(n: number | null): string {
  if (n === null) return '—'
  return n.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtR(n: number | null): string {
  if (n === null) return '—'
  return 'R ' + n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function VarCell({ v }: { v: number | null }) {
  if (v === null) return <span className="text-muted-foreground">—</span>
  const cls  = v < 0 ? 'text-red-600' : v > 0 ? 'text-amber-500' : 'text-green-600'
  const sign = v > 0 ? '+' : ''
  return (
    <span className={`font-semibold ${cls}`}>
      {sign}{v.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} L
    </span>
  )
}

function ShiftCell({ row }: { row: Extract<FuelControlReportRow, { type: 'shift' }>['data'] }) {
  const isPending = row.status === 'pending'
  const label     = row.period === 'morning' ? 'AM' : 'PM'

  const dateContent = isPending
    ? <span className="text-muted-foreground">{label}</span>
    : <Link href={`/dashboard/history/${row.shift_id}`} className="underline text-primary">{label}</Link>

  return (
    <>
      {dateContent}
      {isPending && <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">pending</span>}
      {row.is_flagged && <span className="ml-2 text-xs bg-red-100 text-red-800 px-1.5 py-0.5 rounded">flagged</span>}
      {row.has_maintenance_flag && <span className="ml-2 text-xs bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded" title="Pump maintenance required">M</span>}
    </>
  )
}

function ShiftRow({ row }: { row: Extract<FuelControlReportRow, { type: 'shift' }>['data'] }) {
  return (
    <tr className="divide-x">
      <td className="px-3 py-2 whitespace-nowrap"><ShiftCell row={row} /></td>
      <td className="px-3 py-2 text-right tabular-nums">{fmtL(row.opening_dip)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{fmtL(row.closing_dip)}</td>
      <td className="px-3 py-2">
        {row.deliveries_litres > 0 ? (
          <div>
            <span className="tabular-nums">{fmtL(row.deliveries_litres)}</span>
            {row.delivery_note && <span className="block text-xs text-muted-foreground">{row.delivery_note}</span>}
            {row.driver_name   && <span className="block text-xs text-muted-foreground">{row.driver_name}</span>}
          </div>
        ) : <span className="text-muted-foreground">—</span>}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{fmtL(row.pos_litres)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{fmtL(row.dip_calc_litres)}</td>
      <td className="px-3 py-2 text-right"><VarCell v={row.variance_litres} /></td>
      <td className="px-3 py-2 text-right"><span className="text-muted-foreground">—</span></td>
      <td className="px-3 py-2 text-right tabular-nums">{fmtR(row.gp_zar)}</td>
    </tr>
  )
}

function PriceChangeImpactRow({ row }: { row: Extract<FuelControlReportRow, { type: 'price_change_impact' }> }) {
  const cls = row.impact_zar >= 0 ? 'text-green-700' : 'text-red-600'
  return (
    <tr className="bg-amber-50 text-xs divide-x italic">
      <td className="px-3 py-1.5 text-amber-800" colSpan={5}>
        Price change impact — {fmtL(row.closing_dip_litres)} L closing dip
        &nbsp;· old cost {fmtR(row.old_cost)}/L → new cost {fmtR(row.new_cost)}/L
      </td>
      <td className="px-3 py-1.5" colSpan={3} />
      <td className={`px-3 py-1.5 text-right font-semibold tabular-nums ${cls}`}>
        {row.impact_zar > 0 ? '+' : ''}{fmtR(row.impact_zar)}
      </td>
    </tr>
  )
}

function DayCollapsedRow({ entry, summary, accVariance, expanded, onToggle }: {
  entry:       DayEntry
  summary:     DaySummary
  accVariance: number | null
  expanded:    boolean
  onToggle:    () => void
}) {
  return (
    <tr
      data-testid={`day-row-${entry.date}`}
      className="bg-muted/40 font-medium text-sm divide-x cursor-pointer hover:bg-muted/60"
      onClick={onToggle}
    >
      <td className="px-3 py-1.5">
        <span className="mr-1 text-xs">{expanded ? '▼' : '▶'}</span>
        {entry.date}
      </td>
      <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">—</td>
      <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">—</td>
      <td className="px-3 py-1.5 text-right tabular-nums">
        {summary.total_deliveries > 0 ? fmtL(summary.total_deliveries) : <span className="text-muted-foreground">—</span>}
      </td>
      <td className="px-3 py-1.5 text-right tabular-nums">{summary.total_pos_litres !== null ? `${fmtL(summary.total_pos_litres)} L` : <span className="text-muted-foreground">—</span>}</td>
      <td className="px-3 py-1.5 text-right tabular-nums">{summary.total_dip_calc !== null ? `${fmtL(summary.total_dip_calc)} L` : <span className="text-muted-foreground">—</span>}</td>
      <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">—</td>
      <td className="px-3 py-1.5 text-right"><VarCell v={accVariance} /></td>
      <td className="px-3 py-1.5 text-right tabular-nums">{fmtR(summary.total_gp)}</td>
    </tr>
  )
}

export function FuelControlTable({ entries, grades, stationId: _stationId }: Props) {
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())
  const [selectedGrade, setSelectedGrade]  = useState<string>(grades[0] ?? '')

  function toggleDate(date: string) {
    setExpandedDates(prev => {
      const next = new Set(prev)
      next.has(date) ? next.delete(date) : next.add(date)
      return next
    })
  }

  function handleGradeChange(grade: string) {
    setSelectedGrade(grade)
    setExpandedDates(new Set())
  }

  return (
    <div className="space-y-4">
      {/* Grade filter */}
      <div className="flex items-center gap-2">
        <label htmlFor="grade-filter" className="text-xs text-muted-foreground">Grade</label>
        <select
          id="grade-filter"
          aria-label="Grade"
          value={selectedGrade}
          onChange={e => handleGradeChange(e.target.value)}
          className="border rounded px-2 py-1.5 text-sm"
        >
          {grades.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="border rounded-md text-sm overflow-x-auto">
        <table className="w-full divide-y">
          <thead className="bg-muted/30 sticky top-0 z-10">
            <tr className="text-xs text-muted-foreground divide-x">
              <th className="text-left px-3 py-2 bg-muted/30">Shift</th>
              <th className="text-right px-3 py-2 bg-muted/30">Opening dip (L)</th>
              <th className="text-right px-3 py-2 bg-muted/30">Closing dip (L)</th>
              <th className="text-left px-3 py-2 bg-muted/30">Deliveries (L)</th>
              <th className="text-right px-3 py-2 bg-muted/30">POS (L)</th>
              <th className="text-right px-3 py-2 bg-muted/30">Dip-calc (L)</th>
              <th className="text-right px-3 py-2 bg-muted/30">Variance (L)</th>
              <th className="text-right px-3 py-2 bg-muted/30">Acc. variance (L)</th>
              <th className="text-right px-3 py-2 bg-muted/30">GP (ZAR)</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {entries.map(entry => {
              const isExpanded = expandedDates.has(entry.date)

              const group = entry.gradeGroups.find(g => g.grade === selectedGrade)
              const shiftRows = (group?.rows ?? [])
                .filter((r): r is Extract<FuelControlReportRow, { type: 'shift' }> => r.type === 'shift')
                .map(r => r.data)

              const summary: DaySummary = {
                total_deliveries: shiftRows.reduce((a, r) => a + r.deliveries_litres, 0),
                total_pos_litres: shiftRows.every(r => r.pos_litres === null) ? null
                  : shiftRows.reduce<number>((a, r) => a + (r.pos_litres ?? 0), 0),
                total_dip_calc: shiftRows.every(r => r.dip_calc_litres === null) ? null
                  : shiftRows.reduce<number>((a, r) => a + (r.dip_calc_litres ?? 0), 0),
                total_variance: shiftRows.every(r => r.variance_litres === null) ? null
                  : shiftRows.reduce<number>((a, r) => a + (r.variance_litres ?? 0), 0),
                total_gp: shiftRows.every(r => r.gp_zar === null) ? null
                  : shiftRows.reduce<number>((a, r) => a + (r.gp_zar ?? 0), 0),
              }

              // Use last non-null accumulated_variance from the day's shifts as the running month total
              const accVariance = [...shiftRows].reverse()
                .find(r => r.accumulated_variance !== null)?.accumulated_variance ?? null

              const visibleGroups = entry.gradeGroups.filter(g => g.grade === selectedGrade)

              return (
                <React.Fragment key={`day-${entry.date}`}>
                  <DayCollapsedRow
                    entry={entry}
                    summary={summary}
                    accVariance={accVariance}
                    expanded={isExpanded}
                    onToggle={() => toggleDate(entry.date)}
                  />
                  {isExpanded && visibleGroups.flatMap(group =>
                    group.rows.map((row, i) =>
                      row.type === 'shift'
                        ? <ShiftRow key={`${entry.date}-${group.grade}-${i}`} row={row.data} />
                        : <PriceChangeImpactRow key={`impact-${entry.date}-${group.grade}-${i}`} row={row} />
                    )
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
