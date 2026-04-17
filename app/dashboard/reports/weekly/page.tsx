import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { buildWeeklyReport } from '@/lib/aggregate-reports'
import type { DayVarianceRow } from '@/lib/aggregate-reports'

interface Props {
  searchParams: Promise<{ station?: string; week?: string }>
}

function getISOWeekString(d: Date): string {
  const thu = new Date(d)
  thu.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3)
  const year = thu.getUTCFullYear()
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const week = 1 + Math.round(((thu.getTime() - jan4.getTime()) / 86_400_000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7)
  return `${year}-W${String(week).padStart(2, '0')}`
}

function currentISOWeek(): string {
  return getISOWeekString(new Date())
}

function fmtV(n: number, unit: 'L' | 'R') {
  const sign = n > 0 ? '+' : ''
  const abs = Math.abs(n).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${sign}${unit === 'R' ? 'R ' : ''}${abs}${unit === 'L' ? ' L' : ''}`
}

function varColour(n: number) {
  return n > 0 ? 'text-destructive' : n < 0 ? 'text-amber-600' : 'text-green-600'
}

export default async function WeeklyReportPage({ searchParams }: Props) {
  const { station: stationId, week } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles').select('role, is_active').eq('user_id', user.id).single()
  if (!profile?.is_active || profile.role !== 'owner') redirect('/login')

  const selectedWeek = week ?? currentISOWeek()
  const { data: stations } = await supabase.from('stations').select('id, name').order('name')
  const activeStationId = stationId ?? stations?.[0]?.id
  if (!activeStationId) {
    return <main className="max-w-3xl mx-auto p-4"><p className="text-muted-foreground text-sm">No stations configured.</p></main>
  }
  const activeStation = (stations ?? []).find(s => s.id === activeStationId)

  // Parse the ISO week to a date range (Mon–Sun) for querying
  // ISO week YYYY-Www: first day is Monday
  const weekMatch = selectedWeek.match(/^(\d{4})-W(\d{2})$/)
  if (!weekMatch) redirect('/dashboard/reports/weekly')

  const year = parseInt(weekMatch[1])
  const weekNum = parseInt(weekMatch[2])
  // Jan 4 is always in week 1
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const weekStart = new Date(jan4)
  weekStart.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (weekNum - 1) * 7)
  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6)
  const startDate = weekStart.toISOString().slice(0, 10)
  const endDate = weekEnd.toISOString().slice(0, 10)

  // Load shifts + reconciliations for this week
  const { data: shifts } = await supabase
    .from('shifts')
    .select('id, shift_date, period, status')
    .eq('station_id', activeStationId)
    .gte('shift_date', startDate)
    .lte('shift_date', endDate)

  const shiftIds = (shifts ?? []).map(s => s.id)
  const recsResult = shiftIds.length > 0
    ? await supabase.from('reconciliations')
        .select('shift_id, reconciliation_tank_lines(variance_litres), reconciliation_grade_lines(variance_litres, variance_zar)')
        .in('shift_id', shiftIds)
    : { data: [] as any[] }

  const recs = recsResult.data ?? []

  // Build DayVarianceRow per date
  const dates = new Set((shifts ?? []).map(s => s.shift_date))
  const dayRows: DayVarianceRow[] = [...dates].map(date => {
    const dayShifts = (shifts ?? []).filter(s => s.shift_date === date)
    const morningShift = dayShifts.find(s => s.period === 'morning')
    const eveningShift = dayShifts.find(s => s.period === 'evening')

    let tankVar = 0, gradeVar = 0, revenueVar = 0
    for (const s of dayShifts) {
      const rec = recs.find((r: any) => r.shift_id === s.id)
      if (!rec) continue
      tankVar += (rec.reconciliation_tank_lines ?? []).reduce((sum: number, l: any) => sum + l.variance_litres, 0)
      gradeVar += (rec.reconciliation_grade_lines ?? []).reduce((sum: number, l: any) => sum + l.variance_litres, 0)
      revenueVar += (rec.reconciliation_grade_lines ?? []).reduce((sum: number, l: any) => sum + (l.variance_zar ?? 0), 0)
    }

    return {
      date,
      morningStatus: (morningShift?.status ?? 'not_started') as any,
      eveningStatus: (eveningShift?.status ?? 'not_started') as any,
      tankVarianceLitres: Math.round(tankVar * 100) / 100,
      gradeVarianceLitres: Math.round(gradeVar * 100) / 100,
      revenueVarianceZar: Math.round(revenueVar * 100) / 100,
    }
  })

  const report = buildWeeklyReport(dayRows, selectedWeek, activeStationId)

  return (
    <main className="max-w-4xl mx-auto p-4 space-y-6">
      <div>
        <Link href="/dashboard" className="text-xs text-muted-foreground hover:underline">← Dashboard</Link>
        <h1 className="text-xl font-semibold mt-1">Weekly Report</h1>
        <p className="text-sm text-muted-foreground">{activeStation?.name}</p>
      </div>

      <form method="GET" action="/dashboard/reports/weekly" className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Station</label>
          <select name="station" defaultValue={activeStationId} className="border rounded px-2 py-1.5 text-sm">
            {(stations ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">ISO Week</label>
          <input type="week" name="week" defaultValue={selectedWeek} className="border rounded px-2 py-1.5 text-sm" />
        </div>
        <button type="submit" className="rounded bg-black px-4 py-1.5 text-sm text-white">View</button>
        <a
          href={`/dashboard/reports/export?type=weekly&station=${activeStationId}&week=${selectedWeek}`}
          className="rounded border px-4 py-1.5 text-sm"
        >
          Export CSV
        </a>
      </form>

      <div className="border rounded-md text-sm overflow-x-auto">
        <table className="w-full">
          <thead className="border-b bg-muted/30">
            <tr className="text-muted-foreground text-xs">
              <th className="text-left px-3 py-2">Date</th>
              <th className="text-center px-3 py-2">Morning</th>
              <th className="text-center px-3 py-2">Evening</th>
              <th className="text-right px-3 py-2">Tank var (L)</th>
              <th className="text-right px-3 py-2">Meter var (L)</th>
              <th className="text-right px-3 py-2">Revenue var (ZAR)</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {report.rows.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-4 text-muted-foreground text-center">No data for this week.</td></tr>
            )}
            {report.rows.map(row => (
              <tr key={row.date}>
                <td className="px-3 py-2 font-medium">
                  <Link href={`/dashboard/reports?station=${activeStationId}&date=${row.date}`} className="underline text-primary">
                    {row.date}
                  </Link>
                </td>
                <td className="px-3 py-2 text-center text-xs capitalize">{row.morningStatus.replace(/_/g, ' ')}</td>
                <td className="px-3 py-2 text-center text-xs capitalize">{row.eveningStatus.replace(/_/g, ' ')}</td>
                <td className={`px-3 py-2 text-right ${varColour(row.tankVarianceLitres)}`}>{fmtV(row.tankVarianceLitres, 'L')}</td>
                <td className={`px-3 py-2 text-right ${varColour(row.gradeVarianceLitres)}`}>{fmtV(row.gradeVarianceLitres, 'L')}</td>
                <td className={`px-3 py-2 text-right ${varColour(row.revenueVarianceZar)}`}>{fmtV(row.revenueVarianceZar, 'R')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}
