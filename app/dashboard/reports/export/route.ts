import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildWeeklyReport, buildMonthlyReport } from '@/lib/aggregate-reports'
import { buildCsvFilename, reportRowsToCsv, formatDailyReconciliationCsv } from '@/lib/csv-export'
import type { DailyReconciliationPumpRow } from '@/lib/csv-export'
import type { DayVarianceRow } from '@/lib/aggregate-reports'

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

    const recIds = (recs ?? []).map((r: any) => r.id as string)
    const recShiftById = new Map((recs ?? []).map((r: any) => [r.id as string, r.shift_id as string]))

    const { data: pumpLineRows } = recIds.length > 0
      ? await supabase
          .from('reconciliation_pump_lines')
          .select('reconciliation_id, pump_id, fuel_grade_id, meter_delta_litres, pos_litres_sold, pos_revenue_zar, expected_revenue_zar, variance_litres, variance_zar')
          .in('reconciliation_id', recIds)
      : { data: [] as any[] }

    const { data: pumps } = await supabase
      .from('pumps').select('id, label').eq('station_id', stationId)
    const pumpLabel = (id: string) => (pumps ?? []).find((p: any) => p.id === id)?.label ?? id

    const csvRows: DailyReconciliationPumpRow[] = []
    for (const line of pumpLineRows ?? []) {
      const shiftId = recShiftById.get(line.reconciliation_id as string)
      if (!shiftId) continue
      const shift = (shifts ?? []).find((s: any) => s.id === shiftId)
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

  const fromDate = isMonthly ? `${month}-01` : (() => {
    const wm = week.match(/^(\d{4})-W(\d{2})$/)
    if (!wm) return ''
    const yr = parseInt(wm[1]); const wk = parseInt(wm[2])
    const jan4 = new Date(Date.UTC(yr, 0, 4))
    const d = new Date(jan4)
    d.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (wk - 1) * 7)
    return d.toISOString().slice(0, 10)
  })()
  const toDate = isMonthly ? (() => { const [y, m] = month.split('-').map(Number); return new Date(y, m, 0).toISOString().slice(0, 10) })() : (() => {
    if (!fromDate) return ''
    const d = new Date(fromDate + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() + 6)
    return d.toISOString().slice(0, 10)
  })()

  if (!fromDate || !toDate) return new NextResponse('Invalid date range', { status: 400 })

  const { data: shifts } = await supabase
    .from('shifts').select('id, shift_date, period, status')
    .eq('station_id', stationId).gte('shift_date', fromDate).lte('shift_date', toDate)

  const shiftIds = (shifts ?? []).map(s => s.id)
  const recsResult = shiftIds.length > 0
    ? await supabase.from('reconciliations')
        .select('id, shift_id, reconciliation_tank_lines(variance_litres)')
        .in('shift_id', shiftIds)
    : { data: [] as any[] }

  const recs = recsResult.data ?? []

  // aggregate pump lines for variance_litres and variance_zar
  const recIds = recs.map((r: any) => r.id as string)
  const pumpLinesResult = recIds.length > 0
    ? await supabase.from('reconciliation_pump_lines')
        .select('reconciliation_id, variance_litres, variance_zar')
        .in('reconciliation_id', recIds)
    : { data: [] as any[] }
  const pumpLines = pumpLinesResult.data ?? []
  const pumpLinesByRecId = new Map<string, { variance_litres: number; variance_zar: number }[]>()
  for (const pl of pumpLines) {
    const id = pl.reconciliation_id as string
    if (!pumpLinesByRecId.has(id)) pumpLinesByRecId.set(id, [])
    pumpLinesByRecId.get(id)!.push({ variance_litres: Number(pl.variance_litres), variance_zar: Number(pl.variance_zar ?? 0) })
  }

  const dates = new Set((shifts ?? []).map(s => s.shift_date))
  const dayRows: DayVarianceRow[] = [...dates].map(d => {
    const dayShifts = (shifts ?? []).filter(s => s.shift_date === d)
    let tankVar = 0, gradeVar = 0, revenueVar = 0
    for (const s of dayShifts) {
      const rec = recs.find((r: any) => r.shift_id === s.id)
      if (!rec) continue
      tankVar    += (rec.reconciliation_tank_lines ?? []).reduce((a: number, l: any) => a + l.variance_litres, 0)
      const recPL = pumpLinesByRecId.get(rec.id as string) ?? []
      gradeVar   += recPL.reduce((a, l) => a + l.variance_litres, 0)
      revenueVar += recPL.reduce((a, l) => a + l.variance_zar,    0)
    }
    return {
      date: d,
      morningStatus: (dayShifts.find(s => s.period === 'morning')?.status ?? 'not_started') as any,
      eveningStatus: (dayShifts.find(s => s.period === 'evening')?.status ?? 'not_started') as any,
      tankVarianceLitres:  Math.round(tankVar    * 100) / 100,
      gradeVarianceLitres: Math.round(gradeVar   * 100) / 100,
      revenueVarianceZar:  Math.round(revenueVar * 100) / 100,
    }
  })

  const report = isMonthly
    ? buildMonthlyReport(dayRows, month, stationId)
    : buildWeeklyReport(dayRows, week, stationId)

  const headers = ['Date', 'Morning status', 'Evening status', 'Tank variance (L)', 'Meter variance (L)', 'Revenue variance (ZAR)']
  const rows: (string | number)[][] = report.rows.map(r => [
    r.date, r.morningStatus, r.eveningStatus,
    r.tankVarianceLitres, r.gradeVarianceLitres, r.revenueVarianceZar,
  ])

  if (isMonthly) {
    const t = (report as any).totals
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
