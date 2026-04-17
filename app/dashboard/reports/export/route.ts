import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildWeeklyReport, buildMonthlyReport } from '@/lib/aggregate-reports'
import { buildFinancialLines } from '@/lib/owner-reports'
import { selectActivePriceAt } from '@/lib/pricing'
import { buildCsvFilename, reportRowsToCsv } from '@/lib/csv-export'
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
      .from('shifts').select('id, period, status, submitted_at')
      .eq('station_id', stationId).eq('shift_date', date)

    const shiftIds = (shifts ?? []).map(s => s.id)
    if (shiftIds.length === 0) {
      return new NextResponse('No data', { status: 404 })
    }

    const [recsResult, posSubsResult, { data: allPrices }, { data: tanks }] = await Promise.all([
      supabase.from('reconciliations')
        .select('shift_id, reconciliation_tank_lines(*), reconciliation_grade_lines(*)')
        .in('shift_id', shiftIds),
      supabase.from('pos_submissions').select('id, shift_id').in('shift_id', shiftIds),
      supabase.from('fuel_prices').select('fuel_grade_id, price_per_litre, effective_from').order('effective_from'),
      supabase.from('tanks').select('id, label').eq('station_id', stationId),
    ])

    const recs = recsResult.data ?? []
    const posSubs = posSubsResult.data ?? []
    const posSubIds = posSubs.map((ps: any) => ps.id)
    const { data: allPosLines } = posSubIds.length > 0
      ? await supabase.from('pos_submission_lines')
          .select('pos_submission_id, fuel_grade_id, litres_sold, revenue_zar')
          .in('pos_submission_id', posSubIds)
      : { data: [] as any[] }

    const tankLabel = (id: string) => (tanks ?? []).find(t => t.id === id)?.label ?? id

    const rows: (string | number)[][] = []

    for (const s of shifts ?? []) {
      const rec = recs.find((r: any) => r.shift_id === s.id)
      if (!rec) continue
      const posSub = posSubs.find((ps: any) => ps.shift_id === s.id)
      const posLines = posSub ? (allPosLines ?? []).filter((pl: any) => pl.pos_submission_id === posSub.id) : []
      const gradeIds = [...new Set(posLines.map((l: any) => l.fuel_grade_id as string))]
      const prices = gradeIds.map(gid => ({
        fuel_grade_id: gid,
        price_per_litre: selectActivePriceAt(
          (allPrices ?? []).filter(p => p.fuel_grade_id === gid), s.submitted_at ?? date
        ) ?? 0,
      }))
      const financial = buildFinancialLines(posLines as any, prices)

      for (const line of (rec as any).reconciliation_tank_lines ?? []) {
        rows.push([date, s.period, 'tank', tankLabel(line.tank_id), '', line.opening_dip, line.deliveries_received, line.pos_litres_sold, line.expected_closing_dip, line.actual_closing_dip, line.variance_litres, '', '', ''])
      }
      for (const line of (rec as any).reconciliation_grade_lines ?? []) {
        rows.push([date, s.period, 'grade', '', line.fuel_grade_id, '', '', line.pos_litres_sold, '', '', line.variance_litres, line.meter_delta, '', ''])
      }
      for (const line of financial.lines) {
        rows.push([date, s.period, 'financial', '', line.fuel_grade_id, '', '', line.litres_sold, '', '', '', '', line.expected_revenue_zar, line.pos_revenue_zar])
      }
    }

    const headers = ['Date', 'Period', 'Type', 'Tank', 'Grade', 'Opening dip (L)', 'Deliveries (L)', 'POS sold (L)', 'Expected close (L)', 'Actual close (L)', 'Tank variance (L)', 'Meter delta (L)', 'Expected revenue (ZAR)', 'POS revenue (ZAR)']
    const csv = reportRowsToCsv(headers, rows)
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
  const toDate = isMonthly ? `${month}-31` : (() => {
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
        .select('shift_id, reconciliation_tank_lines(variance_litres), reconciliation_grade_lines(variance_litres, variance_zar)')
        .in('shift_id', shiftIds)
    : { data: [] as any[] }

  const recs = recsResult.data ?? []
  const dates = new Set((shifts ?? []).map(s => s.shift_date))
  const dayRows: DayVarianceRow[] = [...dates].map(d => {
    const dayShifts = (shifts ?? []).filter(s => s.shift_date === d)
    let tankVar = 0, gradeVar = 0, revenueVar = 0
    for (const s of dayShifts) {
      const rec = recs.find((r: any) => r.shift_id === s.id)
      if (!rec) continue
      tankVar   += (rec.reconciliation_tank_lines ?? []).reduce((a: number, l: any) => a + l.variance_litres, 0)
      gradeVar  += (rec.reconciliation_grade_lines ?? []).reduce((a: number, l: any) => a + l.variance_litres, 0)
      revenueVar += (rec.reconciliation_grade_lines ?? []).reduce((a: number, l: any) => a + (l.variance_zar ?? 0), 0)
    }
    return {
      date: d,
      morningStatus: (dayShifts.find(s => s.period === 'morning')?.status ?? 'not_started') as any,
      eveningStatus: (dayShifts.find(s => s.period === 'evening')?.status ?? 'not_started') as any,
      tankVarianceLitres: Math.round(tankVar * 100) / 100,
      gradeVarianceLitres: Math.round(gradeVar * 100) / 100,
      revenueVarianceZar: Math.round(revenueVar * 100) / 100,
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
