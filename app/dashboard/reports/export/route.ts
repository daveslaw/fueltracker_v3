import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildWeeklyReport, buildMonthlyReport, isoWeekToDateRange, monthToDateRange } from '@/lib/aggregate-reports'
import { buildCsvFilename, reportRowsToCsv, formatDailyReconciliationCsv } from '@/lib/csv-export'
import type { DailyReconciliationPumpRow } from '@/lib/csv-export'
import type { RawReconciliation } from '@/lib/aggregate-reports'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const type      = searchParams.get('type') ?? 'daily'
  const stationId = searchParams.get('station') ?? ''
  const date      = searchParams.get('date') ?? ''
  const week      = searchParams.get('week') ?? ''
  const month     = searchParams.get('month') ?? ''

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: profile } = await supabase
    .from('user_profiles').select('role, is_active').eq('user_id', user.id).single()
  if (!profile?.is_active || profile.role !== 'owner') return new NextResponse('Forbidden', { status: 403 })

  const { data: station } = await supabase.from('stations').select('name').eq('id', stationId).single()
  const stationName = station?.name ?? stationId

  // ── Daily ──────────────────────────────────────────────────────────────

  if (type === 'daily') {
    const { data: shifts } = await supabase
      .from('shifts').select('id, period, status')
      .eq('station_id', stationId).eq('shift_date', date)

    const shiftIds = (shifts ?? []).map(s => s.id)
    if (shiftIds.length === 0) {
      return new NextResponse('No data', { status: 404 })
    }

    const { data: recs } = await supabase
      .from('reconciliations')
      .select('id, shift_id')
      .in('shift_id', shiftIds)

    interface DailyPumpLineRow {
      reconciliation_id:    string
      pump_id:              string
      fuel_grade_id:        string
      meter_delta_litres:   number
      pos_litres_sold:      number
      pos_revenue_zar:      number
      expected_revenue_zar: number
      variance_litres:      number
      variance_zar:         number
    }

    const recIds = (recs ?? []).map((r) => r.id as string)
    const recShiftById = new Map((recs ?? []).map((r) => [r.id as string, r.shift_id as string]))

    const { data: pumpLineRows } = recIds.length > 0
      ? await supabase
          .from('reconciliation_pump_lines')
          .select('reconciliation_id, pump_id, fuel_grade_id, meter_delta_litres, pos_litres_sold, pos_revenue_zar, expected_revenue_zar, variance_litres, variance_zar')
          .in('reconciliation_id', recIds)
      : { data: [] as DailyPumpLineRow[] }

    const { data: pumps } = await supabase
      .from('pumps').select('id, label').eq('station_id', stationId)
    const pumpLabel = (id: string) => (pumps ?? []).find((p) => p.id === id)?.label ?? id

    const csvRows: DailyReconciliationPumpRow[] = []
    for (const line of pumpLineRows ?? []) {
      const shiftId = recShiftById.get(line.reconciliation_id as string)
      if (!shiftId) continue
      const shift = (shifts ?? []).find((s) => s.id === shiftId)
      if (!shift) continue
      csvRows.push({
        date,
        period:               shift.period as string,
        pump_label:           pumpLabel(line.pump_id as string),
        fuel_grade:           line.fuel_grade_id as string,
        meter_delta_litres:   Number(line.meter_delta_litres),
        pos_litres_sold:      Number(line.pos_litres_sold),
        variance_litres:      Number(line.variance_litres),
        pos_revenue_zar:      Number(line.pos_revenue_zar),
        expected_revenue_zar: Number(line.expected_revenue_zar),
        variance_zar:         Number(line.variance_zar),
      })
    }

    const csv = formatDailyReconciliationCsv(csvRows)
    const filename = buildCsvFilename('daily', stationName, date)
    return csvResponse(csv, filename)
  }

  // ── Weekly / Monthly (aggregate) ──────────────────────────────────────

  const isMonthly = type === 'monthly'
  const dateRangeParam = isMonthly ? month : week

  const dateRange = isMonthly ? monthToDateRange(month) : isoWeekToDateRange(week)
  if (!dateRange) return new NextResponse('Invalid date range', { status: 400 })
  const { startDate: fromDate, endDate: toDate } = dateRange

  const { data: shifts } = await supabase
    .from('shifts').select('id, shift_date, period, status')
    .eq('station_id', stationId).gte('shift_date', fromDate).lte('shift_date', toDate)

  const shiftIds = (shifts ?? []).map(s => s.id)
  const recsResult = shiftIds.length > 0
    ? await supabase.from('reconciliations')
        .select('shift_id, reconciliation_tank_lines(variance_litres), reconciliation_pump_lines(variance_litres, variance_zar)')
        .in('shift_id', shiftIds)
    : { data: [] as RawReconciliation[] }

  const report = isMonthly
    ? buildMonthlyReport(shifts ?? [], recsResult.data ?? [], month, stationId)
    : buildWeeklyReport(shifts ?? [], recsResult.data ?? [], week, stationId)

  const headers = ['Date', 'Morning status', 'Evening status', 'Tank variance (L)', 'Meter variance (L)', 'Revenue variance (ZAR)']
  const rows: (string | number)[][] = report.rows.map(r => [
    r.date, r.morningStatus, r.eveningStatus,
    r.tankVarianceLitres, r.gradeVarianceLitres, r.revenueVarianceZar,
  ])

  if ('totals' in report) {
    const t = report.totals
    rows.push(['TOTAL', '', '', t.tankVarianceLitres, t.gradeVarianceLitres, t.revenueVarianceZar])
  }

  const csv = reportRowsToCsv(headers, rows)
  const filename = buildCsvFilename(type, stationName, dateRangeParam)
  return csvResponse(csv, filename)
}

function csvResponse(csv: string, filename: string): NextResponse {
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
